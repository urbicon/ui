/**
 * Reads the interaction layer's tokens out of the shipped stylesheet so the
 * Token Reference cannot quote a value the library does not have.
 *
 * The duration/easing/shadow tables were hand-copied once and were already
 * incomplete on arrival (three easings and all six per-component aliases
 * missing). This is the same move `theme-preview.ts` makes for the palettes:
 * the page imports `interaction.css?raw` and renders what it parses, so a
 * retuned bezier or a new override point shows up without anyone editing a
 * table.
 */

export interface TokenRow {
  name: string;
  value: string;
}

/**
 * Every custom-property declaration in document order, first occurrence only.
 * The base `:root` block comes first in the file, so the `@media print` /
 * `prefers-reduced-motion` re-declarations below it never shadow a base value.
 */
export function parseDeclarations(css: string): TokenRow[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const seen = new Set<string>();
  const rows: TokenRow[] = [];
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    const name = match[1];
    if (seen.has(name)) continue;
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let end = start;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) break;
    }
    seen.add(name);
    rows.push({ name, value: source.slice(start, end).trim().replace(/\s+/g, ' ') });
  }
  return rows;
}

const DURATION = /^--blocks-duration-[a-z]+$/;
const EASING = /^--blocks-ease-[a-z]+$/;
const SHADOW = /^--blocks-shadow-[a-z]+$/;
/** Per-component aliases: `--blocks-<component>-duration|easing`, i.e. every
 * `--blocks-*-duration` that is not the base scale itself. Matched by shape,
 * so a component added later appears without a docs edit. */
const COMPONENT_ALIAS = /^--blocks-(?!duration-|ease-)[a-z]+-(duration|easing)$/;
/** The three focus-ring knobs the composed ring is built from. */
const FOCUS_RING = /^--blocks-focus-ring-(width|offset|color)$/;

export interface InteractionTokens {
  durations: TokenRow[];
  easings: TokenRow[];
  shadows: TokenRow[];
  overridePoints: TokenRow[];
}

export function parseInteractionTokens(css: string): InteractionTokens {
  const rows = parseDeclarations(css);
  const pick = (re: RegExp) => rows.filter((r) => re.test(r.name));
  return {
    durations: pick(DURATION),
    easings: pick(EASING),
    shadows: pick(SHADOW),
    overridePoints: [...pick(COMPONENT_ALIAS), ...pick(FOCUS_RING)]
  };
}
