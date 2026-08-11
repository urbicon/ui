/**
 * Generates the semantic-token shim that makes a livery work on a CONTAINER.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * A custom property substitutes its `var()` references on the element where it
 * is DECLARED, and the result is what inherits. The library declares its
 * semantic tokens in one `@theme` block, which Tailwind emits at `:root`:
 *
 *   --color-surface-elevated: light-dark(var(--color-neutral-50), var(--color-neutral-800));
 *
 * so `--color-surface-elevated` is resolved against the DEFAULT ramp at `:root`
 * and inherits downward already-resolved. Re-pointing `--color-neutral-*` on a
 * container further down changes nothing: that value was computed before the
 * container existed.
 *
 * On the full page this is invisible, because the livery sits on `<html>` — the
 * same element the `@theme` block landed on, so the cascade picks the livery's
 * ramp and the semantic tokens resolve against it. It only bites when a livery
 * is scoped to a tile, which is exactly what an exhibit in a landing row needs.
 * Symptom: the chat bubbles stay library-blue inside a violet house.
 *
 * ── The fix ─────────────────────────────────────────────────────────────────
 * Re-declare every ramp-derived semantic token under `[data-livery]`, verbatim.
 * Same formulas, new declaration site — so they resolve against whatever ramp
 * that element carries.
 *
 * Generated rather than hand-copied because there are ~80 of them and a hand
 * list would drift silently the next time the library adds a token: the tile
 * would keep rendering, just with one stale colour nobody traces back.
 *
 * Run after changing `packages/blocks/src/lib/style/semantic.css`:
 *   bun apps/docs/scripts/gen-livery-shim.ts
 */

const SOURCE = new URL('../../../packages/blocks/src/lib/style/semantic.css', import.meta.url)
  .pathname;
const OUT = new URL('../src/lib/livery/livery-shim.gen.css', import.meta.url).pathname;

const css = await Bun.file(SOURCE).text();

// Only the `@theme` block: the later `:root` rules carry `color-scheme` and the
// shadow tint, which a livery sets for itself, and the `prefers-contrast`
// overrides must keep their own media conditions rather than be flattened here.
const themeStart = css.indexOf('@theme {');
if (themeStart === -1) throw new Error('no @theme block in semantic.css');

let depth = 0;
let themeEnd = -1;
for (let i = css.indexOf('{', themeStart); i < css.length; i++) {
  if (css[i] === '{') depth++;
  else if (css[i] === '}') {
    depth--;
    if (depth === 0) {
      themeEnd = i;
      break;
    }
  }
}
if (themeEnd === -1) throw new Error('unterminated @theme block');
/**
 * Two things this slice has to get right, both of which it got wrong:
 *
 *  - it starts AFTER the opening brace. Starting at `@theme {` puts the block
 *    header in the first buffer, so the first declaration reads
 *    `@theme { --color-surface-base: …`, fails the `startsWith('--')` filter
 *    below, and vanishes. The base page surface — the most consequential token
 *    in the file — was missing from every livery for exactly that reason;
 *  - comments come out BEFORE the split, not after. A `;` inside comment prose
 *    ends a "declaration" in the middle of it, and the real declaration then
 *    starts with the comment's tail rather than `--`, so it is dropped too.
 *
 * Measured against the previous output: 65 declarations, should have been 70.
 */
const theme = css
  .slice(css.indexOf('{', themeStart) + 1, themeEnd)
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every declaration whose value reads a foundation ramp. Tokens that do not
 * (spacing, z-index, durations) are left alone — they are ramp-independent, so
 * re-declaring them would only add noise and another thing to drift.
 */
const RAMP = /var\(--color-(?:neutral|primary|secondary|success|warning|danger|info)-/;
const declarations: string[] = [];

// Declarations can span lines (`light-dark(\n  a,\n  b\n)`), so split on `;` at
// depth 0 rather than on newlines.
let buffer = '';
let parens = 0;
for (const ch of theme) {
  if (ch === '(') parens++;
  if (ch === ')') parens--;
  if (ch === ';' && parens === 0) {
    declarations.push(buffer);
    buffer = '';
    continue;
  }
  buffer += ch;
}

const kept = declarations
  .map((d) => d.replace(/\/\*[\s\S]*?\*\//g, '').trim())
  .filter((d) => d.startsWith('--') && RAMP.test(d))
  .map((d) => `  ${d.replace(/\s+/g, ' ')};`);

if (kept.length === 0) throw new Error('extracted no ramp-derived declarations — check the parser');

const out = `/*
 * GENERATED — do not edit. Source: packages/blocks/src/lib/style/semantic.css
 * Regenerate: bun apps/docs/scripts/gen-livery-shim.ts
 *
 * Re-declares every ramp-derived semantic token on the livery element, so a
 * livery scoped to a CONTAINER resolves them against its own ramp instead of
 * inheriting values already computed at :root. See the generator's header for
 * why this is necessary and when it is not.
 *
 * The extra \`:root[data-livery]\` alternative is for PAGE scope: there the
 * livery sits on <html> next to the app shell's \`.docs-rooms\` class, whose
 * room theming re-declares the primary family at the same (0,1,0) specificity
 * — source order then decides, and the app bundle wins. (0,2,0) settles it in
 * the house's favour without touching the docs skin anywhere else. Found on
 * the salon full page, where every primary fill rendered docs-orange in all
 * four liveries; the tiles never showed it because a tile is a child element
 * and its own declarations beat anything inherited from :root.
 *
 * ${kept.length} declarations.
 */
:root[data-livery],
[data-livery] {
${kept.join('\n')}
}
`;

await Bun.write(OUT, out);
process.stdout.write(`✓ ${kept.length} declarations → ${OUT}\n`);
