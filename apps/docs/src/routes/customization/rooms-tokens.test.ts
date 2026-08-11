import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDeclarations } from '../../lib/css-declarations';

/**
 * The Color Rooms case study prints a catalogue of the private `--docs-*`
 * namespace, and that catalogue is hand-written: the page and rooms-docs.css
 * are two copies of the same table. It had already drifted — `--docs-soft` was
 * still quoting the pre-contrast-fix pair, six months after the fix — and the
 * failure is silent, because the page renders a plausible colour either way.
 *
 * A generator would be the better answer and is not available here without
 * making the page worse: the value column is deliberately prose in places
 * (`ink/8% · cream/8%` for an rgba pair), and a case study is read, not
 * consulted. So the gate asks the real file instead: every base `--docs-*`
 * token must have a row, and every row whose value the file states plainly —
 * a light-dark() hex pair, a var() alias — must state it the same way.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, '../../lib/style/rooms-docs.css'), 'utf8');
const page = readFileSync(resolve(__dirname, 'rooms-theme/+page.svelte'), 'utf8');

/**
 * The base `.docs-rooms` block only. Later rules re-declare `--docs-soft` for
 * an inverted hero and add `--docs-measure` & co. for prose scopes; those are
 * scoped adjustments, not entries in the namespace catalogue.
 */
const baseBlock = css.slice(css.indexOf('.docs-rooms {'), css.indexOf('\n}\n'));

const tokens = parseDeclarations(baseBlock)
  .filter((d) => d.depth === 1 && d.name.startsWith('--docs-'))
  .map(({ name, value }) => ({ name, value }));

/** `<code>--docs-x</code></td> … <code>VALUE</code>` — the catalogue rows. */
const rows = new Map(
  [...page.matchAll(/<code>(--docs-[a-z-]+)<\/code><\/td>\s*<td[^>]*><code>([^<]+)<\/code>/g)].map(
    (m) => [m[1], m[2]]
  )
);

describe('the --docs-* catalogue on /customization/rooms-theme', () => {
  it('found both sides to compare', () => {
    expect(tokens.length).toBeGreaterThan(8);
    expect(rows.size).toBeGreaterThan(8);
  });

  it('has a row for every token rooms-docs.css declares', () => {
    expect(tokens.filter((t) => !rows.has(t.name)).map((t) => t.name)).toEqual([]);
  });

  it('invents no token rooms-docs.css does not declare', () => {
    const declared = new Set(tokens.map((t) => t.name));
    expect([...rows.keys()].filter((name) => !declared.has(name))).toEqual([]);
  });

  it('quotes the same colours and aliases the file states', () => {
    const wrong: string[] = [];
    for (const { name, value } of tokens) {
      const row = rows.get(name);
      if (!row) continue;
      const pair = /^light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)$/i.exec(value);
      if (pair) {
        // Printed as `light · dark`; the separator is the page's, the hexes are
        // the file's.
        if (!row.includes(pair[1]) || !row.includes(pair[2]))
          wrong.push(`${name}: ${row} ≠ ${value}`);
        continue;
      }
      if (value.startsWith('var(')) {
        if (row.trim() !== value) wrong.push(`${name}: ${row} ≠ ${value}`);
      }
      // Anything else (rgb() alpha pairs, color-mix) is paraphrased on purpose.
    }
    expect(wrong).toEqual([]);
  });
});
