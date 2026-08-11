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
 * The re-declarations here therefore keep the `light-dark(var(…), var(…))`
 * indirection of semantic.css instead of pinning resolved values — the preview
 * scope overrides the ramps, and the role tokens re-substitute against them in
 * both modes. The only mirrored knowledge is WHICH stop each role reads per
 * mode; theme-preview.test.ts parses semantic.css and fails on any divergence.
 */

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

/* Which neutral stop each chassis-derived role reads per mode, exactly as
 * semantic.css declares it. theme-preview.test.ts checks every entry against
 * the real file AND fails when semantic.css grows a neutral-derived role that
 * is missing here — the previews render more than surfaces and text, so an
 * omission shows up as a component still wearing the site's own chassis. */
const CHASSIS_ROLES: Record<string, [light: number, dark: number]> = {
  'surface-base': [0, 900],
  'surface-quiet': [25, 850],
  'surface-elevated': [50, 800],
  'surface-overlay': [0, 850],
  'surface-subtle': [50, 800],
  'surface-hover': [100, 750],
  'surface-active': [200, 700],
  'surface-disabled': [100, 800],
  'surface-inverted': [900, 100],
  'surface-interactive': [100, 700],
  'surface-interactive-hover': [200, 650],
  'text-primary': [900, 100],
  'text-secondary': [700, 300],
  'text-tertiary': [600, 300],
  'text-quaternary': [500, 400],
  'text-inverted': [0, 900],
  'text-disabled': [500, 500],
  'text-on-dark': [0, 900],
  'text-on-fill': [0, 900],
  'text-on-surface': [900, 100],
  'border-subtle': [200, 700],
  'border-default': [300, 600],
  'border-emphasis': [400, 500],
  'border-strong': [500, 400],
  'interactive-disabled': [200, 700]
};

/* Same for the accent role tokens, keyed by the ramp they read. */
const ACCENT_ROLES: Record<
  'primary' | 'secondary',
  Record<string, [light: number, dark: number]>
> = {
  primary: {
    '': [600, 500],
    '-hover': [700, 400],
    '-active': [800, 300],
    '-subtle': [50, 900],
    '-emphasis': [900, 200]
  },
  secondary: {
    '': [500, 400],
    '-hover': [600, 300],
    '-active': [700, 200],
    '-subtle': [50, 900],
    '-emphasis': [800, 200]
  }
};

/* Roles that read the primary ramp without carrying its name. */
const PRIMARY_RAMP_ROLES: Record<string, [light: number, dark: number]> = {
  'surface-selected': [50, 900],
  'chart-1': [600, 400],
  'interactive-focus': [500, 400]
};

/* Primary-derived roles written in relative-color syntax, which has no
 * stop pair to mirror. Held as exact strings and compared verbatim against
 * semantic.css by the test. */
const RELATIVE_PRIMARY_ROLES: Record<string, string> = {
  'interactive-hover': 'oklch(from var(--color-primary-500) l c h / 0.1)',
  'interactive-active': 'oklch(from var(--color-primary-500) l c h / 0.2)'
};

/**
 * Tier radius tokens that DERIVE from the base radius scale, and therefore
 * need re-declaring in any scope that overrides `--radius-xs…4xl`: a `var()`
 * inside a token defined on `:root` substitutes there, so overriding the base
 * alone leaves the tier on its old value. The same substitution trap the
 * colour roles above solve.
 *
 * `--radius-commit` and `--radius-control` are deliberately absent: they are
 * literals in foundation.css (`9999px`), so a base-radius override does not
 * move them — in a preview scope or in a consumer's `@theme`. The test fails
 * if either ever starts deriving from a base radius.
 */
export const DERIVED_RADIUS_TIERS: Record<string, string> = {
  '--radius-modify': 'var(--radius-sm)',
  '--radius-contain': 'var(--radius-xs)',
  '--radius-bridge': 'var(--radius-md)'
};

/** Tier tokens that stay put under a base-radius override, with the literal
 * foundation.css value the test pins them to. */
export const LITERAL_RADIUS_TIERS: Record<string, string> = {
  '--radius-commit': '9999px',
  '--radius-control': '9999px'
};

export const SEMANTIC_MIRROR = {
  CHASSIS_ROLES,
  ACCENT_ROLES,
  PRIMARY_RAMP_ROLES,
  RELATIVE_PRIMARY_ROLES
};

export interface ParsedThemeRamps {
  primary: Record<number, string>;
  secondary: Record<number, string>;
  neutral: { shade: number; value: string }[];
}

/** Strips CSS comments so prose like `… all shades 200–800 …` cannot be read
 * as a declaration. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Every `--color-<ramp>-<stop>` declaration and its full value. Scans to the
 * `;` at paren-depth zero rather than matching `oklch\([^)]+\)`, so a stop
 * written in relative-color syntax (`oklch(from var(--x) l c h)`) or with
 * `color-mix()` survives intact instead of being truncated at the inner `)`.
 */
function rampDeclarations(css: string, ramp: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const match of css.matchAll(new RegExp(`--color-${ramp}-(\\d+)\\s*:`, 'g'))) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let end = start;
    for (; end < css.length; end++) {
      const ch = css[end];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) break;
    }
    out[Number(match[1])] = css.slice(start, end).trim();
  }
  return out;
}

/**
 * Reads the three ramps out of a shipped theme file (imported `?raw`). The
 * themes gallery renders these instead of approximating the palettes with
 * `generatePalette` — the approximation visibly disagreed with the shipped
 * values (Sunset/Rose chroma, Neutral's darkened 600), so swatch dot, palette
 * strip and live preview now all read the same source as the consumer's
 * `@import`.
 */
export function parseThemeRamps(css: string): ParsedThemeRamps {
  const source = stripComments(css);
  const neutral = rampDeclarations(source, 'neutral');
  return {
    primary: rampDeclarations(source, 'primary'),
    secondary: rampDeclarations(source, 'secondary'),
    neutral: Object.entries(neutral).map(([shade, value]) => ({
      shade: Number(shade),
      value
    }))
  };
}

/**
 * The inline-style override set for a preview scope: the three re-tinted ramps
 * plus re-declarations of every role token that derives from them. The
 * re-declaration is needed because a `var()` inside a `:root` token definition
 * substitutes at the cascade level where it is defined — overriding the ramps
 * alone would not re-resolve `--color-primary` & co. in the preview subtree.
 *
 * Pass `radii` to override the base radius scale as well; the derived tier
 * tokens are re-declared alongside it for the same reason.
 */
export function previewVars(options: {
  palette: Record<number, string>;
  secondaryPalette: Record<number, string>;
  chassis: { shade: number; value: string }[];
  radii?: Record<string, string>;
}): string {
  const vars: string[] = [];
  for (const [shade, value] of Object.entries(options.palette)) {
    vars.push(`--color-primary-${shade}: ${value}`);
  }
  for (const [shade, value] of Object.entries(options.secondaryPalette)) {
    vars.push(`--color-secondary-${shade}: ${value}`);
  }
  for (const { shade, value } of options.chassis) {
    vars.push(`--color-neutral-${shade}: ${value}`);
  }
  for (const [intent, roles] of Object.entries(ACCENT_ROLES)) {
    for (const [suffix, [light, dark]] of Object.entries(roles)) {
      vars.push(
        `--color-${intent}${suffix}: light-dark(var(--color-${intent}-${light}), var(--color-${intent}-${dark}))`
      );
    }
  }
  for (const [role, [light, dark]] of Object.entries(PRIMARY_RAMP_ROLES)) {
    vars.push(
      `--color-${role}: light-dark(var(--color-primary-${light}), var(--color-primary-${dark}))`
    );
  }
  for (const [role, expression] of Object.entries(RELATIVE_PRIMARY_ROLES)) {
    vars.push(`--color-${role}: ${expression}`);
  }
  for (const [role, [light, dark]] of Object.entries(CHASSIS_ROLES)) {
    vars.push(
      `--color-${role}: light-dark(var(--color-neutral-${light}), var(--color-neutral-${dark}))`
    );
  }
  if (options.radii) {
    for (const [name, value] of Object.entries(options.radii)) {
      vars.push(`${name}: ${value}`);
    }
    for (const [name, value] of Object.entries(DERIVED_RADIUS_TIERS)) {
      vars.push(`${name}: ${value}`);
    }
  }
  return vars.join('; ');
}
