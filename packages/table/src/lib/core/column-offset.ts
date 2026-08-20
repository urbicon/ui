/**
 * How many structural columns (group toggle, selection, expand) precede the
 * data columns — the offset `aria-colindex` counts from.
 *
 * One derivation, shared by the header and the row: `aria-colcount` on the
 * grid counts every column (`totalColSpan` includes the structural ones), so
 * the per-cell indices must count them too, or the declared width and the
 * announced positions contradict each other — measured before this existed:
 * colcount 3 beside data cells claiming 1..2 and an indexless selection cell.
 *
 * A column counts whether or not the caller renders a cell for it (a row
 * inside a grouped table skips the group-toggle cell but the column is still
 * there), which is why this takes the flags and not a rendered-cell count.
 */
export function leadingStructuralColumns(input: {
  grouped: boolean;
  selectable: boolean;
  expandable: boolean;
}): number {
  return (input.grouped ? 1 : 0) + (input.selectable ? 1 : 0) + (input.expandable ? 1 : 0);
}
