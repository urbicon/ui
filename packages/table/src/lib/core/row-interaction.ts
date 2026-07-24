/**
 * Shared row-click semantics for the two row renderers (`TableRow` for flat
 * rows, `GroupedRow` for rows inside a group). Kept in one place so the flat
 * and grouped paths cannot drift apart — they did before: the grouped rows
 * never wired `onRowClick` at all.
 */

/**
 * True when the pointer click ended a text selection **inside this row**.
 *
 * Selecting text by dragging across cells fires a `click` on mouseup; without
 * this guard that click would toggle the row's selection and immediately drop
 * the highlighted text, making cell content impossible to copy. Scoped to the
 * row on purpose: `getSelection()` is document-wide, so a leftover highlight
 * anywhere else on the page would otherwise make rows unclickable.
 *
 * Only a non-collapsed selection counts (a plain caret click is collapsed), and
 * the check is skipped where `getSelection` is unavailable (SSR, old engines).
 */
export function isSelectingTextIn(row: Node | null | undefined): boolean {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) return false;
  if (!row) return true; // no row to scope against — stay conservative
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  return (!!anchor && row.contains(anchor)) || (!!focus && row.contains(focus));
}

/**
 * Resolves what a click on a row body should do. `onRowClick` always fires (it
 * is an observer, not a mode); expansion and selection are opt-in per row type.
 *
 * Selection is deliberately suppressed while text inside the row is being
 * selected — see {@link isSelectingTextIn}.
 */
export function resolveRowClickActions(options: {
  hasRowClickHandler: boolean;
  expandable: boolean;
  rowClickSelects: boolean;
  selectable: boolean;
  row?: Node | null;
}): { fireRowClick: boolean; toggleExpand: boolean; toggleSelection: boolean } {
  const selects = options.rowClickSelects && options.selectable;
  return {
    fireRowClick: options.hasRowClickHandler,
    toggleExpand: options.expandable,
    toggleSelection: selects && !isSelectingTextIn(options.row)
  };
}
