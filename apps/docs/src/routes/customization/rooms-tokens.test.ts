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
 * Declarations by the rule they sit in. Asking the parser for the selector
 * beats slicing the file: `.docs-rooms` is only the first rule by convention,
 * and a `String.slice` between two `indexOf`s silently returns nothing the day
 * someone adds a `@font-face` above it — leaving the gate to fail with "found
 * both sides to compare" while pointing at the wrong file.
 */
const roomsLayer = parseDeclarations(css).filter(
  // Matched by containment, not equality: the file uses selector LISTS
  // (`.docs-rooms, .docs-rooms .docs-room-scope`) and data-attribute variants,
  // and every one of them is the Rooms layer declaring its own tokens. Depth 1
  // still excludes the at-rule blocks.
  (d) => d.depth === 1 && d.selector.includes('.docs-rooms')
);

/** The `--docs-*` namespace as the layer declares it, first value per name. */
const tokens = [
  ...new Map(roomsLayer.filter((d) => d.name.startsWith('--docs-')).map((d) => [d.name, d.value]))
].map(([name, value]) => ({ name, value }));

/** `<code>NAME</code></td> … <code>VALUE</code>` — one row of either table. */
function tableRows(prefix: string): Map<string, string> {
  const pattern = new RegExp(
    `<code>(${prefix}[a-z0-9-]+)</code></td>\\s*<td[^>]*><code>([^<]+)</code>`,
    'g'
  );
  return new Map([...page.matchAll(pattern)].map((m) => [m[1], m[2]]));
}

const rows = tableRows('--docs-');

describe('the --docs-* catalogue on /customization/rooms-theme', () => {
  it('found both sides to compare', () => {
    expect(tokens.length).toBeGreaterThan(8);
    expect(rows.size).toBeGreaterThan(8);
  });

  it('has a row for every token rooms-docs.css declares', () => {
    expect(
      tokens.filter((t) => !rows.has(t.name)).map((t) => t.name),
      'a new base token needs a catalogue row — or, if it is plumbing a reader ' +
        'never reaches for, an exception listed here with the reason'
    ).toEqual([]);
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
      const effective = resolveWithinNamespace(value);
      const pair = /^light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)$/i.exec(effective);
      if (pair) {
        // Printed as `light · dark`; the separator is the page's, the hexes are
        // the file's.
        if (!row.includes(pair[1]) || !row.includes(pair[2]))
          wrong.push(`${name}: ${row} ≠ ${effective}`);
        continue;
      }
      if (effective.startsWith('var(')) {
        // An alias pointing OUT of the namespace — at a library token. There the
        // indirection is the statement ("this couples to --color-primary"), so
        // the row has to name it.
        if (row.trim() !== effective) wrong.push(`${name}: ${row} ≠ ${effective}`);
      }
      // Anything else (rgb() alpha pairs, color-mix) is paraphrased on purpose.
    }
    expect(wrong).toEqual([]);
  });
});

describe('the library-semantic-override table below it', () => {
  // Same drift class, second table: it lists which library token Color Rooms
  // re-points at which `--docs-*` value. Only the rows whose target the file
  // states as a plain alias are checked — `--color-primary` resolves through
  // the room-accent ramp and the table names the accent, which is the useful
  // answer rather than the literal one.
  const remaps = new Map(
    roomsLayer
      .filter((d) => d.name.startsWith('--color-') && /^var\(--docs-[a-z-]+\)$/.test(d.value))
      .map((d) => [d.name, d.value])
  );
  const listed = tableRows('--color-');

  it('found rows and remaps to compare', () => {
    expect(remaps.size).toBeGreaterThan(4);
    expect(listed.size).toBeGreaterThan(4);
  });

  it('quotes the alias rooms-docs.css actually points each token at', () => {
    const wrong: string[] = [];
    for (const [name, value] of remaps) {
      const row = listed.get(name);
      if (row && row.trim() !== value) wrong.push(`${name}: ${row} ≠ ${value}`);
    }
    expect(wrong).toEqual([]);
  });

  it('lists no library token the file does not re-point', () => {
    const declared = new Set(roomsLayer.map((d) => d.name));
    expect([...listed.keys()].filter((name) => !declared.has(name))).toEqual([]);
  });
});

/**
 * Follows a `var(--docs-…)` chain while it stays inside the namespace, and
 * returns what the token ultimately resolves to.
 *
 * Without this, a token refactored into an alias — `--docs-soft` becoming
 * `var(--docs-soft-paper)` — would force the catalogue to print the indirection
 * instead of the colour, which is the one thing a reader of a colour catalogue
 * does not want. The gate should hold the page to the truth, not to the file's
 * current shape.
 */
function resolveWithinNamespace(value: string): string {
  const byName = new Map(tokens.map((t) => [t.name, t.value]));
  const seen = new Set<string>();
  let current = value;
  for (;;) {
    const alias = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(current);
    if (!alias || seen.has(alias[1])) return current;
    const target = byName.get(alias[1]);
    if (target === undefined) return current;
    seen.add(alias[1]);
    current = target;
  }
}
