/**
 * Svelte usage walker. `svelte/compiler.parse` (lazily imported) yields one AST
 * whose Root holds the module/instance scripts (estree) *and* the template, so a
 * single iterative walk reaches every translate call — script-level and inside
 * markup expressions — with original-source offsets for accurate line numbers.
 *
 * On top of the estree handling (mirroring the TypeScript walker) it understands
 * the `<T key="…">` component, the markup form of a translation render-call.
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
  makeLineAt,
  recordKeyCall
} from './recognize';
import {
  type AstNode,
  asNode,
  asNodes,
  asString,
  cookedOf,
  loadParse,
  walkAst
} from './svelte-ast';
import type { ExtractedKey, KeyUsageSite, ScanOptions, UsageScan } from './types';

/** Peel `as`/`!`/`satisfies` (TS nodes present when `lang="ts"`) off an expression. */
function unwrap(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (
    current &&
    /^TS\w+(Expression|Assertion)$/.test(current.type) &&
    asNode(current.expression)
  ) {
    current = asNode(current.expression);
  }
  return current;
}

function extractFromArg(raw: AstNode | undefined): ExtractedKey[] {
  const node = unwrap(raw);
  if (!node) return [{ kind: 'opaque' }];
  if (node.type === 'Literal') {
    const value = asString(node.value);
    return value !== undefined ? [{ kind: 'static', value }] : [{ kind: 'opaque' }];
  }
  if (node.type === 'TemplateLiteral') {
    const head = cookedOf(asNodes(node.quasis)[0]) ?? '';
    if (asNodes(node.expressions).length === 0) return [{ kind: 'static', value: head }];
    return head ? [{ kind: 'prefix', prefix: head }] : [{ kind: 'opaque' }];
  }
  if (node.type === 'ConditionalExpression') {
    return [...extractFromArg(asNode(node.consequent)), ...extractFromArg(asNode(node.alternate))];
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = unwrap(asNode(node.left));
    const value = left?.type === 'Literal' ? asString(left.value) : undefined;
    // An empty static part (`'' + x`) is no prefix — `''` would shield every key.
    return value ? [{ kind: 'prefix', prefix: value }] : [{ kind: 'opaque' }];
  }
  return [{ kind: 'opaque' }];
}

/** The rightmost callee name of a call (`x.useTranslate()` → `useTranslate`). */
function calleeName(call: AstNode): string | undefined {
  const callee = asNode(call.callee);
  if (!callee) return undefined;
  if (callee.type === 'Identifier') return asString(callee.name);
  if (callee.type === 'MemberExpression' && callee.computed !== true) {
    return asString(asNode(callee.property)?.name);
  }
  return undefined;
}

function factoryCallName(node: AstNode | undefined): string | undefined {
  if (node?.type !== 'CallExpression') return undefined;
  const name = calleeName(node);
  return name && isFactoryName(name) ? name : undefined;
}

function bindDeclarator(node: AstNode, bindings: Bindings): void {
  const init = asNode(node.init);
  if (!init) return;
  const id = asNode(node.id);
  if (factoryCallName(init)) {
    if (id?.type === 'Identifier') {
      const name = asString(id.name);
      if (name) bindings.render.add(name);
    } else if (id?.type === 'ObjectPattern') {
      for (const prop of asNodes(id.properties)) {
        if (prop.type !== 'Property') continue;
        const method = asString(asNode(prop.key)?.name);
        const local = asString(asNode(prop.value)?.name);
        if (!method || !local) continue;
        if (isProbeMethod(method)) bindings.probe.add(local);
        else if (isRenderMethod(method)) bindings.render.add(local);
      }
    }
    return;
  }
  // `const t = useI18n().t`
  if (init.type === 'MemberExpression' && init.computed !== true && id?.type === 'Identifier') {
    const method = asString(asNode(init.property)?.name);
    const local = asString(id.name);
    if (method && local && isKeyMethod(method) && factoryCallName(asNode(init.object))) {
      if (isProbeMethod(method)) bindings.probe.add(local);
      else bindings.render.add(local);
    }
  }
}

function classifyCall(call: AstNode, bindings: Bindings): { isProbe: boolean } | null {
  const callee = asNode(call.callee);
  if (!callee) return null;
  if (callee.type === 'Identifier') {
    const name = asString(callee.name);
    if (!name) return null;
    if (bindings.render.has(name)) return { isProbe: false };
    if (bindings.probe.has(name)) return { isProbe: true };
    return null;
  }
  if (callee.type === 'MemberExpression' && callee.computed !== true) {
    const name = asString(asNode(callee.property)?.name);
    if (name && isRenderMethod(name)) return { isProbe: false };
    if (name && isProbeMethod(name)) return { isProbe: true };
  }
  return null;
}

/** Resolve the key of a `<T key="…">` / `<T key={'…'}>` component usage. */
function extractTComponentKey(component: AstNode): ExtractedKey[] {
  const keyAttr = asNodes(component.attributes).find(
    (attr) => attr.type === 'Attribute' && asString(attr.name) === 'key'
  );
  if (!keyAttr) return [];
  const values = Array.isArray(keyAttr.value)
    ? asNodes(keyAttr.value)
    : asNode(keyAttr.value)
      ? [asNode(keyAttr.value) as AstNode]
      : [];
  const out: ExtractedKey[] = [];
  for (const value of values) {
    if (value.type === 'Text') {
      const text = asString(value.data);
      if (text !== undefined) out.push({ kind: 'static', value: text });
    } else if (value.type === 'ExpressionTag') {
      out.push(...extractFromArg(asNode(value.expression)));
    }
  }
  return out;
}

export async function scanSvelte(
  code: string,
  file: string,
  options: ScanOptions = {}
): Promise<UsageScan> {
  const parse = await loadParse();
  const ast = parse(code, { modern: true });
  const bindings = createBindings(options.functionNames);
  const lineAt = makeLineAt(code);
  const contextAt = makeContextAt(code);
  const siteAt = (offset: number | undefined): KeyUsageSite => {
    const line = lineAt(offset ?? 0);
    return { file, line, context: contextAt(line) };
  };

  // Pass 1 — bindings.
  walkAst(ast, (node) => {
    if (node.type === 'VariableDeclarator') bindDeclarator(node, bindings);
  });

  // Pass 2 — usage + literal harvest.
  const scan = createScan();
  walkAst(ast, (node) => {
    if (node.type === 'Literal') {
      const value = asString(node.value);
      if (value !== undefined) scan.literalPool.add(value);
    } else if (node.type === 'Text') {
      // Plain markup text and quoted attribute values (`<Foo labelKey="user.name"/>`,
      // `<code>a.b.c</code>`) are Text, not Literal nodes — harvest for the loose layer.
      const text = asString(node.data)?.trim();
      if (text) scan.literalPool.add(text);
    } else if (node.type === 'TemplateLiteral') {
      const quasis = asNodes(node.quasis);
      if (asNodes(node.expressions).length === 0) {
        const cooked = cookedOf(quasis[0]);
        if (cooked !== undefined) scan.literalPool.add(cooked);
      } else {
        // Static head of any template literal → a dynamic prefix, so config-built
        // keys (`col.${id}.label`) rendered elsewhere are shielded from "unused".
        const head = cookedOf(quasis[0]);
        if (head) scan.dynamicPrefixes.push({ prefix: head, site: siteAt(node.start) });
      }
    } else if (node.type === 'CallExpression') {
      const classification = classifyCall(node, bindings);
      if (classification) {
        const args = asNodes(node.arguments);
        const extractions = args.length > 0 ? extractFromArg(args[0]) : [];
        recordKeyCall(scan, extractions, siteAt(node.start), classification.isProbe);
      }
    } else if (node.type === 'Component' && asString(node.name) === 'T') {
      recordKeyCall(scan, extractTComponentKey(node), siteAt(node.start), false);
    }
  });
  return scan;
}
