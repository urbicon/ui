import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the `uses` column on /customization/tokens against the blocks source.
 *
 * The column answers "which variable actually moves my UI?", and a 0 renders as an
 * em-dash — i.e. a wrong 0 does not read as an off-by-a-bit count, it reads as the
 * categorical claim "nothing uses this". The page shipped `--text-3xs … 0` while 12
 * call sites across 8 components used it, because the numbers were measured before
 * the tokenisation sweep landed and never re-measured.
 *
 * The method is the page's own, stated beside the table: word-bounded occurrences of
 * the utility across every .ts/.svelte under packages/blocks/src/lib, excluding
 * tests. It deliberately counts prose mentions too (the tv() engine names the sub-xs
 * scale in a comment) — that is what makes it a mechanical, reproducible rule rather
 * than a judgement call, and the noise is ~1 in 100. Both the page and this guard
 * must apply it identically; if the method changes, change it in both.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOCKS_LIB = resolve(__dirname, '..', '..', '..', '..', '..', 'packages/blocks/src/lib');
const TOKENS_PAGE = resolve(__dirname, 'tokens', '+page.svelte');

function sourceFilesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFilesIn(full));
      continue;
    }
    if (!/\.(ts|svelte)$/.test(entry)) continue;
    if (/\.(test|spec)\./.test(entry)) continue;
    out.push(full);
  }
  return out;
}

const sources = sourceFilesIn(BLOCKS_LIB).map((f) => readFileSync(f, 'utf-8'));

/** Every regex metacharacter, not just the `-` a utility name happens to contain. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

function countUses(utility: string): number {
  const pattern = new RegExp(`\\b${escapeRegExp(utility)}\\b`, 'g');
  return sources.reduce((total, src) => total + (src.match(pattern)?.length ?? 0), 0);
}

/** The `{ utility: 'x', … uses: n }` rows the page ships, in source order. */
function publishedRows(source: string, arrayName: string): { utility: string; uses: number }[] {
  const start = source.indexOf(`const ${arrayName} = [`);
  if (start === -1) throw new Error(`${arrayName} not found in tokens/+page.svelte`);
  const end = source.indexOf('];', start);
  const body = source.slice(start, end);
  const rows: { utility: string; uses: number }[] = [];
  const row = /\{\s*utility:\s*'([^']+)'[^}]*?uses:\s*(\d+)\s*\}/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard exec-loop form.
  while ((m = row.exec(body)) !== null) rows.push({ utility: m[1], uses: Number(m[2]) });
  return rows;
}

const tokensPage = readFileSync(TOKENS_PAGE, 'utf-8');

describe('/customization/tokens — the `uses` column', () => {
  it('finds the blocks source to measure', () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  for (const arrayName of ['typographyScale', 'weightScale']) {
    const rows = publishedRows(tokensPage, arrayName);

    it(`${arrayName}: has rows to check`, () => {
      expect(rows.length).toBeGreaterThan(0);
    });

    for (const { utility, uses } of rows) {
      it(`${arrayName}: ${utility} really has ${uses} use(s) in blocks`, () => {
        const actual = countUses(utility);
        expect(
          actual,
          `The page publishes \`${utility} … uses: ${uses}\`, the blocks source has ${actual}.\n` +
            `Re-measure with the page's own method (word-bounded, every .ts/.svelte under\n` +
            `packages/blocks/src/lib, excluding tests) and update the row — a stale count here\n` +
            `is a factual claim about the library, and 0 renders as "nothing uses this".`
        ).toBe(uses);
      });
    }
  }

  it('renders 0 as an em-dash, so no row may carry a stale 0', () => {
    // The em-dash is what turns a wrong count into a wrong *category*; it is only
    // honest while every 0 above is verified against the source.
    expect(tokensPage).toContain(`{step.uses === 0 ? '—' : step.uses}`);
  });
});
