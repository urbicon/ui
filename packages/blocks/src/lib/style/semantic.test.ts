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

  /**
   * A hover token that resolves to its own resting value is not a subtle bug —
   * it is *no* hover. `bg-surface-interactive hover:bg-surface-hover` shipped
   * that way: identical in light mode (both neutral-100), so every filled
   * Input/Textarea/Select/Combobox had no hover feedback at all where most
   * users are. The same shape hit `-active` in dark mode. Both are only
   * detectable by comparing resolved values, which no visual test does — a
   * no-op hover looks exactly like a working one in a static screenshot.
   */
  describe('interaction fills step away from their resting value', () => {
    const PAIRS = [
      ['--color-surface-interactive', '--color-surface-interactive-hover'],
      ['--color-surface-base', '--color-surface-hover'],
      ['--color-surface-hover', '--color-surface-active']
    ] as const;

    it.each(PAIRS)('%s and %s resolve differently in both modes', (restToken, stepToken) => {
      const rest = findLightDark(themeBlock, restToken);
      const step = findLightDark(themeBlock, stepToken);
      expect(rest, `${restToken} missing or not in light-dark() form`).not.toBeNull();
      expect(step, `${stepToken} missing or not in light-dark() form`).not.toBeNull();

      expect(
        step!.light,
        `${stepToken} resolves to the same value as ${restToken} in LIGHT mode — ` +
          `any hover/press built on this pair is a silent no-op there`
      ).not.toEqual(rest!.light);
      expect(
        step!.dark,
        `${stepToken} resolves to the same value as ${restToken} in DARK mode — ` +
          `any hover/press built on this pair is a silent no-op there`
      ).not.toEqual(rest!.dark);
    });
  });

  /**
   * The pair guard above only proves a step differs from ONE resting value.
   * That is not enough: an element on a reading surface does not know which
   * one it sits on. A `ghost` Input renders on the page (base), inside a
   * Popover (elevated), in a Dialog (overlay) or in a tinted zone (quiet) —
   * the same class string, four different backdrops. `surface-subtle` passed
   * a pair check against `surface-base` and was still invisible as a hover on
   * every elevated surface, because it resolves to `surface-elevated` exactly.
   * That shipped across 8 components until 2026-07-26.
   *
   * So the real contract for a hover/press step is: it must differ from
   * EVERY reading surface, in both modes. A token that fails this is not a
   * hover token, whatever it is named.
   */
  describe('interaction steps differ from every reading surface', () => {
    const READING_SURFACES = [
      '--color-surface-base',
      '--color-surface-quiet',
      '--color-surface-elevated',
      '--color-surface-overlay',
      '--color-surface-subtle'
    ] as const;
    const STEPS = ['--color-surface-hover', '--color-surface-active'] as const;

    const CASES = STEPS.flatMap((step) =>
      READING_SURFACES.map((surface) => [step, surface] as const)
    );

    it.each(CASES)('%s is distinguishable on %s', (stepToken, surfaceToken) => {
      const step = findLightDark(themeBlock, stepToken);
      const surface = findLightDark(themeBlock, surfaceToken);
      expect(step, `${stepToken} missing or not in light-dark() form`).not.toBeNull();
      expect(surface, `${surfaceToken} missing or not in light-dark() form`).not.toBeNull();

      for (const mode of ['light', 'dark'] as const) {
        expect(
          step![mode],
          `${stepToken} resolves to ${surfaceToken} in ${mode.toUpperCase()} mode — ` +
            `any element hovering while resting on ${surfaceToken} shows no feedback at all`
        ).not.toEqual(surface![mode]);
      }
    });
  });
});
