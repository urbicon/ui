import { parse } from 'svelte/compiler';

interface CodeExampleOptions {
  debug?: boolean;
}

/**
 * Minimal structural view of the Svelte AST nodes this plugin reads. Kept local
 * rather than importing `AST` from 'svelte/compiler' so the published `./vite`
 * entry's types stay free of compiler-internal type coupling.
 */
interface AstNode {
  type: string;
  start: number;
  end: number;
  name?: string;
  attributes?: AstNode[];
  fragment?: { nodes: AstNode[] };
  [key: string]: unknown;
}

interface Insertion {
  at: number;
  text: string;
}

/**
 * Vite plugin that auto-extracts children markup from <CodeExample isolate>
 * and injects it as the `code` prop, eliminating the need to duplicate code.
 *
 * Only processes CodeExamples that have the `isolate` attribute.
 * Skips any that already have an explicit `code` prop.
 *
 * Element boundaries come from Svelte's own parser rather than a regex: a
 * regex over `<CodeExample([^>]*)>…</CodeExample>` mis-parses two real shapes —
 * a literal `>` inside a `code={`…`}` template literal (terminates the open tag
 * early) and a self-closing `<CodeExample … />` (has no closing tag, so the
 * match runs on and swallows the *next* example). Both failed silently, leaving
 * a page with an empty code panel. See `extractIsolatedCode` for the fail-loud
 * warnings that now cover the remaining "nothing to extract" cases.
 */
export function codeExamplePlugin(options: CodeExampleOptions = {}) {
  const { debug = false } = options;

  return {
    name: 'code-example-extract',
    enforce: 'pre' as const,

    transform(code: string, id: string) {
      if (!id.endsWith('.svelte')) return null;
      if (!code.includes('CodeExample')) return null;

      const path = id.replace(/\\/g, '/');
      if (/\/node_modules\//.test(path) || /\/packages\/.+\/dist\//.test(path)) {
        return null;
      }

      const insertions = collectInsertions(code, id, debug);
      if (insertions.length === 0) return null;

      // Apply back-to-front so each offset stays valid against the original source.
      let transformedCode = code;
      for (const { at, text } of insertions.sort((a, b) => b.at - a.at)) {
        transformedCode = transformedCode.slice(0, at) + text + transformedCode.slice(at);
      }

      return { code: transformedCode, map: null };
    }
  };
}

function collectInsertions(source: string, id: string, debug: boolean): Insertion[] {
  let ast: unknown;
  try {
    ast = parse(source, { modern: true, filename: id });
  } catch (error) {
    // The Svelte plugin will report the real syntax error right after us; warn
    // anyway so a parse failure never looks like "extraction just did nothing".
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[code-example-extract] ${id}: could not parse the component, skipping code extraction (${reason})`
    );
    return [];
  }

  const insertions: Insertion[] = [];

  for (const node of findCodeExamples(ast)) {
    const insertion = extractIsolatedCode(source, id, node, debug);
    if (insertion) insertions.push(insertion);
  }

  return insertions;
}

/**
 * Builds the `code={`…`}` insertion for one <CodeExample>, or returns null when
 * the element opts out (no `isolate`, or an explicit `code` prop). A node that
 * asks for extraction but has nothing to extract warns instead of silently
 * rendering the "code extraction failed" fallback.
 */
function extractIsolatedCode(
  source: string,
  id: string,
  node: AstNode,
  debug: boolean
): Insertion | null {
  const attributes = node.attributes ?? [];
  const hasAttribute = (name: string) =>
    attributes.some((attr) => attr.type === 'Attribute' && attr.name === name);

  if (!hasAttribute('isolate')) return null;
  if (hasAttribute('code')) return null;

  const where = `${id}:${positionOf(source, node.start)}`;
  const children = node.fragment?.nodes ?? [];

  if (children.length === 0) {
    const shape = source.slice(node.start, node.end).endsWith('/>')
      ? 'it is self-closing'
      : 'it has no children';
    console.warn(
      `[code-example-extract] ${where}: <CodeExample isolate> has no code to extract — ${shape}. ` +
        `The page will render the code-extraction fallback. Give the example children, or pass an explicit \`code\` prop.`
    );
    return null;
  }

  const rawChildren = source.slice(children[0].start, children[children.length - 1].end);
  const extractedCode = extractTemplateCode(rawChildren);

  if (extractedCode.length === 0) {
    console.warn(
      `[code-example-extract] ${where}: <CodeExample isolate> has no code to extract — its children are empty. ` +
        `The page will render the code-extraction fallback.`
    );
    return null;
  }

  // Insert after the last attribute: always inside the open tag, and independent
  // of where the children happen to start.
  const lastAttribute = attributes[attributes.length - 1];

  if (debug) {
    console.log(`[code-example-extract] ${where}\n  → ${extractedCode.split('\n')[0]}…`);
  }

  return {
    at: lastAttribute.end,
    text: ` code={\`${escapeTemplateLiteral(extractedCode)}\`}`
  };
}

/** Collects every `<CodeExample>` component node in the parsed template. */
function findCodeExamples(root: unknown): AstNode[] {
  const found: AstNode[] = [];
  const seen = new WeakSet<object>();

  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const node = value as AstNode;
    if (node.type === 'Component' && node.name === 'CodeExample') {
      found.push(node);
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      visit(node[key]);
    }
  };

  visit(root);
  return found;
}

/** 1-based `line:column` for an offset, for actionable warnings. */
function positionOf(source: string, offset: number): string {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return `${line}:${column}`;
}

function extractTemplateCode(raw: string): string {
  const lines = raw.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 0) return raw.trim();

  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    })
  );

  return lines
    .map((line) => (line.trim().length === 0 ? '' : line.slice(minIndent)))
    .join('\n')
    .trim();
}

function escapeTemplateLiteral(code: string): string {
  return code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}
