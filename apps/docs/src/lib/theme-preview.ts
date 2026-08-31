/**
 * Palette model shared by the two theme-simulating pages,
 * /customization/themes and /customization/theme-builder.
 *
 * Both pages previously carried their own copy of the palette generator, the
 * neutral ramp and the semantic re-declaration block, and the copies drifted
 * (an 11-stop vs a 15-stop ramp). Worse, both pinned the light branch of every
 * chassis-derived token, so on a dark page the previews half-broke: unreadable
 * labels, light card islands, glaring separators.
 *
 * ── Why a preview scope needs re-declarations at all ────────────────────────
 * A custom property substitutes its `var()` references where it is DECLARED.
 * The library declares its roles in one `@theme` block, which Tailwind emits at
 * `:root`, so `--color-primary` is resolved against the DEFAULT ramp up there
 * and inherits downward already-resolved. Re-tinting `--color-primary-*` on a
 * preview container therefore changes nothing until every token that reads the
 * ramp is re-declared, verbatim, in the same scope.
 *
 * ── Why this is derived and not a list ──────────────────────────────────────
 * Which tokens those are used to be four hand-written tables in this file,
 * guarded by a 150-line test that diffed them against semantic.css. The tables
 * still missed `--color-text-on-primary`, `--color-chart-4`, the shadow chain
 * and the whole neutral-intent chrome — a mirror is only ever as complete as
 * its last edit, and the gate was paying rent on the duplication rather than
 * removing it. So the set is now COMPUTED: seed it with what the preview
 * overrides, then take the transitive closure over the shipped stylesheets —
 * every declaration whose value reads a seeded name joins the set, and its own
 * name seeds the next round. That reaches `--blocks-shadow-tint → --blocks-shadow-scale-*
 * → --blocks-shadow-*` and `--neutral-chrome-hue → --color-neutral*` without
 * anyone naming a link, and a role the library adds tomorrow arrives on its own.
 *
 * `apps/docs/scripts/gen-livery-shim.ts` solves the same substitution problem
 * for the landing-page liveries, generatively and for the same stated reason.
 * The two extractors are deliberately not shared yet — that is a follow-up.
 *
 * ── One thing the scope does NOT keep ───────────────────────────────────────
 * An inline declaration on the container beats every `:root` declaration,
 * including those inside `@media print` / `prefers-contrast: more`. Inside a
 * preview, the accessibility overrides for the re-declared roles therefore do
 * not apply. That is acceptable here — the exhibit's job is to show the theme
 * — but it is not the "they keep applying as everywhere else" this file used
 * to claim.
 */

import { baseDeclarations, derivedDeclarations, type TokenGraph } from './css-declarations';
import { LIBRARY_TOKENS } from './library-tokens';

/** Formats an oklch() color, rounding away float artifacts (0.12 × 0.87 must
 * never print as 0.10439999999999999 in copy-paste output). */
export function oklch(l: number, c: number, h: number): string {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

/** The lightness/chroma profile of an accent ramp. 500 is the only stop whose
 * lightness callers tune (the builder's Lightness slider); everything else is
 * fixed so WCAG-tuned contrast survives a re-tint. */
export function generatePalette(hue: number, chroma: number, l500 = 0.58): Record<number, string> {
  return {
    50: oklch(0.95, chroma * 0.2, hue),
    100: oklch(0.9, chroma * 0.33, hue),
    200: oklch(0.82, chroma * 0.53, hue),
    300: oklch(0.74, chroma * 0.73, hue),
    400: oklch(0.66, chroma * 0.87, hue),
    500: oklch(l500, chroma, hue),
    600: oklch(0.52, chroma, hue),
    700: oklch(0.44, chroma * 0.87, hue),
    800: oklch(0.36, chroma * 0.73, hue),
    900: oklch(0.28, chroma * 0.53, hue),
    950: oklch(0.18, chroma * 0.33, hue)
  };
}

/** Foundation neutral ramp — lightness + base chroma per stop, including the
 * 25 quiet-surface tint and the 650/750/850 half-steps that differentiate the
 * dark-mode elevation ladder. Mirrors foundation.css; only hue and a chroma
 * scale ever change in a re-tint. `--color-neutral-0` is deliberately absent:
 * it is pure white and no theme re-tints it. */
export const neutralRamp = [
  { shade: 25, l: 0.985, c: 0.003 },
  { shade: 50, l: 0.965, c: 0.006 },
  { shade: 100, l: 0.95, c: 0.008 },
  { shade: 200, l: 0.89, c: 0.012 },
  { shade: 300, l: 0.83, c: 0.014 },
  { shade: 400, l: 0.7, c: 0.015 },
  { shade: 500, l: 0.55, c: 0.016 },
  { shade: 600, l: 0.42, c: 0.017 },
  { shade: 650, l: 0.38, c: 0.016 },
  { shade: 700, l: 0.32, c: 0.016 },
  { shade: 750, l: 0.28, c: 0.014 },
  { shade: 800, l: 0.23, c: 0.015 },
  { shade: 850, l: 0.18, c: 0.014 },
  { shade: 900, l: 0.15, c: 0.012 },
  { shade: 950, l: 0.08, c: 0.008 }
] as const;

/** The one neutral stop that is never re-tinted: pure white. Roles whose light
 * branch reads it (surface-base, text-inverted, text-on-fill…) resolve it from
 * `:root` inside a preview scope, which is exactly right. */
export const UNTINTED_NEUTRAL_STOP = 0;

/** Re-tinted chassis. `tint` scales the (already tiny) per-stop chroma:
 * 1 = the foundation profile at the new hue, 0 = pure grayscale. */
export function generateChassis(hue: number, tint = 1): { shade: number; value: string }[] {
  return neutralRamp.map(({ shade, l, c }) => ({
    shade,
    value: oklch(l, c * tint, hue)
  }));
}

export interface ParsedTheme {
  /** EVERYTHING the theme file declares, in document order — the ramps, the
   * re-tuned intent ramps, the `:root` chroma knobs. This is what a preview
   * scope applies: the theme, not a chosen subset of it. */
  declarations: { name: string; value: string }[];
  /** The three ramps the gallery draws swatches from, keyed by stop. */
  primary: Record<number, string>;
  secondary: Record<number, string>;
  neutral: { shade: number; value: string }[];
}

/**
 * Reads a shipped theme file (imported `?raw`). The themes gallery renders
 * these instead of approximating the palettes with `generatePalette` — the
 * approximation visibly disagreed with the shipped values (Sunset/Rose chroma,
 * Neutral's darkened 600), so swatch dot, palette strip and live preview all
 * read the same source as the consumer's `@import`.
 *
 * `declarations` is deliberately unfiltered. A theme is not only its accent
 * ramps: forest.css re-tunes the whole `success` ramp to hue 172 and `warning`
 * to 60, precisely because its green primary would otherwise be
 * indistinguishable from a success state — and a preview that dropped those
 * would exhibit the collision the file exists to avoid, right beside the prose
 * telling the reader to fix it.
 */
export function parseTheme(css: string): ParsedTheme {
  const primary: Record<number, string> = {};
  const secondary: Record<number, string> = {};
  const neutral: { shade: number; value: string }[] = [];
  const declarations = baseDeclarations([css]).map(({ name, value }) => ({ name, value }));

  for (const { name, value } of declarations) {
    const stop = /^--color-(primary|secondary|neutral)-(\d+)$/.exec(name);
    if (!stop) continue;
    if (stop[1] === 'neutral') neutral.push({ shade: Number(stop[2]), value });
    else if (stop[1] === 'primary') primary[Number(stop[2])] = value;
    else secondary[Number(stop[2])] = value;
  }

  return { declarations, primary, secondary, neutral };
}

/**
 * The library's base radius scale, read out of the shipped stylesheets: every
 * `--radius-<step>` whose value is a plain rem length, in file order.
 *
 * Derived rather than copied because the builder's whole job is to hand a
 * consumer a correct override block: a hand-kept `{ xs: 0.125, … }` that
 * disagrees with foundation.css emits a scale that is no longer the multiple of
 * the library's it claims to be, silently. The tier tokens are excluded by the
 * same test that excludes them from a preview scope — `--radius-commit` and
 * `--radius-control` are `9999px` literals, `--radius-modify` & co. read the
 * scale — so no tier name is hardcoded here either.
 */
export function baseRadiusScale(graph: TokenGraph = LIBRARY_TOKENS): Record<string, number> {
  const scale: Record<string, number> = {};
  for (const { name, value } of graph.declarations) {
    const step = /^--radius-([a-z0-9]+)$/.exec(name);
    const rem = step && /^([\d.]+)rem$/.exec(value);
    if (step && rem) scale[step[1]] = Number(rem[1]);
  }
  return scale;
}

/** `--color-<family>-<stop>` declarations for a generated ramp. Shared by the
 * builder's preview scope and its copy-paste output, so the two cannot name a
 * stop differently. */
export function rampDeclarations(
  family: string,
  stops: Record<number | string, string>
): [name: string, value: string][] {
  return Object.entries(stops).map(([stop, value]) => [`--color-${family}-${stop}`, value]);
}

/**
 * The inline-style override set for a preview scope: what the caller declares,
 * followed by every library declaration that reads it (see the module header).
 *
 * `overrides` is the scope's own declarations, in the order they should appear.
 * A duplicate name keeps its FIRST value — the caller's list is the authority
 * on what the scope sets, and letting a later repeat win would silently undo it.
 *
 * `graph` defaults to the shipped stylesheets and is passed explicitly only by
 * the tests, which read `packages/blocks/src/lib/style/*` off disk — Vite
 * serves `.css` imports as empty modules outside a browser build, so the
 * default is empty under Vitest. An empty graph would emit a ramps-only scope,
 * i.e. exactly the half-broken preview this module exists to prevent, so it is
 * a hard error rather than a fallback.
 */
export function previewVars(
  overrides: Iterable<readonly [name: string, value: string]>,
  graph: TokenGraph = LIBRARY_TOKENS
): string {
  if (graph.declarations.length === 0) {
    throw new Error(
      'previewVars: empty token graph — the library stylesheets did not load, ' +
        'so no derived role would be re-declared and the preview would render ' +
        'the surrounding page’s theme.'
    );
  }

  const scope = new Map<string, string>();
  for (const [name, value] of overrides) if (!scope.has(name)) scope.set(name, value);

  const derived = derivedDeclarations(graph, scope.keys());
  return [...scope, ...derived.map((d): [string, string] => [d.name, d.value])]
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
}
