/**
 * Figma Token Export Utility
 *
 * Generates a Tokens Studio-compatible JSON export from the Urbicon UI
 * OKLCH design token system. Suitable for Figma plugins like "Tokens Studio
 * for Figma" (formerly Figma Tokens).
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
    '50': 'oklch(0.98 0.005 240)',
    '100': 'oklch(0.95 0.008 240)',
    '200': 'oklch(0.89 0.012 240)',
    '300': 'oklch(0.83 0.014 240)',
    '400': 'oklch(0.7 0.015 240)',
    '500': 'oklch(0.55 0.016 240)',
    '600': 'oklch(0.42 0.017 240)',
    '700': 'oklch(0.32 0.016 240)',
    '800': 'oklch(0.23 0.015 240)',
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
  success: {
    '50': 'oklch(0.95 0.03 140)',
    '100': 'oklch(0.9 0.05 140)',
    '200': 'oklch(0.82 0.08 140)',
    '300': 'oklch(0.74 0.11 140)',
    '400': 'oklch(0.66 0.13 140)',
    '500': 'oklch(0.65 0.15 140)',
    '600': 'oklch(0.55 0.15 140)',
    '700': 'oklch(0.45 0.13 140)',
    '800': 'oklch(0.35 0.11 140)',
    '900': 'oklch(0.25 0.08 140)',
    '950': 'oklch(0.15 0.05 140)'
  },
  warning: {
    '50': 'oklch(0.95 0.05 80)',
    '100': 'oklch(0.9 0.08 80)',
    '200': 'oklch(0.82 0.1 80)',
    '300': 'oklch(0.74 0.12 80)',
    '400': 'oklch(0.66 0.14 80)',
    '500': 'oklch(0.75 0.15 80)',
    '600': 'oklch(0.65 0.15 80)',
    '700': 'oklch(0.55 0.13 80)',
    '800': 'oklch(0.45 0.11 80)',
    '900': 'oklch(0.25 0.08 80)',
    '950': 'oklch(0.15 0.05 80)'
  },
  danger: {
    '50': 'oklch(0.95 0.05 25)',
    '100': 'oklch(0.9 0.08 25)',
    '200': 'oklch(0.82 0.1 25)',
    '300': 'oklch(0.74 0.12 25)',
    '400': 'oklch(0.66 0.14 25)',
    '500': 'oklch(0.65 0.18 25)',
    '600': 'oklch(0.55 0.15 25)',
    '700': 'oklch(0.45 0.13 25)',
    '800': 'oklch(0.35 0.11 25)',
    '900': 'oklch(0.25 0.08 25)',
    '950': 'oklch(0.15 0.05 25)'
  }
};

const semanticTokens = {
  surface: {
    base: { value: '{color.neutral.0}', description: 'Page background' },
    raised: { value: '{color.neutral.50}', description: 'Slightly elevated surface' },
    elevated: { value: '{color.neutral.50}', description: 'Elevated surface (cards)' },
    overlay: { value: '{color.neutral.0}', description: 'Dialog/popover background' },
    subtle: { value: '{color.neutral.50}', description: 'Subtle background' },
    inverted: { value: '{color.neutral.900}', description: 'Inverted surface' }
  },
  text: {
    primary: { value: '{color.neutral.900}', description: 'Primary text' },
    secondary: { value: '{color.neutral.700}', description: 'Secondary text' },
    tertiary: { value: '{color.neutral.500}', description: 'Tertiary text' },
    disabled: { value: '{color.neutral.300}', description: 'Disabled text' },
    inverted: { value: '{color.neutral.0}', description: 'Inverted text (on dark bg)' },
    'on-primary': { value: '{color.neutral.0}', description: 'Text on primary color bg' }
  },
  border: {
    subtle: { value: '{color.neutral.200}', description: 'Subtle border' },
    default: { value: '{color.neutral.300}', description: 'Default border' },
    emphasis: { value: '{color.neutral.400}', description: 'Emphasized border' },
    strong: { value: '{color.neutral.500}', description: 'Strong border' }
  }
};

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

const borderRadiusTokens: Record<string, string> = {
  none: '0',
  sm: '2px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px'
};

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
  for (const [name, value] of Object.entries(borderRadiusTokens)) {
    result[name] = { value, type: 'borderRadius' };
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
