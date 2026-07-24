/**
 * Shared row-click semantics for the two row renderers (`TableRow` for flat
 * rows, `GroupedRow` for rows inside a group). Kept in one place so the flat
 * and grouped paths cannot drift apart — they did before: the grouped rows
 * never wired `onRowClick` at all.
 */

/**
 * True when the pointer click ended a text selection inside the row.
 *
 * Selecting text by dragging across cells fires a `click` on mouseup; without
 * this guard that click would toggle the row's selection and immediately drop
 * the highlighted text, making cell content impossible to copy. Only a
 * non-collapsed selection counts (a plain caret click is collapsed), and the
 * check is skipped where `getSelection` is unavailable (SSR, old engines).
 */
export function isSelectingText(): boolean {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && selection.toString().trim().length > 0;
}

/**
 * Resolves what a click on a row body should do. `onRowClick` always fires (it
 * is an observer, not a mode); expansion and selection are opt-in per row type.
 *
 * Selection is deliberately suppressed while text is being selected — see
 * {@link isSelectingText}.
 */
export function resolveRowClickActions(options: {
  hasRowClickHandler: boolean;
  expandable: boolean;
  rowClickSelects: boolean;
  selectable: boolean;
}): { fireRowClick: boolean; toggleExpand: boolean; toggleSelection: boolean } {
  const selects = options.rowClickSelects && options.selectable;
  return {
    fireRowClick: options.hasRowClickHandler,
    toggleExpand: options.expandable,
    toggleSelection: selects && !isSelectingText()
  };
}
