/**
 * Shared Svelte-AST plumbing for the usage walker and the hardcoded-string lint:
 * the lazily-imported `parse`, a permissive `unknown`-based node accessor set, and
 * one iterative cycle-safe DFS. Kept dependency-light — `svelte/compiler` loads
 * only when a `.svelte` source is actually scanned.
 */

type SvelteParse = typeof import('svelte/compiler')['parse'];
let parsePromise: Promise<SvelteParse> | undefined;
export async function loadParse(): Promise<SvelteParse> {
  if (!parsePromise) {
    parsePromise = (async () => {
      try {
        return (await import('svelte/compiler')).parse;
      } catch {
        throw new Error(
          '@urbicon-ui/i18n/audit needs the "svelte" peer to scan .svelte sources — install it.'
        );
      }
    })();
  }
  return parsePromise;
}

export interface AstNode {
  type: string;
  start?: number;
  [key: string]: unknown;
}
export const asNode = (value: unknown): AstNode | undefined =>
  value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string'
    ? (value as AstNode)
    : undefined;
export const asNodes = (value: unknown): AstNode[] =>
  Array.isArray(value) ? value.flatMap((item) => asNode(item) ?? []) : [];
export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
/** A TemplateElement's text. `.value` is a plain `{ raw, cooked }` (no `.type`). */
export const cookedOf = (quasi: AstNode | undefined): string | undefined => {
  const value = quasi?.value as { cooked?: unknown; raw?: unknown } | undefined;
  return asString(value?.cooked) ?? asString(value?.raw);
};

/** Iterative DFS over the whole AST; skips non-structural keys and guards cycles. */
export function walkAst(root: unknown, visit: (node: AstNode) => void): void {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    const node = current as Record<string, unknown>;
    if (typeof node.type === 'string') visit(node as AstNode);
    for (const key in node) {
      if (
        key === 'type' ||
        key === 'loc' ||
        key === 'parent' ||
        key === 'metadata' ||
        key === 'name_loc'
      ) {
        continue;
      }
      const child = node[key];
      if (child && typeof child === 'object') stack.push(child);
    }
  }
}
