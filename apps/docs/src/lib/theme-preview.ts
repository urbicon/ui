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
 * scale ever change in a re-tint. */
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
 * the real file. */
const CHASSIS_ROLES: Record<string, [light: number, dark: number]> = {
  'surface-quiet': [25, 850],
  'surface-elevated': [50, 800],
  'surface-subtle': [50, 800],
  'surface-hover': [100, 750],
  'surface-active': [200, 700],
  'surface-interactive': [100, 700],
  'surface-interactive-hover': [200, 650],
  'text-primary': [900, 100],
  'text-secondary': [700, 300],
  'text-tertiary': [600, 300],
  'text-quaternary': [500, 400],
  'border-subtle': [200, 700],
  'border-default': [300, 600],
  'border-emphasis': [400, 500],
  'border-strong': [500, 400]
};

/* Same for the accent role tokens. */
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

export const SEMANTIC_MIRROR = { CHASSIS_ROLES, ACCENT_ROLES };

export interface ParsedThemeRamps {
  primary: Record<number, string>;
  secondary: Record<number, string>;
  neutral: { shade: number; value: string }[];
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
  const ramp = (name: string) => {
    const out: Record<number, string> = {};
    for (const match of css.matchAll(
      new RegExp(`--color-${name}-(\\d+):\\s*(oklch\\([^)]+\\))`, 'g')
    )) {
      out[Number(match[1])] = match[2];
    }
    return out;
  };
  const neutral = ramp('neutral');
  return {
    primary: ramp('primary'),
    secondary: ramp('secondary'),
    neutral: Object.entries(neutral).map(([shade, value]) => ({
      shade: Number(shade),
      value
    }))
  };
}

/**
 * Roles that also derive from the primary ramp but are NOT re-declared by
 * `previewVars` (the preview stages render none of them): surface-selected,
 * chart-1, interactive-hover/-active/-focus. A scope that shows selections,
 * charts or focus rings has to re-declare those too — the Scoped Themes
 * section on /customization/themes names this boundary.
 */

/**
 * The inline-style override set for a preview scope: the three re-tinted ramps
 * plus re-declarations of every role token that derives from them. The
 * re-declaration is needed because a `var()` inside a `:root` token definition
 * substitutes at the cascade level where it is defined — overriding the ramps
 * alone would not re-resolve `--color-primary` & co. in the preview subtree.
 */
export function previewVars(options: {
  palette: Record<number, string>;
  secondaryPalette: Record<number, string>;
  chassis: { shade: number; value: string }[];
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
  for (const [role, [light, dark]] of Object.entries(CHASSIS_ROLES)) {
    vars.push(
      `--color-${role}: light-dark(var(--color-neutral-${light}), var(--color-neutral-${dark}))`
    );
  }
  return vars.join('; ');
}
