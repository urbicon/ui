/**
 * Figma Token Export Utility
 *
 * Generates a Tokens Studio-compatible JSON export from the Urbicon UI
 * OKLCH design token system. Suitable for Figma plugins like "Tokens Studio
 * for Figma" (formerly Figma Tokens).
 *
 * The values below mirror the token truth in `../style/foundation.css`
 * (palettes, radii) and `../style/semantic.css` (surface/text/border roles,
 * shadows). They are hardcoded — this module runs in the browser and cannot
 * read the CSS files at runtime — but guarded against drift by the
 * co-located `figma-token-export.test.ts`, which parses both CSS files and
 * compares every value. If you change a token in the CSS, that test fails
 * until the export here is updated to match.
 *
 * Semantic tokens resolve light/dark via CSS `light-dark()`; this export
 * carries the **light-mode** resolution (Figma has no mode-aware token
 * values in plain Tokens Studio JSON). Dark mode swaps at the foundation
 * layer, so the palette ramps below contain every shade both modes use.
 */

export interface FigmaToken {
  value: string;
  type: string;
  description?: string;
}

export interface FigmaTokenGroup {
  [key: string]: FigmaToken | FigmaTokenGroup;
}

const foundationColors: Record<string, Record<string, string>> = {
  neutral: {
    '0': 'oklch(1 0 0)',
    '25': 'oklch(0.985 0.003 240)',
    '50': 'oklch(0.965 0.006 240)',
    '100': 'oklch(0.95 0.008 240)',
    '200': 'oklch(0.89 0.012 240)',
    '300': 'oklch(0.83 0.014 240)',
    '400': 'oklch(0.7 0.015 240)',
    '500': 'oklch(0.55 0.016 240)',
    '600': 'oklch(0.42 0.017 240)',
    '650': 'oklch(0.38 0.016 240)',
    '700': 'oklch(0.32 0.016 240)',
    '750': 'oklch(0.28 0.014 240)',
    '800': 'oklch(0.23 0.015 240)',
    '850': 'oklch(0.18 0.014 240)',
    '900': 'oklch(0.15 0.012 240)',
    '950': 'oklch(0.08 0.008 240)'
  },
  primary: {
    '50': 'oklch(0.95 0.03 240)',
    '100': 'oklch(0.9 0.05 240)',
    '200': 'oklch(0.82 0.08 240)',
    '300': 'oklch(0.74 0.11 240)',
    '400': 'oklch(0.66 0.13 240)',
    '500': 'oklch(0.58 0.15 240)',
    '600': 'oklch(0.52 0.15 240)',
    '700': 'oklch(0.44 0.13 240)',
    '800': 'oklch(0.36 0.11 240)',
    '900': 'oklch(0.28 0.08 240)',
    '950': 'oklch(0.18 0.05 240)'
  },
  secondary: {
    '50': 'oklch(0.95 0.03 280)',
    '100': 'oklch(0.9 0.05 280)',
    '200': 'oklch(0.82 0.08 280)',
    '300': 'oklch(0.74 0.11 280)',
    '400': 'oklch(0.66 0.13 280)',
    '500': 'oklch(0.55 0.12 280)',
    '600': 'oklch(0.48 0.13 280)',
    '700': 'oklch(0.4 0.12 280)',
    '800': 'oklch(0.32 0.1 280)',
    '900': 'oklch(0.25 0.08 280)',
    '950': 'oklch(0.18 0.05 280)'
  },
  'warm-neutral': {
    '50': 'oklch(0.96 0.004 45)',
    '100': 'oklch(0.92 0.006 45)',
    '200': 'oklch(0.86 0.008 45)',
    '300': 'oklch(0.78 0.01 45)',
    '400': 'oklch(0.65 0.012 45)',
    '500': 'oklch(0.5 0.008 45)',
    '600': 'oklch(0.42 0.01 45)',
    '700': 'oklch(0.35 0.012 45)',
    '800': 'oklch(0.28 0.01 45)',
    '900': 'oklch(0.2 0.008 45)',
    '950': 'oklch(0.12 0.006 45)'
  },
  /* success/danger 400–700 are the WCAG-darkened ramps: white text on the
     solid intent backgrounds passes AA (4.5:1). */
  success: {
    '50': 'oklch(0.95 0.03 140)',
    '100': 'oklch(0.9 0.05 140)',
    '200': 'oklch(0.82 0.08 140)',
    '300': 'oklch(0.74 0.11 140)',
    '400': 'oklch(0.62 0.14 140)',
    '500': 'oklch(0.5 0.15 140)',
    '600': 'oklch(0.44 0.14 140)',
    '700': 'oklch(0.38 0.12 140)',
    '800': 'oklch(0.3 0.1 140)',
    '900': 'oklch(0.22 0.08 140)',
    '950': 'oklch(0.14 0.05 140)'
  },
  warning: {
    '50': 'oklch(0.95 0.05 80)',
    '100': 'oklch(0.9 0.08 80)',
    '200': 'oklch(0.82 0.1 80)',
    '300': 'oklch(0.74 0.12 80)',
    '400': 'oklch(0.66 0.14 80)',
    '500': 'oklch(0.75 0.15 80)',
    '600': 'oklch(0.65 0.15 80)',
    '700': 'oklch(0.59 0.13 80)',
    '800': 'oklch(0.45 0.11 80)',
    '900': 'oklch(0.25 0.08 80)',
    '950': 'oklch(0.15 0.05 80)'
  },
  danger: {
    '50': 'oklch(0.95 0.05 25)',
    '100': 'oklch(0.9 0.08 25)',
    '200': 'oklch(0.82 0.1 25)',
    '300': 'oklch(0.74 0.12 25)',
    '400': 'oklch(0.62 0.16 25)',
    '500': 'oklch(0.5 0.17 25)',
    '600': 'oklch(0.44 0.16 25)',
    '700': 'oklch(0.38 0.14 25)',
    '800': 'oklch(0.3 0.12 25)',
    '900': 'oklch(0.22 0.1 25)',
    '950': 'oklch(0.14 0.07 25)'
  },
  info: {
    '50': 'oklch(0.96 0.025 220)',
    '100': 'oklch(0.92 0.045 220)',
    '200': 'oklch(0.84 0.075 220)',
    '300': 'oklch(0.76 0.105 220)',
    '400': 'oklch(0.66 0.13 220)',
    '500': 'oklch(0.54 0.14 220)',
    '600': 'oklch(0.48 0.13 220)',
    '700': 'oklch(0.4 0.11 220)',
    '800': 'oklch(0.32 0.09 220)',
    '900': 'oklch(0.24 0.07 220)',
    '950': 'oklch(0.16 0.05 220)'
  }
};

/** Light-mode resolution of the semantic color roles in semantic.css. */
const semanticTokens = {
  surface: {
    base: { value: '{color.neutral.0}', description: 'L1 — the page itself' },
    quiet: { value: '{color.neutral.25}', description: 'L0 — ground beneath the page' },
    elevated: { value: '{color.neutral.50}', description: 'L2 — lifted surfaces (popover, menu)' },
    overlay: { value: '{color.neutral.0}', description: 'L3 — dialog/drawer/toast background' },
    interactive: { value: '{color.neutral.100}', description: 'Interactive control background' },
    'interactive-hover': {
      value: '{color.neutral.200}',
      description: 'Hover step for an interactive control fill'
    },
    hover: { value: '{color.neutral.100}', description: 'Hover state background' },
    active: { value: '{color.neutral.200}', description: 'Active/pressed state background' },
    disabled: { value: '{color.neutral.100}', description: 'Disabled surface' },
    selected: { value: '{color.primary.50}', description: 'Selected item background' },
    subtle: { value: '{color.neutral.50}', description: 'Subtle background' },
    inverted: { value: '{color.neutral.900}', description: 'Inverted surface' }
  },
  text: {
    primary: { value: '{color.neutral.900}', description: 'Primary text' },
    inverted: { value: '{color.neutral.0}', description: 'Inverted text (on dark bg)' },
    secondary: { value: '{color.neutral.700}', description: 'Secondary text' },
    tertiary: { value: '{color.neutral.600}', description: 'Tertiary text (WCAG AA on base)' },
    quaternary: { value: '{color.neutral.500}', description: 'Quaternary text (lowest emphasis)' },
    disabled: { value: '{color.neutral.500}', description: 'Disabled text' },
    'on-dark': { value: '{color.neutral.0}', description: 'Text on dark surfaces' },
    'on-fill': {
      value: '{color.neutral.0}',
      description: 'Text on any solid intent fill (success, danger, neutral, …)'
    },
    // A reference, not a copy: `--color-text-on-primary` is defined as
    // `var(--color-text-on-fill)`, so a theme that moves on-fill must move this
    // with it. Copying `{color.neutral.0}` here would silently decouple them.
    'on-primary': {
      value: '{semantic.text.on-fill}',
      description: 'Text on the primary fill specifically — an alias of on-fill'
    },
    'on-warning': {
      value: '{color.warning.950}',
      description: 'Text on the warning fill (warm dark in both modes)'
    },
    'on-surface': { value: '{color.neutral.900}', description: 'Text on tinted surfaces' }
  },
  border: {
    hairline: {
      value: 'rgb(0 0 0 / 0.08)',
      description: 'Quietest structural divider (rows, separators)'
    },
    subtle: { value: '{color.neutral.200}', description: 'Subtle border' },
    default: { value: '{color.neutral.300}', description: 'Default border' },
    emphasis: { value: '{color.neutral.400}', description: 'Emphasized border' },
    strong: { value: '{color.neutral.500}', description: 'Strong border' }
  }
};

/* Tailwind 4 default spacing scale (4px per unit) — blocks defines no
   custom spacing tokens. */
const spacingTokens: Record<string, string> = {
  '0': '0',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px'
};

/* Physical radius scale + the semantic 3-tier vocabulary (commit/modify/
   contain, plus the bridge adjacency radius) from foundation.css.
   rem values are exported as px (1rem = 16px) for Figma. */
const borderRadiusTokens: Record<string, string | { value: string; description: string }> = {
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  '4xl': '32px',
  commit: { value: '9999px', description: 'Tier: actions, identity, status (pill)' },
  // The radio indicator owns its shape rather than inheriting the tier's —
  // squaring the pill must not turn a radio into something that reads as a
  // checkbox. See the --radius-control note in foundation.css.
  control: { value: '9999px', description: 'Radio indicator — convention, not a tier choice' },
  modify: { value: '{borderRadius.sm}', description: 'Tier: editable surfaces, navigation' },
  contain: { value: '{borderRadius.xs}', description: 'Tier: containers, panels, layout' },
  bridge: { value: '{borderRadius.md}', description: 'Adjacency radius: panel anchored to a pill' }
};

/** Light-mode resolution of the shadow tokens (shadow tint = pure black). */
const shadowTokens: Record<string, string> = {
  xs: '0 1px 2px 0 rgba(0,0,0,0.05)',
  sm: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  base: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  md: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
  lg: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
};

function buildColorTokens(): FigmaTokenGroup {
  const result: FigmaTokenGroup = {};
  for (const [name, shades] of Object.entries(foundationColors)) {
    result[name] = {};
    for (const [shade, value] of Object.entries(shades)) {
      (result[name] as FigmaTokenGroup)[shade] = {
        value,
        type: 'color'
      };
    }
  }
  return result;
}

function buildSemanticTokens(): FigmaTokenGroup {
  const result: FigmaTokenGroup = {};
  for (const [category, tokens] of Object.entries(semanticTokens)) {
    result[category] = {};
    for (const [name, def] of Object.entries(tokens)) {
      (result[category] as FigmaTokenGroup)[name] = {
        value: def.value,
        type: 'color',
        description: def.description
      };
    }
  }
  return result;
}

function buildSpacingTokens(): FigmaTokenGroup {
  const result: FigmaTokenGroup = {};
  for (const [name, value] of Object.entries(spacingTokens)) {
    result[name] = { value, type: 'spacing' };
  }
  return result;
}

function buildBorderRadiusTokens(): FigmaTokenGroup {
  const result: FigmaTokenGroup = {};
  for (const [name, def] of Object.entries(borderRadiusTokens)) {
    result[name] =
      typeof def === 'string'
        ? { value: def, type: 'borderRadius' }
        : { value: def.value, type: 'borderRadius', description: def.description };
  }
  return result;
}

function buildShadowTokens(): FigmaTokenGroup {
  const result: FigmaTokenGroup = {};
  for (const [name, value] of Object.entries(shadowTokens)) {
    result[name] = { value, type: 'boxShadow' };
  }
  return result;
}

export function generateFigmaTokens(): FigmaTokenGroup {
  return {
    color: buildColorTokens(),
    semantic: buildSemanticTokens(),
    spacing: buildSpacingTokens(),
    borderRadius: buildBorderRadiusTokens(),
    shadow: buildShadowTokens()
  };
}

export function generateFigmaTokensJSON(pretty = true): string {
  return JSON.stringify(generateFigmaTokens(), null, pretty ? 2 : undefined);
}
