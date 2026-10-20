/**
 * The element name for a heading of rank `level`, clamped to `h1`–`h6`.
 *
 * A level outside the range would emit `<h0>` or `<h7>`, which is not a
 * heading at all, and a fractional one `<h2.5>`. A component's sub-headings
 * pass `level + 1`; the clamp keeps the deepest of them at `h6`.
 *
 * @example
 * ```svelte
 * <svelte:element this={headingTag(headingLevel)}>{title}</svelte:element>
 * ```
 */
export function headingTag(level: number): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  return `h${Math.min(6, Math.max(1, Math.trunc(level)))}` as
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6';
}
