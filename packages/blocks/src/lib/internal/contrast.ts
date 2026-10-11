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

/** A colour as gamma-encoded sRGB channels (0–1) plus alpha (0–1). */
type Rgba = { r: number; g: number; b: number; a: number };

/** sRGB channel (0–1, gamma-encoded) → linear light, per WCAG 2. */
function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Linear light → gamma-encoded sRGB channel, clipped to the gamut. */
function encode(linear: number): number {
  const v = Math.min(1, Math.max(0, linear));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** WCAG 2 relative luminance. */
function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2 contrast ratio between two relative luminances. */
function ratio(l1: number, l2: number): number {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** `color` painted over an opaque backdrop, composited in sRGB as browsers do. */
function over(color: Rgba, backdrop: number): Rgba {
  const mix = (c: number) => c * color.a + backdrop * (1 - color.a);
  return { r: mix(color.r), g: mix(color.g), b: mix(color.b), a: 1 };
}

/**
 * OKLCH → sRGB (Björn Ottosson's OKLab matrices). An out-of-gamut colour is
 * clipped per channel, as Chromium paints it on an sRGB display; on a
 * wide-gamut display the painted colour lies outside sRGB and the pick near the
 * white/black crossover can be off.
 */
function fromOklch(l: number, c: number, hDeg: number, alpha: number): Rgba {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: encode(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: encode(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: encode(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    a: alpha
  };
}

/** A CSS number or `none` (which CSS Color 4 resolves to 0). */
const NUM = '(-?[\\d.]+|none)';
const num = (value: string) => (value === 'none' ? 0 : Number.parseFloat(value));

/** An alpha component (absent, a number or a percentage) as 0–1. */
function alphaOf(value: string | undefined, percent: string | undefined): number {
  if (value === undefined) return 1;
  return Math.min(1, Math.max(0, num(value) / (percent ? 100 : 1)));
}

/** Degrees per unit of a CSS hue; a unitless hue is in degrees. */
const HUE_UNIT: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

// Anchored: the whole value has to be the colour. A colour nested in a
// color-mix() or a var() fallback is not the colour that gets painted.
const OKLCH = new RegExp(
  `^\\s*oklch\\(\\s*${NUM}(%?)\\s+${NUM}(%?)\\s+${NUM}(deg|grad|rad|turn)?\\s*(?:\\/\\s*${NUM}(%?))?\\s*\\)\\s*$`,
  'i'
);
const RGB = /^\s*rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)\s*$/i;
const HEX = /^\s*#?([\da-f]{3,8})\s*$/i;

/** `color` as sRGB plus alpha, or `null` when this module cannot read it. */
function parse(color: string): Rgba | null {
  const oklch = color.match(OKLCH);
  if (oklch) {
    const l = num(oklch[1]) / (oklch[2] ? 100 : 1);
    // CSS Color 4: a chroma percentage is relative to 0.4.
    const c = oklch[4] ? (num(oklch[3]) / 100) * 0.4 : num(oklch[3]);
    const hue = num(oklch[5]) * HUE_UNIT[(oklch[6] ?? 'deg').toLowerCase()];
    return fromOklch(l, c, hue, alphaOf(oklch[7], oklch[8]));
  }

  const hex = color.match(HEX);
  if (hex) {
    let digits = hex[1];
    // #rgb / #rgba expand per digit. Five and seven digits are not colours.
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((d) => d + d).join('');
    } else if (digits.length !== 6 && digits.length !== 8) {
      return null;
    }
    const byte = (i: number) => Number.parseInt(digits.slice(i, i + 2), 16) / 255;
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) : 1 };
  }

  const rgb = color.match(RGB);
  if (rgb) {
    const channel = (i: number) => Math.min(255, Number.parseInt(rgb[i], 10)) / 255;
    return { r: channel(1), g: channel(2), b: channel(3), a: alphaOf(rgb[4], rgb[5]) };
  }

  return null;
}

/**
 * The label colour — white or black — with the higher WCAG 2 contrast ratio
 * against `bgColor`. Reads hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba()
 * and oklch(), each the whole value. A translucent colour is judged on what can
 * show through it: painted over white and over black, and the ink whose worse
 * ratio of the two is higher wins. It gives white for everything else: a
 * `var(--…)` token or a color-mix(), which only the page can resolve, and hsl()
 * or a named colour, which this module does not parse.
 */
export function getContrastTextColor(bgColor: string): 'white' | 'black' {
  const color = parse(bgColor);
  if (color === null) return 'white';
  const grounds = (color.a < 1 ? [over(color, 1), over(color, 0)] : [color]).map(luminance);
  const worst = (ink: number) => Math.min(...grounds.map((ground) => ratio(ink, ground)));
  return worst(0) > worst(1) ? 'black' : 'white';
}
