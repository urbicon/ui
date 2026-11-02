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
 * The standalone widget roles of WAI-ARIA 1.2 (§5.3.2, "Widget Roles"), less
 * three: `gridcell`, which this grid's own cells carry, and `progressbar` and
 * `tabpanel`, which take no activation. The composite roles of the same
 * section (`grid`, `listbox`, `menu`, …) hold widgets rather than being one,
 * and `separator` is a widget only while focusable.
 */
const WIDGET_ROLES = [
  'button',
  'checkbox',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem'
];

/**
 * What takes a click of its own: the native controls, a `label` (it forwards
 * its click to its control), and an element in a widget role — the clickable
 * cells are `role="button"`. A `tabindex` alone does not count: a tooltip
 * trigger, a scrolling viewport or a `<pre>` is focusable and still leaves
 * its click to the row around it.
 */
const CLICK_OWNER = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="separator"][tabindex]',
  ...WIDGET_ROLES.map((role) => `[role="${role}"]`)
].join(', ');

/**
 * True when `event` landed on a control nested inside `host` — a clickable
 * cell, a link, a consumer's button. The click is that control's, and `host`'s
 * own action (the row click, a card's headline, the group band) must not run
 * on top of it. A click on anything else resolves to `host` itself (the
 * headline is a `<button>`), to an element outside it, or to nothing, and
 * stays `host`'s.
 */
export function isFromNestedControl(event: Event, host: Element): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const owner = target.closest(CLICK_OWNER);
  return owner !== null && owner !== host && host.contains(owner);
}

/**
 * Resolves what a click the row owns should do — {@link isFromNestedControl}
 * filters out the rest first. `onRowClick` always fires (it is an observer,
 * not a mode); expansion and selection are opt-in per row type.
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
