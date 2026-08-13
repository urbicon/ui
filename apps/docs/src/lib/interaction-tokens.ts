/**
 * Reads the interaction layer's tokens out of the shipped stylesheet so the
 * Token Reference cannot quote a value the library does not have.
 *
 * The duration/easing/shadow tables were hand-copied once and were already
 * incomplete on arrival (three easings and all six per-component aliases
 * missing). This is the same move `theme-preview.ts` makes for the palettes:
 * the page imports `interaction.css?raw` and renders what it parses, so a
 * retuned bezier or a new override point shows up without anyone editing a
 * table. The parser itself is shared with it — see `./css-declarations`.
 */

import { baseDeclarations } from './css-declarations';

export interface TokenRow {
  name: string;
  value: string;
}

const DURATION = /^--blocks-duration-[a-z]+$/;
const EASING = /^--blocks-ease-[a-z]+$/;
const SHADOW = /^--blocks-shadow-[a-z]+$/;
/**
 * Per-component aliases: `--blocks-<component>-duration|easing`, i.e. every
 * `--blocks-*-duration|easing` that is not the base scale itself. Matched by
 * shape, so a component added later appears without a docs edit.
 *
 * The component segment may itself be hyphenated. It reads as a detail and is
 * not: `--blocks-overlay-backdrop-enter-duration` and its three siblings are
 * the knobs for Dialog/Drawer/Toast motion, and a `[a-z]+` segment silently
 * dropped all four from the table while listing the single-word ones.
 */
const COMPONENT_ALIAS = /^--blocks-(?!duration-|ease-)[a-z][a-z-]*-(duration|easing)$/;
/**
 * The focus-ring knobs. `width` and `color` compose `--blocks-focus-ring`
 * itself; `offset` does not — it is applied separately as `outline-offset` by
 * the focus utilities in index.css. All three are override points, which is
 * what this table lists, but only two of them move the ring's own value.
 */
const FOCUS_RING = /^--blocks-focus-ring-(width|offset|color)$/;
/**
 * The press sink shared by Button, Badge's remove control and the Drawer /
 * Dialog close buttons. Its own name rather than a shape, because it is the one
 * motion knob that is neither a duration nor an easing: it is how FAR a held
 * control dips, and `1` switches the movement off while the paired shadow step
 * keeps reporting the press.
 */
const PRESS_SCALE = /^--blocks-press-scale$/;

export interface InteractionTokens {
  durations: TokenRow[];
  easings: TokenRow[];
  shadows: TokenRow[];
  overridePoints: TokenRow[];
}

export function parseInteractionTokens(css: string): InteractionTokens {
  const rows = baseDeclarations([css]);
  const pick = (re: RegExp) =>
    rows.filter((r) => re.test(r.name)).map(({ name, value }) => ({ name, value }));
  return {
    durations: pick(DURATION),
    easings: pick(EASING),
    shadows: pick(SHADOW),
    overridePoints: [...pick(COMPONENT_ALIAS), ...pick(FOCUS_RING), ...pick(PRESS_SCALE)]
  };
}
