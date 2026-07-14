import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards two quantified claims on /customization/tokens against the shipped themes.
 *
 * The page asserted "Every shipped theme sets both" of the chroma knobs while
 * neutral.css — a shipped theme — has no `:root` block at all and sets neither, by
 * design (themes/index.css says so explicitly). Prose that counts the themes has to
 * be checked against the themes.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLE = resolve(__dirname, '..', '..', '..', '..', '..', 'packages/blocks/src/lib/style');
const THEMES = join(STYLE, 'themes');
const TOKENS_PAGE = readFileSync(resolve(__dirname, 'tokens', '+page.svelte'), 'utf-8');

const themesAvailable = existsSync(THEMES);

/** Shipped theme files — the ones themes/index.css lists as available. */
const themeFiles = themesAvailable
  ? readdirSync(THEMES).filter((f) => f.endsWith('.css') && f !== 'index.css')
  : [];

const KNOBS = ['--blocks-shadow-tint', '--neutral-chrome-hue'] as const;

function setsKnobs(file: string): boolean {
  const css = readFileSync(join(THEMES, file), 'utf-8');
  return KNOBS.every((knob) => new RegExp(`^\\s*${knob}\\s*:`, 'm').test(css));
}

describe.skipIf(!themesAvailable)('theme-level chroma knobs', () => {
  it('exactly the four coloured themes set both knobs; Neutral sets neither', () => {
    const setting = themeFiles.filter(setsKnobs).sort();
    const notSetting = themeFiles.filter((f) => !setsKnobs(f)).sort();

    expect(setting).toEqual(['forest.css', 'ocean.css', 'rose.css', 'sunset.css']);
    expect(notSetting).toEqual(['neutral.css']);
  });

  it('the page does not claim every shipped theme sets them', () => {
    // The exact sentence that was false. Kept as a literal so the claim cannot
    // quietly return; the assertion above is what checks the substance.
    expect(TOKENS_PAGE).not.toContain('Every shipped theme sets both');
  });
});

describe.skipIf(!existsSync(join(STYLE, 'foundation.css')))('the neutral chassis ramp', () => {
  const foundation = readFileSync(join(STYLE, 'foundation.css'), 'utf-8');
  const stops = [...foundation.matchAll(/^\s*--color-neutral-(\d+)\s*:/gm)].map((m) =>
    Number(m[1])
  );

  it('has 16 stops, of which 15 are re-tintable (neutral-0 is pure white)', () => {
    // The page tells readers to re-tint "all 15 stops (25–950)". 16 exist; the 16th
    // is --color-neutral-0: oklch(1 0 0), left hueless by every shipped theme —
    // tinting it tints the reader's white.
    expect(stops.length).toBe(16);
    expect(stops).toContain(0);
    expect(/--color-neutral-0\s*:\s*oklch\(1 0 0\)/.test(foundation)).toBe(true);

    const retintable = stops.filter((s) => s !== 0);
    expect(retintable.length).toBe(15);
    expect(Math.min(...retintable)).toBe(25);
    expect(Math.max(...retintable)).toBe(950);
  });

  it('a shipped theme re-tints exactly those 15', () => {
    const forest = readFileSync(join(THEMES, 'forest.css'), 'utf-8');
    const declared = [...forest.matchAll(/^\s*--color-neutral-(\d+)\s*:/gm)].map((m) =>
      Number(m[1])
    );
    expect(declared.length).toBe(15);
    expect(declared).not.toContain(0);
  });
});
