import type { useTableI18n } from '$lib/i18n';

/**
 * The `tt` a component gets from `useTableI18n()`. Derived rather than
 * hand-written, so a mistyped key here is a compile error like anywhere else.
 */
type TranslateFn = ReturnType<typeof useTableI18n>;

/**
 * The parenthesised row count in a group header, worded for what it can honestly
 * claim.
 *
 * The number is the same either way — how many rows this component was handed.
 * What differs is what that number MEANS. In client mode the group holds every
 * row of the group, so "(8 items)" is its size. In server mode it holds the
 * slice that happens to sit on the current page, and the server may hold 400
 * (#159) — so the label has to say "on this page" or the count states something
 * false with total confidence.
 *
 * This lives in a module rather than in a component because there are TWO group
 * headers — the desktop `GroupedRow` and the mobile card list — and the first
 * attempt at #159 fixed one and claimed in its commit message that "the count
 * and its label are decided in one place". They were not, and the phone kept
 * printing the bug. Now they are, and a third renderer cannot reintroduce it
 * without going out of its way.
 */
export function groupCountText(count: number, mode: string, tt: TranslateFn): string {
  if (mode === 'server') {
    return `(${count} ${count === 1 ? tt('group.itemOnPage') : tt('group.itemsOnPage')})`;
  }
  return `(${count} ${count === 1 ? tt('group.item') : tt('group.items')})`;
}
