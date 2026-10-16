// The `uses` column on /customization/tokens, counted from the blocks source at
// prerender time. Server-only (src/lib/server): the raw sources stay in the SSR
// bundle; the page receives the counts through its `+page.server.ts` load.
//
// The method: word-bounded occurrences of the utility across every .ts/.svelte
// under packages/blocks/src/lib, excluding tests. Prose mentions count too (the
// tv() engine names the sub-xs scale in a comment) — a mechanical rule, not a
// judgement call per hit.

const sources = Object.values(
  import.meta.glob<string>(
    [
      '../../../../../packages/blocks/src/lib/**/*.{ts,svelte}',
      '!../../../../../packages/blocks/src/lib/**/*.{test,spec}.*'
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

/** Every regex metacharacter, not just the `-` a utility name happens to contain. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

export function countUses(utility: string, corpus: readonly string[] = sources): number {
  const pattern = new RegExp(`\\b${escapeRegExp(utility)}\\b`, 'g');
  return corpus.reduce((total, src) => total + (src.match(pattern)?.length ?? 0), 0);
}

/** How many blocks source files the counts are taken over. */
export const blocksSourceCount = sources.length;

export function withUses<T extends { utility: string }>(
  rows: readonly T[]
): (T & { uses: number })[] {
  return rows.map((row) => ({ ...row, uses: countUses(row.utility) }));
}
