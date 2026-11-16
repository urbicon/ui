/**
 * GitHub's heading slug: lowercase, punctuation dropped except `-`/`_`, spaces
 * → `-`. Inside inline code nothing is HTML, so a heading that names
 * `<BlocksProvider>` keeps those letters — strip the angle brackets there and
 * the anchor the document actually links to reads as broken.
 *
 * One function for both readers of a shipped guide's anchors: `docs:refs:check`
 * resolves `FILE.md#anchor` links with it, and the docs site gives the rendered
 * headings these ids (`apps/docs/src/lib/server/guide-markdown.ts`).
 */
export function slugify(raw: string): string {
  return raw
    .split('`')
    .map((part, i) => (i % 2 === 1 ? part : stripTags(part)))
    .join('')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Drops `<…>` runs until none is left, so a nested `<<b>>` cannot survive one pass. */
function stripTags(text: string): string {
  let out = text;
  for (;;) {
    const next = out.replace(/<[^>]*>/g, '');
    if (next === out) return out;
    out = next;
  }
}
