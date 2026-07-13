import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type FigmaToken, type FigmaTokenGroup, generateFigmaTokens } from './figma-token-export';

/**
 * Drift guard — the Figma export ships hardcoded values (it runs in the
 * browser and cannot read the CSS at runtime). This test parses the actual
 * token sources (`style/foundation.css` + `style/semantic.css`) and compares
 * them bidirectionally against the export: every CSS token must be exported
 * with the exact value, and every exported token must exist in the CSS.
 *
 * History: before this guard existed, the export silently drifted — pre-WCAG
 * success/danger ramps, missing info/warm-neutral palettes, a wrong radius
 * scale, and a stale `text.tertiary`. If this test fails, update
 * `figma-token-export.ts` to match the CSS (never the other way around).
 */

const foundationCss = readFileSync(resolve(import.meta.dirname, '../style/foundation.css'), 'utf8');
const semanticCss = readFileSync(resolve(import.meta.dirname, '../style/semantic.css'), 'utf8');

/** Extracts the body of the first block opened by `selector` (brace-matched). */
function extractBlock(css: string, selector: string): string {
  const startIdx = css.indexOf(selector);
  if (startIdx === -1) throw new Error(`Selector ${selector} not found`);
  const openBraceIdx = css.indexOf('{', startIdx);
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(openBraceIdx + 1, i - 1);
}

/** All `--custom-property: value;` declarations in a block, whitespace-collapsed. */
function parseDeclarations(block: string): Map<string, string> {
  const decls = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    decls.set(match[1], match[2].replace(/\s+/g, ' ').trim());
  }
  return decls;
}

/** Splits `light-dark(a, b)` at the top-level comma; null if not light-dark(). */
function lightDarkArgs(value: string): [light: string, dark: string] | null {
  if (!value.startsWith('light-dark(') || !value.endsWith(')')) return null;
  const inner = value.slice('light-dark('.length, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  return null;
}

/** `light-dark()` light branch, or the raw value for single-value tokens. */
function lightValue(value: string): string {
  return lightDarkArgs(value)?.[0] ?? value;
}

/** `var(--color-warm-neutral-500)` → `{color.warm-neutral.500}`; null for non-palette values. */
function foundationVarToFigmaRef(value: string): string | null {
  const match = /^var\(--color-([\w-]+)-(\d+)\)$/.exec(value);
  if (!match) return null;
  return `{color.${match[1]}.${match[2]}}`;
}

function isToken(node: FigmaToken | FigmaTokenGroup): node is FigmaToken {
  return typeof (node as FigmaToken).value === 'string';
}

/** Flattens a token group one level: `{ name: value }`. */
function tokenValues(group: FigmaTokenGroup): Map<string, string> {
  const result = new Map<string, string>();
  for (const [name, node] of Object.entries(group)) {
    if (!isToken(node)) throw new Error(`Expected leaf token at ${name}`);
    result.set(name, node.value);
  }
  return result;
}

const exported = generateFigmaTokens();
const foundationDecls = parseDeclarations(extractBlock(foundationCss, '@theme'));
const semanticDecls = parseDeclarations(extractBlock(semanticCss, '@theme'));

describe('figma-token-export — foundation color palettes', () => {
  // `--color-<palette>-<shade>` from foundation.css, grouped by palette.
  const cssPalettes = new Map<string, Map<string, string>>();
  for (const [name, value] of foundationDecls) {
    const match = /^color-([\w-]+)-(\d+)$/.exec(name);
    if (!match) continue;
    const palette = cssPalettes.get(match[1]) ?? new Map<string, string>();
    palette.set(match[2], value);
    cssPalettes.set(match[1], palette);
  }

  it('exports exactly the palettes defined in foundation.css', () => {
    expect(Object.keys(exported.color as FigmaTokenGroup).sort()).toEqual(
      [...cssPalettes.keys()].sort()
    );
  });

  it('parses the expected palettes from foundation.css (sanity)', () => {
    for (const palette of [
      'neutral',
      'primary',
      'secondary',
      'warm-neutral',
      'success',
      'warning',
      'danger',
      'info'
    ]) {
      expect(cssPalettes.has(palette), `palette ${palette} missing from CSS parse`).toBe(true);
    }
  });

  for (const [paletteName, shades] of cssPalettes) {
    it(`palette "${paletteName}" matches foundation.css shade-for-shade`, () => {
      const exportedShades = tokenValues(
        (exported.color as FigmaTokenGroup)[paletteName] as FigmaTokenGroup
      );
      expect([...exportedShades.keys()].sort()).toEqual([...shades.keys()].sort());
      for (const [shade, cssValue] of shades) {
        expect(exportedShades.get(shade), `color.${paletteName}.${shade}`).toBe(cssValue);
      }
    });
  }
});

describe('figma-token-export — semantic surface/text/border roles', () => {
  // Light branch of every `--color-(surface|text|border)-*` role in semantic.css.
  const cssRoles = new Map<string, Map<string, string>>();
  for (const [name, value] of semanticDecls) {
    const match = /^color-(surface|text|border)-([\w-]+)$/.exec(name);
    if (!match) continue;
    const category = cssRoles.get(match[1]) ?? new Map<string, string>();
    const light = lightValue(value);
    category.set(match[2], foundationVarToFigmaRef(light) ?? light);
    cssRoles.set(match[1], category);
  }

  it('exports exactly the categories surface/text/border', () => {
    expect(Object.keys(exported.semantic as FigmaTokenGroup).sort()).toEqual(
      [...cssRoles.keys()].sort()
    );
  });

  for (const [categoryName, roles] of cssRoles) {
    it(`category "${categoryName}" matches the light-mode branch of semantic.css`, () => {
      const exportedRoles = tokenValues(
        (exported.semantic as FigmaTokenGroup)[categoryName] as FigmaTokenGroup
      );
      expect([...exportedRoles.keys()].sort()).toEqual([...roles.keys()].sort());
      for (const [role, cssValue] of roles) {
        expect(exportedRoles.get(role), `semantic.${categoryName}.${role}`).toBe(cssValue);
      }
    });
  }
});

describe('figma-token-export — border radius scale', () => {
  // `--radius-*` from foundation.css: rem → px (1rem = 16px),
  // var(--radius-x) → {borderRadius.x} reference, px literals verbatim.
  const cssRadii = new Map<string, string>();
  for (const [name, value] of foundationDecls) {
    const match = /^radius-([\w-]+)$/.exec(name);
    if (!match) continue;
    const remMatch = /^([\d.]+)rem$/.exec(value);
    const varMatch = /^var\(--radius-([\w-]+)\)$/.exec(value);
    cssRadii.set(
      match[1],
      remMatch
        ? `${Number.parseFloat(remMatch[1]) * 16}px`
        : varMatch
          ? `{borderRadius.${varMatch[1]}}`
          : value
    );
  }

  it('matches foundation.css token-for-token (physical scale + semantic tiers)', () => {
    const exportedRadii = tokenValues(exported.borderRadius as FigmaTokenGroup);
    expect([...exportedRadii.keys()].sort()).toEqual([...cssRadii.keys()].sort());
    for (const [name, cssValue] of cssRadii) {
      expect(exportedRadii.get(name), `borderRadius.${name}`).toBe(cssValue);
    }
  });
});

/** Replaces every embedded `light-dark(a, b)` with its light argument `a`. */
function resolveEmbeddedLightDark(value: string): string {
  let out = value;
  let start = out.indexOf('light-dark(');
  while (start !== -1) {
    let depth = 0;
    let comma = -1;
    let i = start + 'light-dark('.length;
    for (; i < out.length; i++) {
      const ch = out[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0 && comma === -1) comma = i;
    }
    const light = out.slice(start + 'light-dark('.length, comma).trim();
    out = out.slice(0, start) + light + out.slice(i + 1);
    start = out.indexOf('light-dark(');
  }
  return out;
}

describe('figma-token-export — shadows', () => {
  // Light branch of `--color-shadow-*`, with the shadow tint resolved.
  // Shadow layers are top-level comma-separated with light-dark() wrapping
  // only the per-layer <color> (wrapping the whole list is invalid as a
  // box-shadow and rendered as none — fixed 2026-07-13), so the light
  // resolution substitutes each embedded light-dark() and keeps the layer
  // commas. The export uses rgba(); both sides normalize to oklch.
  // The tint is matched directly (not via extractBlock(':root')) — ':root'
  // also appears in comments before the actual rule, and
  // `var(--blocks-shadow-tint)` usages have no ':' after the name, so this
  // hits only the declaration.
  const shadowTint = /--blocks-shadow-tint:\s*([^;]+);/.exec(semanticCss)?.[1].trim();

  it('resolves the shadow tint from :root', () => {
    expect(shadowTint).toBe('0 0 0');
  });

  const cssShadows = new Map<string, string>();
  for (const [name, value] of semanticDecls) {
    const match = /^color-shadow-([\w-]+)$/.exec(name);
    if (!match) continue;
    cssShadows.set(
      match[1],
      resolveEmbeddedLightDark(value)
        .replaceAll('var(--blocks-shadow-tint)', shadowTint ?? '')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
    );
  }

  it('matches the light-mode branch of semantic.css layer-for-layer', () => {
    const exportedShadows = tokenValues(exported.shadow as FigmaTokenGroup);
    expect([...exportedShadows.keys()].sort()).toEqual([...cssShadows.keys()].sort());
    for (const [name, cssValue] of cssShadows) {
      const normalized = exportedShadows
        .get(name)!
        .replace(/rgba\(0,\s*0,\s*0,\s*([\d.]+)\)/g, 'oklch(0 0 0 / $1)')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ');
      expect(normalized, `shadow.${name}`).toBe(cssValue);
    }
  });
});

describe('figma-token-export — spacing', () => {
  // Blocks defines no custom spacing tokens; the export mirrors Tailwind 4's
  // default scale (4px per unit). No CSS source to diff against — guard the
  // arithmetic instead.
  it('follows the 4px-per-unit Tailwind default scale', () => {
    const exportedSpacing = tokenValues(exported.spacing as FigmaTokenGroup);
    expect(exportedSpacing.size).toBeGreaterThan(0);
    for (const [name, value] of exportedSpacing) {
      const unit = Number.parseInt(name, 10);
      expect(value, `spacing.${name}`).toBe(unit === 0 ? '0' : `${unit * 4}px`);
    }
  });
});

describe('figma-token-export — structure', () => {
  it('exposes the five documented top-level groups', () => {
    expect(Object.keys(exported)).toEqual([
      'color',
      'semantic',
      'spacing',
      'borderRadius',
      'shadow'
    ]);
  });
});
