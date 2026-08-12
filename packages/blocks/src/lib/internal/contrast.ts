/**
 * Foreground colour for a consumer-supplied background (INTERNAL).
 *
 * Any component that paints a surface from a colour the *consumer* chose —
 * `CalendarEventCategory.color`, `TimelineCategory.color` — has to pick the
 * label colour itself, because a semantic token cannot know what it will sit
 * on. This module owns that decision for the whole package.
 *
 * It lived in `Calendar/calendar.engine.ts` until ResourceTimeline became its
 * second caller. Importing it from there would have been a **value** import
 * across two component families, in a spot `imports:lint` is structurally blind
 * to (it only tracks PascalCase component edges), and it would have coupled a
 * component whose whole point is to add nothing to the Calendar neighbourhood
 * back onto Calendar's engine. `calendar.engine.ts` re-exports the name so
 * Calendar's own sub-components (and their tests) keep their import path.
 */

/**
 * Determine whether text on a given background color should be light or dark.
 * Supports hex (#rgb, #rrggbb), rgb(), oklch(), and CSS named colors.
 * Returns 'white' or 'black' based on perceived luminance.
 */
export function getContrastTextColor(bgColor: string): 'white' | 'black' {
  // Try to parse oklch
  const oklchMatch = bgColor.match(/oklch\(\s*([\d.]+)/);
  if (oklchMatch) {
    const lightness = parseFloat(oklchMatch[1]);
    // oklch lightness: 0 = black, 1 = white
    return lightness > 0.6 ? 'black' : 'white';
  }

  // Try to parse hex
  const hexMatch = bgColor.match(/^#?([\da-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Relative luminance approximation
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  }

  // Try to parse rgb/rgba
  const rgbMatch = bgColor.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  }

  // Default: assume dark background
  return 'white';
}
