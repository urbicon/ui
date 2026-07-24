import type { ThemeRegistrationRaw } from 'shiki';
import { describe, expect, it } from 'vitest';
import { editorialDark, editorialLight } from './shiki-editorial-themes';

/**
 * WCAG contrast guard for the editorial Shiki themes.
 *
 * The token foregrounds are hand-authored hex values — shiki has no token graph
 * to resolve — which is exactly the "hand-computed, drifts silently" failure
 * class that blocks' style/contrast.test.ts exists to prevent. This measures
 * every syntax scope's foreground against its panel ground and asserts WCAG AA
 * (4.5:1), so a future recolour that dips a token below AA fails HERE (a fast
 * unit test) instead of only surfacing on the e2e axe pass over a rendered page
 * — which, per the CodePanel exception history, only sampled some tokens.
 *
 * Zero-dependency by construction: the sRGB → WCAG-luminance → contrast-ratio
 * conversion is implemented here (same math as blocks' contrast.test.ts), not
 * pulled from a color library.
 */

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const s = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(s.slice(i, i + 2), 16)) as Rgb;
}

/** Gamma-encoded sRGB channel (0–255) → linear-light, per WCAG 2.x. */
function decodeSrgb(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * decodeSrgb(r) + 0.7152 * decodeSrgb(g) + 0.0722 * decodeSrgb(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.2 §1.4.3 — normal-size body text. */
const AA_NORMAL = 4.5;

/** The panel ground (editor.background) + one [label, foreground] per scope. */
function scopeCases(theme: ThemeRegistrationRaw): { bg: Rgb; cases: [string, Rgb][] } {
  const bgHex = theme.colors?.['editor.background'];
  const fgHex = theme.colors?.['editor.foreground'];
  if (!bgHex || !fgHex) throw new Error(`${theme.name}: missing editor.background/foreground`);

  const cases: [string, Rgb][] = [['editor.foreground', hexToRgb(fgHex)]];
  for (const entry of theme.settings ?? []) {
    const fg = entry.settings?.foreground;
    if (!fg) continue;
    const label = Array.isArray(entry.scope) ? entry.scope.join(', ') : String(entry.scope ?? '?');
    cases.push([label, hexToRgb(fg)]);
  }
  return { bg: hexToRgb(bgHex), cases };
}

describe.each([
  ['editorial-light', editorialLight],
  ['editorial-dark', editorialDark]
] as const)('%s — every syntax token clears WCAG AA on the panel ground', (_name, theme) => {
  const { bg, cases } = scopeCases(theme);

  it('discovers every scope with a foreground (guard has teeth)', () => {
    // Lower bound: the theme carries the full editorial palette. If a refactor
    // drops the settings array, this fails rather than vacuously passing.
    expect(cases.length).toBeGreaterThanOrEqual(11);
  });

  it.each(cases)('%s', (_scope, fg) => {
    const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
    expect(ratio, `${_scope} measures ${ratio}:1, below AA ${AA_NORMAL}:1`).toBeGreaterThanOrEqual(
      AA_NORMAL
    );
  });
});
