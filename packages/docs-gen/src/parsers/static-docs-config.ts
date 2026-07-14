// packages/docs-gen/src/parsers/static-docs-config.ts
// ==========================================
// STATIC docsConfig PARSING (no code evaluation)
// ==========================================
//
// `docsConfig` used to be recovered with `eval('(' + configString + ')')` over a
// regex-sliced chunk of a docs.svelte file — i.e. build-time code execution over
// whatever a source file happened to contain, plus a non-greedy regex that
// truncated the object at the first `};` inside any string.
//
// This module folds the exported object literal straight off the TypeScript AST
// instead. Nothing is executed; only JSON-shaped literals are accepted. Anything
// that is not statically knowable (identifier references, spreads, calls,
// template substitutions, …) raises a `StaticDocsConfigError` carrying the exact
// `file:line:column`, rather than silently degrading to `{}` — a wrong-but-quiet
// docsConfig would silently drop a component's documentation settings.

import * as ts from 'typescript';

/**
 * Raised when the `docsConfig` export cannot be folded into a static value.
 * Carries the position in the *original* .svelte file (see `maskToScriptBodies`).
 */
export class StaticDocsConfigError extends Error {
  constructor(
    message: string,
    readonly file: string,
    readonly line: number,
    readonly column: number
  ) {
    super(`${file}:${line}:${column}: ${message}`);
    this.name = 'StaticDocsConfigError';
  }
}

/** `<script>` / `<script lang="ts">` … `</script>` blocks. */
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

const CLOSING_SCRIPT_TAG = '</script>';

/**
 * Blank out everything that is not inside a `<script>` body, preserving the
 * file's exact length and line breaks. The TypeScript parser then sees only the
 * script source, while every reported position still maps 1:1 onto the original
 * .svelte file — so error messages point at the real line the author wrote.
 */
function maskToScriptBodies(content: string): string {
  // Same length, same newlines, everything else whitespace.
  const masked = content.replace(/[^\n\r]/g, ' ').split('');

  for (const match of content.matchAll(SCRIPT_BLOCK)) {
    const body = match[1];
    if (body === undefined || match.index === undefined) continue;
    // Body sits directly before the closing tag inside the full match.
    const bodyStart = match.index + match[0].length - CLOSING_SCRIPT_TAG.length - body.length;
    for (let i = 0; i < body.length; i++) {
      masked[bodyStart + i] = body[i] as string;
    }
  }

  return masked.join('');
}

function fail(node: ts.Node, sourceFile: ts.SourceFile, file: string, message: string): never {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  throw new StaticDocsConfigError(message, file, line + 1, character + 1);
}

/** A property key that survives folding: `foo`, `'foo'`, `0`. */
function foldPropertyKey(name: ts.PropertyName, sourceFile: ts.SourceFile, file: string): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  fail(
    name,
    sourceFile,
    file,
    'computed / non-literal property keys are not supported in docsConfig'
  );
}

/**
 * Fold a TypeScript expression into the plain value it denotes.
 * Accepts only JSON-shaped literals; throws `StaticDocsConfigError` otherwise.
 */
export function foldStaticExpression(
  node: ts.Expression,
  sourceFile: ts.SourceFile,
  file: string
): unknown {
  // --- primitives -------------------------------------------------------
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && node.text === 'undefined') return undefined;

  // --- transparent wrappers ---------------------------------------------
  // `(x)`, `x as const`, `x satisfies T`, `<T>x` carry no runtime meaning here.
  if (ts.isParenthesizedExpression(node)) {
    return foldStaticExpression(node.expression, sourceFile, file);
  }
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return foldStaticExpression(node.expression, sourceFile, file);
  }
  if (ts.isTypeAssertionExpression(node)) {
    return foldStaticExpression(node.expression, sourceFile, file);
  }

  // --- signed numbers ---------------------------------------------------
  if (ts.isPrefixUnaryExpression(node)) {
    const { operator, operand } = node;
    if (ts.isNumericLiteral(operand)) {
      if (operator === ts.SyntaxKind.MinusToken) return -Number(operand.text);
      if (operator === ts.SyntaxKind.PlusToken) return Number(operand.text);
    }
    fail(node, sourceFile, file, 'only `-`/`+` on a numeric literal can be evaluated statically');
  }

  // --- arrays -----------------------------------------------------------
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        fail(element, sourceFile, file, 'spread elements are not supported in docsConfig');
      }
      if (element.kind === ts.SyntaxKind.OmittedExpression) {
        fail(element, sourceFile, file, 'array holes are not supported in docsConfig');
      }
      return foldStaticExpression(element, sourceFile, file);
    });
  }

  // --- objects ----------------------------------------------------------
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};

    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        fail(property, sourceFile, file, 'object spreads are not supported in docsConfig');
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        fail(
          property,
          sourceFile,
          file,
          `shorthand property '${property.name.text}' references a binding and cannot be evaluated statically`
        );
      }
      if (!ts.isPropertyAssignment(property)) {
        // Methods, getters, setters.
        fail(property, sourceFile, file, 'methods and accessors are not supported in docsConfig');
      }

      const key = foldPropertyKey(property.name, sourceFile, file);
      const value = foldStaticExpression(property.initializer, sourceFile, file);

      // defineProperty (not `result[key] = …`) so a literal `__proto__` key stays
      // an ordinary own property instead of reaching the prototype setter.
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }

    return result;
  }

  // --- everything else is a hard error ----------------------------------
  if (ts.isTemplateExpression(node)) {
    fail(
      node,
      sourceFile,
      file,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal prose — the message names the syntax the author has to remove.
      'template literals with ${…} substitutions cannot be evaluated statically'
    );
  }

  fail(
    node,
    sourceFile,
    file,
    `cannot statically evaluate ${ts.SyntaxKind[node.kind]} — docsConfig accepts only literal objects, arrays, strings, numbers, booleans, null and undefined`
  );
}

/** Locate the initializer of a top-level `export const docsConfig = …`. */
function findDocsConfigInitializer(sourceFile: ts.SourceFile): ts.Expression | null {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!isExported) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === 'docsConfig' &&
        declaration.initializer
      ) {
        return declaration.initializer;
      }
    }
  }
  return null;
}

/**
 * Parse `export const docsConfig = { … }` out of a docs.svelte source.
 *
 * @param content Raw .svelte file contents.
 * @param file Path used in error messages.
 * @returns The folded config, or `null` when the file exports no `docsConfig`.
 * @throws {StaticDocsConfigError} when the export exists but is not a static object literal.
 */
export function parseDocsConfigFromSvelte(
  content: string,
  file: string
): Record<string, unknown> | null {
  const sourceFile = ts.createSourceFile(
    file,
    maskToScriptBodies(content),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  const initializer = findDocsConfigInitializer(sourceFile);
  if (!initializer) return null;

  if (!ts.isObjectLiteralExpression(initializer)) {
    fail(initializer, sourceFile, file, 'docsConfig must be an object literal');
  }

  return foldStaticExpression(initializer, sourceFile, file) as Record<string, unknown>;
}
