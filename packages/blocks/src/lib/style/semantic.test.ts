import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Token coverage test — regression guard for the light/dark token
 * definitions in semantic.css.
 *
 * The tokens use CSS-native `light-dark(light-arg, dark-arg)` instead of
 * duplicated :root.light/:root.dark blocks. This test verifies that for
 * every intent (primary, secondary, neutral, success, warning, danger,
 * info) all four suffixes (hover, active, subtle, emphasis) are defined
 * via light-dark() in the @theme block, plus the base token without a
 * suffix.
 *
 * If the test fails, an intent would be orphaned in its dark or light
 * branch — the same class of bug seen before the refactor, where some
 * tokens (e.g. active in dark, hover for several intents) were missing.
 */

const semanticCss = readFileSync(resolve(import.meta.dirname, './semantic.css'), 'utf8');

const INTENTS = [
  'primary',
  'secondary',
  'neutral',
  'success',
  'warning',
  'danger',
  'info'
] as const;
const REQUIRED_SUFFIXES = ['hover', 'active', 'subtle', 'emphasis'] as const;

function extractBlock(css: string, selector: string): string {
  const startIdx = css.indexOf(selector);
  if (startIdx === -1) {
    throw new Error(`Selector ${selector} not found in semantic.css`);
  }
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

function findLightDark(block: string, tokenName: string): { light: string; dark: string } | null {
  const escaped = tokenName.replace(/-/g, '\\-');
  const re = new RegExp(`${escaped}\\s*:\\s*light-dark\\(([^,]+),\\s*([^)]+)\\)`, 'm');
  const match = re.exec(block);
  if (!match) return null;
  return { light: match[1].trim(), dark: match[2].trim() };
}

describe('semantic.css — light-dark() intent token coverage', () => {
  const themeBlock = extractBlock(semanticCss, '@theme');

  describe.each(INTENTS)('intent: %s', (intent) => {
    it.each(REQUIRED_SUFFIXES)(`--color-${intent}-%s uses light-dark()`, (suffix) => {
      const token = `--color-${intent}-${suffix}`;
      const found = findLightDark(themeBlock, token);
      expect(found, `${token} missing or not in light-dark() form`).not.toBeNull();
      expect(found!.light, `${token} light arg empty`).toBeTruthy();
      expect(found!.dark, `${token} dark arg empty`).toBeTruthy();
      expect(found!.light, `${token} light and dark args identical (suspicious)`).not.toEqual(
        found!.dark
      );
    });

    it(`base --color-${intent} uses light-dark()`, () => {
      const token = `--color-${intent}`;
      const found = findLightDark(themeBlock, token);
      expect(found, `${token} missing or not in light-dark() form`).not.toBeNull();
    });
  });

  it(':root sets color-scheme: light dark', () => {
    expect(semanticCss).toMatch(/:root\s*{[^}]*color-scheme:\s*light\s+dark/);
  });

  it(':root.light overrides color-scheme', () => {
    expect(semanticCss).toMatch(/:root\.light\s*{[^}]*color-scheme:\s*light/);
  });

  it(':root.dark overrides color-scheme', () => {
    expect(semanticCss).toMatch(/:root\.dark\s*{[^}]*color-scheme:\s*dark/);
  });

  it('@media (prefers-contrast: more) is still defined', () => {
    expect(semanticCss).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
  });
});

describe('semantic.css — surface/border refinement tokens', () => {
  const themeBlock = extractBlock(semanticCss, '@theme');

  it('--color-surface-quiet uses light-dark() with distinct args', () => {
    const found = findLightDark(themeBlock, '--color-surface-quiet');
    expect(found, 'surface-quiet missing or not in light-dark() form').not.toBeNull();
    expect(found!.light).toBeTruthy();
    expect(found!.dark).toBeTruthy();
    expect(found!.light).not.toEqual(found!.dark);
  });

  it('--color-border-hairline uses light-dark() with distinct args', () => {
    const found = findLightDark(themeBlock, '--color-border-hairline');
    expect(found, 'border-hairline missing or not in light-dark() form').not.toBeNull();
    expect(found!.light).toBeTruthy();
    expect(found!.dark).toBeTruthy();
    expect(found!.light).not.toEqual(found!.dark);
  });

  it('--color-border-hairline is re-defined in @media (prefers-contrast: more)', () => {
    const contrastBlock = extractBlock(semanticCss, '@media (prefers-contrast: more)');
    expect(contrastBlock).toContain('--color-border-hairline');
  });
});
