import type { TableItem } from '$lib/types/tableTypes';
import { findColumnById, resolveValueById } from '$lib/utils';
import { firstSortDirectionById } from '$lib/utils/column-capabilities';
import type { TableView, ViewSort } from '$lib/view/view.svelte';
import type { TableState } from './types';

function compareSortable(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  const aStr = String(a);
  const bStr = String(b);
  if (aStr < bStr) return -1;
  if (aStr > bStr) return 1;
  return 0;
}

/**
 * Sorting concern: manages sort column/direction and computes sorted items.
 * @param state - Shared table state.
 * @param view - The view object the sort axis lives on.
 * @param getFilteredItems - Getter for upstream filtered items.
 */
export function useSorting(
  state: TableState,
  view: TableView,
  getFilteredItems: () => TableItem[]
) {
  const sortedItems = $derived.by((): TableItem[] => {
    const items = getFilteredItems();

    // In server mode, items are already sorted by the server
    if (state.mode !== 'client') return items;

    const sort = view.sort;
    if (!items.length || !sort) return [...items];

    // Synthetic columns have no accessor — sorting by them is structurally
    // undefined and the resolver would return undefined for every row. Skip
    // the sort entirely in that case rather than scramble row order.
    //
    // `allColumns`, not the visible subset: a sort survives its column being
    // hidden (the grid stays ordered by it), so the definition it needs has to
    // survive too — otherwise a hidden function-accessor column resolved to
    // `undefined` for every row and the order silently collapsed (#253).
    const sortColumn = findColumnById(state.allColumns, sort.column);
    if (sortColumn && sortColumn.accessor === undefined) return [...items];

    return [...items].sort((a, b) => {
      const aValue = resolveValueById(state.allColumns, a, sort.column);
      const bValue = resolveValueById(state.allColumns, b, sort.column);

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      const cmp = compareSortable(aValue, bValue);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  });

  /**
   * The column-header click: the column's first direction → the opposite →
   * unsorted, on repeat. Which direction comes first is the column's to say,
   * and the answer is `firstSortDirectionById` in `utils/column-capabilities` —
   * shared with the filter bar's sort panel, which is the only sort control the
   * mobile card layout has. A column sitting in its *second* direction clears
   * on the next click whichever route put it there — a view default, a URL,
   * the header menu.
   *
   * "Unsorted" is `null` rather than the v7 empty-column sentinel, so the
   * third state cannot leave a direction behind for a column nobody is
   * sorting by.
   */
  function handleSort(column: string) {
    const first = firstSortDirectionById(state.allColumns, column);
    const sort = view.sort;
    if (sort?.column !== column) {
      view.sort = { column, direction: first };
    } else if (sort.direction === first) {
      view.sort = { column, direction: first === 'asc' ? 'desc' : 'asc' };
    } else {
      view.sort = null;
    }
  }

  /**
   * Set an exact sort, no cycling — for controls without a header to click
   * (the mobile sort sheet). `null` clears it.
   */
  function setSort(sort: ViewSort | null) {
    view.sort = sort;
  }

  return {
    get sortedItems() {
      return sortedItems;
    },
    handleSort,
    setSort
  };
}
