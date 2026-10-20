/**
 * The element name for a heading of rank `level`, clamped to `h1`–`h6`.
 *
 * A level outside the range would emit `<h0>` or `<h7>`, which is not a
 * heading at all, and a fractional one `<h2.5>`. A component's sub-headings
 * pass `level + 1`; the clamp keeps the deepest of them at `h6`. A level that
 * is no number at all reads as `h6`: it may skip a rank, but it can never add
 * a second `h1` or outrank the page's own headings.
 *
 * @example
 * ```svelte
 * <svelte:element this={headingTag(headingLevel)}>{title}</svelte:element>
 * ```
 */
export function headingTag(level: number): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  const whole = Math.trunc(level);
  const rank = Number.isNaN(whole) ? 6 : Math.min(6, Math.max(1, whole));
  return `h${rank}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}
