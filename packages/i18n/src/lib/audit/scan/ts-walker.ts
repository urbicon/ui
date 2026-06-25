/**
 * TypeScript/JavaScript usage walker. Uses the TypeScript compiler API (the repo
 * precedent — docs-gen extracts props the same way), lazily imported so the
 * dependency never touches the i18n runtime entry, only `@urbicon-ui/i18n/audit`.
 *
 * Two passes: collect the file-local translate-function bindings (B1), then walk
 * calls + string literals (B2), emitting into a {@link UsageScan}.
 */

import {
  type Bindings,
  createBindings,
  createScan,
  isFactoryName,
  isKeyMethod,
  isProbeMethod,
  isRenderMethod,
  makeContextAt,
  recordKeyCall
} from './recognize';
import type { ExtractedKey, ScanOptions, UsageScan } from './types';

type Ts = typeof import('typescript');
type TsNode = import('typescript').Node;
type TsSourceFile = import('typescript').SourceFile;

let tsPromise: Promise<Ts> | undefined;
async function loadTs(): Promise<Ts> {
  if (!tsPromise) {
    tsPromise = (async () => {
      let mod: unknown;
      try {
        mod = await import('typescript');
      } catch {
        throw new Error(
          '@urbicon-ui/i18n/audit needs the optional peer "typescript" to scan .ts/.js sources — install it (it ships with any SvelteKit/TS project).'
        );
      }
      // typescript ships CJS; interop puts the namespace on `.default` or spreads it.
      const candidate = mod as Ts & { default?: Ts };
      return typeof candidate.createSourceFile === 'function'
        ? candidate
        : (candidate.default as Ts);
    })();
  }
  return tsPromise;
}

function scriptKindFor(ts: Ts, file: string): import('typescript').ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(m|c)?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function calleeName(ts: Ts, expr: TsNode): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return undefined;
}

/** The factory-hook name when `node` is a call to one (`useTableI18n()` → `useTableI18n`). */
function factoryCallName(ts: Ts, node: TsNode): string | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const name = calleeName(ts, node.expression);
  return name && isFactoryName(name) ? name : undefined;
}

function bindDeclarationName(ts: Ts, name: TsNode, bindings: Bindings): void {
  if (ts.isIdentifier(name)) {
    // `const bt = useTableI18n()` — the alias is a translate function.
    bindings.render.add(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name)) {
    // `const { t, exists } = useI18n()` — only the known methods are key-calls.
    for (const element of name.elements) {
      const source = element.propertyName ?? element.name;
      const method = ts.isIdentifier(source) ? source.text : undefined;
      const local = ts.isIdentifier(element.name) ? element.name.text : undefined;
      if (!method || !local) continue;
      if (isProbeMethod(method)) bindings.probe.add(local);
      else if (isRenderMethod(method)) bindings.render.add(local);
    }
  }
}

function collectBindings(ts: Ts, sf: TsSourceFile, bindings: Bindings): void {
  const visit = (node: TsNode): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = node.initializer;
      if (factoryCallName(ts, init)) {
        bindDeclarationName(ts, node.name, bindings);
      } else if (
        ts.isPropertyAccessExpression(init) &&
        isKeyMethod(init.name.text) &&
        factoryCallName(ts, init.expression) &&
        ts.isIdentifier(node.name)
      ) {
        // `const t = useI18n().t`
        if (isProbeMethod(init.name.text)) bindings.probe.add(node.name.text);
        else bindings.render.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

function unwrap(ts: Ts, node: TsNode): TsNode {
  let current = node;
  for (;;) {
    // Per-guard so TypeScript narrows `current` to a node that has `.expression`.
    if (ts.isParenthesizedExpression(current)) current = current.expression;
    else if (ts.isAsExpression(current)) current = current.expression;
    else if (ts.isNonNullExpression(current)) current = current.expression;
    else if (ts.isSatisfiesExpression(current)) current = current.expression;
    else return current;
  }
}

function extractFromArg(ts: Ts, raw: TsNode): ExtractedKey[] {
  const node = unwrap(ts, raw);
  if (ts.isStringLiteralLike(node)) return [{ kind: 'static', value: node.text }];
  if (ts.isTemplateExpression(node)) {
    // `` `filter.op.${x}` `` → prefix `filter.op.`; an empty head is unresolvable.
    return node.head.text ? [{ kind: 'prefix', prefix: node.head.text }] : [{ kind: 'opaque' }];
  }
  if (ts.isConditionalExpression(node)) {
    return [...extractFromArg(ts, node.whenTrue), ...extractFromArg(ts, node.whenFalse)];
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = unwrap(ts, node.left);
    // An empty static part (`'' + x`) is no prefix — `''` would shield every key.
    if (ts.isStringLiteralLike(left) && left.text) return [{ kind: 'prefix', prefix: left.text }];
    return [{ kind: 'opaque' }];
  }
  return [{ kind: 'opaque' }];
}

function classifyCall(
  ts: Ts,
  bindings: Bindings,
  call: import('typescript').CallExpression
): { isProbe: boolean } | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) {
    if (bindings.render.has(callee.text)) return { isProbe: false };
    if (bindings.probe.has(callee.text)) return { isProbe: true };
    return null;
  }
  if (ts.isPropertyAccessExpression(callee)) {
    const name = callee.name.text;
    if (isRenderMethod(name)) return { isProbe: false };
    if (isProbeMethod(name)) return { isProbe: true };
  }
  return null;
}

export async function scanTs(
  code: string,
  file: string,
  options: ScanOptions = {}
): Promise<UsageScan> {
  const ts = await loadTs();
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKindFor(ts, file));
  const bindings = createBindings(options.functionNames);
  collectBindings(ts, sf, bindings);

  const scan = createScan();
  const contextAt = makeContextAt(code);
  const visit = (node: TsNode): void => {
    if (ts.isStringLiteralLike(node)) scan.literalPool.add(node.text);
    // Harvest the static head of EVERY template literal (not only those in a t()
    // call) as a dynamic prefix — keys built in a config (`col.${id}.label`) and
    // rendered elsewhere are then shielded from the unused list.
    if (ts.isTemplateExpression(node) && node.head.text) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      scan.dynamicPrefixes.push({
        prefix: node.head.text,
        site: { file, line, context: contextAt(line) }
      });
    }
    if (ts.isCallExpression(node)) {
      const classification = classifyCall(ts, bindings, node);
      if (classification) {
        const arg = node.arguments[0];
        const extractions = arg ? extractFromArg(ts, arg) : [];
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        recordKeyCall(
          scan,
          extractions,
          { file, line, context: contextAt(line) },
          classification.isProbe
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return scan;
}
