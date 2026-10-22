/**
 * The element name for a heading `offset` ranks below `level`, clamped to
 * `h1`–`h6`.
 *
 * A rank outside the range would emit `<h0>` or `<h7>`, which is not a
 * heading at all, and a fractional one `<h2.5>`. A component's sub-headings
 * pass an `offset` of 1 rather than `level + 1`, which would turn `null` into
 * 1 and `'2'` into `'21'`; the clamp keeps the deepest of them at `h6`. A
 * level that does not read as a number — `NaN`, `undefined`, `null`, `''`,
 * `false` — reads as `h6`, and so does every offset from it: it may skip a
 * rank, but it can never add a second `h1` or outrank the page's own headings.
 * A numeric string (`'2'`, an attribute written in plain JavaScript) reads as
 * its number.
 *
 * @param level The rank of the component's own heading.
 * @param offset How many ranks below `level` this heading sits.
 *
 * @example
 * ```svelte
 * <svelte:element this={headingTag(headingLevel)}>{title}</svelte:element>
 * <svelte:element this={headingTag(headingLevel, 1)}>{section}</svelte:element>
 * ```
 */
export function headingTag(level: number, offset = 0): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  // parseFloat, not Number() or Math.trunc() alone: those read null, '', false
  // and [] as 0, the rank of an h1.
  const whole = Math.trunc(Number.parseFloat(String(level)) + offset);
  const rank = Number.isNaN(whole) ? 6 : Math.min(6, Math.max(1, whole));
  return `h${rank}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}
