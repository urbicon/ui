/**
 * Foreground colour for a consumer-supplied background (INTERNAL).
 *
 * Any component that paints a surface from a colour the *consumer* chose —
 * a `DateCategory.color`, a chart series colour — has to pick the label colour
 * itself, because a semantic token cannot know what it will sit on. This module
 * owns that decision for the whole package.
 *
 * It lived in `Calendar/calendar.engine.ts` until ResourceTimeline became its
 * second caller. Importing it from there would have been a **value** import
 * across two component families, in a spot `imports:lint` is structurally blind
 * to (it only tracks PascalCase component edges), and it would have coupled a
 * component whose whole point is to add nothing to the Calendar neighbourhood
 * back onto Calendar's engine. `calendar.engine.ts` re-exports the name so
 * Calendar's own sub-components (and their tests) keep their import path.
 */

/** sRGB channel (0–1, gamma-encoded) → linear light, per WCAG 2. */
function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2 relative luminance of LINEAR sRGB channels, clipped to the gamut. */
function luminance(r: number, g: number, b: number): number {
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return 0.2126 * clip(r) + 0.7152 * clip(g) + 0.0722 * clip(b);
}

function luminanceFromSrgb255(r: number, g: number, b: number): number {
  return luminance(linearize(r / 255), linearize(g / 255), linearize(b / 255));
}

/**
 * OKLCH → linear sRGB (Björn Ottosson's OKLab matrices). An out-of-gamut colour
 * is clipped per channel, which is not the CSS gamut mapping a browser applies
 * (that reduces chroma instead), so near the white/black crossover the pick for
 * such a colour can differ from what the rendered pixels would warrant.
 */
function luminanceFromOklch(l: number, c: number, hDeg: number): number {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return luminance(
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  );
}

/** Relative luminance of `color`, or `null` when this module cannot read it. */
function relativeLuminance(color: string): number | null {
  const oklch = color.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)/i);
  if (oklch) {
    const l = Number.parseFloat(oklch[1]) / (oklch[2] ? 100 : 1);
    const chroma = Number.parseFloat(oklch[3]);
    // CSS Color 4: a chroma percentage is relative to 0.4.
    const c = oklch[4] ? (chroma / 100) * 0.4 : chroma;
    return luminanceFromOklch(l, c, Number.parseFloat(oklch[5]));
  }

  const hex = color.trim().match(/^#?([\da-f]{3,8})$/i);
  if (hex) {
    let digits = hex[1];
    // #rgb / #rgba expand per digit; #rrggbbaa drops its alpha. Five and seven
    // digits are not colours.
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits.slice(0, 3)].map((d) => d + d).join('');
    } else if (digits.length === 6 || digits.length === 8) {
      digits = digits.slice(0, 6);
    } else {
      return null;
    }
    return luminanceFromSrgb255(
      Number.parseInt(digits.slice(0, 2), 16),
      Number.parseInt(digits.slice(2, 4), 16),
      Number.parseInt(digits.slice(4, 6), 16)
    );
  }

  const rgb = color.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
  if (rgb) {
    return luminanceFromSrgb255(
      Number.parseInt(rgb[1], 10),
      Number.parseInt(rgb[2], 10),
      Number.parseInt(rgb[3], 10)
    );
  }

  return null;
}

/**
 * The label colour — white or black — with the higher WCAG 2 contrast ratio
 * against `bgColor`. Reads hex (#rgb, #rgba, #rrggbb, #rrggbbaa; alpha ignored),
 * rgb()/rgba() and oklch(). Anything else — hsl(), a named colour, a
 * `var(--…)` token, a color-mix() — cannot be resolved without the page, and
 * gets white.
 */
export function getContrastTextColor(bgColor: string): 'white' | 'black' {
  const l = relativeLuminance(bgColor);
  if (l === null) return 'white';
  const onWhite = 1.05 / (l + 0.05);
  const onBlack = (l + 0.05) / 0.05;
  return onBlack > onWhite ? 'black' : 'white';
}
