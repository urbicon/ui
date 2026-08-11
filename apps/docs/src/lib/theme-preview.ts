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
 * name seeds the next round. That reaches `--blocks-shadow-tint → --color-shadow-*
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

export interface ParsedThemeRamps {
  primary: Record<number, string>;
  secondary: Record<number, string>;
  neutral: { shade: number; value: string }[];
  /** The `:root` knobs, when the theme sets them. `neutral.css` deliberately
   * sets neither — a grayscale chassis has no temperature to match — and then
   * the library defaults (black shadows, hue 240) are the right answer. */
  shadowTint?: string;
  neutralChromeHue?: string;
}

/**
 * Reads the three ramps and the two chroma knobs out of a shipped theme file
 * (imported `?raw`). The themes gallery renders these instead of approximating
 * the palettes with `generatePalette` — the approximation visibly disagreed
 * with the shipped values (Sunset/Rose chroma, Neutral's darkened 600), so
 * swatch dot, palette strip and live preview now all read the same source as
 * the consumer's `@import`.
 */
export function parseThemeRamps(css: string): ParsedThemeRamps {
  const primary: Record<number, string> = {};
  const secondary: Record<number, string> = {};
  const neutral: { shade: number; value: string }[] = [];
  const parsed: ParsedThemeRamps = { primary, secondary, neutral };

  for (const { name, value } of baseDeclarations([css])) {
    const stop = /^--color-(primary|secondary|neutral)-(\d+)$/.exec(name);
    if (stop) {
      if (stop[1] === 'neutral') neutral.push({ shade: Number(stop[2]), value });
      else if (stop[1] === 'primary') primary[Number(stop[2])] = value;
      else secondary[Number(stop[2])] = value;
      continue;
    }
    if (name === '--blocks-shadow-tint') parsed.shadowTint = value;
    else if (name === '--neutral-chrome-hue') parsed.neutralChromeHue = value;
  }

  return parsed;
}

export interface PreviewOptions {
  palette: Record<number, string>;
  secondaryPalette: Record<number, string>;
  chassis: { shade: number; value: string }[];
  /** Base radius scale (`--radius-xs` … `--radius-4xl`), when the scope moves it. */
  radii?: Record<string, string>;
  /** oklch `L C H` without alpha, as themes declare it on `:root`. */
  shadowTint?: string;
  neutralChromeHue?: string;
}

/**
 * The inline-style override set for a preview scope: what the caller re-tints,
 * followed by every library declaration that reads it (see the module header).
 *
 * `graph` defaults to the shipped stylesheets and is passed explicitly only by
 * the tests, which read `packages/blocks/src/lib/style/*` off disk — Vite
 * serves `.css` imports as empty modules outside a browser build, so the
 * default is empty under Vitest. An empty graph would emit a ramps-only scope,
 * i.e. exactly the half-broken preview this module exists to prevent, so it is
 * a hard error rather than a fallback.
 */
export function previewVars(options: PreviewOptions, graph: TokenGraph = LIBRARY_TOKENS): string {
  if (graph.declarations.length === 0) {
    throw new Error(
      'previewVars: empty token graph — the library stylesheets did not load, ' +
        'so no derived role would be re-declared and the preview would render ' +
        'the surrounding page’s theme.'
    );
  }
  return scopeVars(options, graph);
}

function scopeVars(options: PreviewOptions, graph: TokenGraph): string {
  const overrides: [name: string, value: string][] = [];
  for (const [shade, value] of Object.entries(options.palette)) {
    overrides.push([`--color-primary-${shade}`, value]);
  }
  for (const [shade, value] of Object.entries(options.secondaryPalette)) {
    overrides.push([`--color-secondary-${shade}`, value]);
  }
  for (const { shade, value } of options.chassis) {
    overrides.push([`--color-neutral-${shade}`, value]);
  }
  for (const [name, value] of Object.entries(options.radii ?? {})) {
    overrides.push([name, value]);
  }
  if (options.shadowTint) overrides.push(['--blocks-shadow-tint', options.shadowTint]);
  if (options.neutralChromeHue) {
    overrides.push(['--neutral-chrome-hue', options.neutralChromeHue]);
  }

  const derived = derivedDeclarations(
    graph,
    overrides.map(([name]) => name)
  );
  return [...overrides, ...derived.map((d): [string, string] => [d.name, d.value])]
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
}
