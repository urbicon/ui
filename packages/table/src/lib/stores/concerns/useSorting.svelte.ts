import type { TableItem } from '$lib/types/tableTypes';
import { findColumnById, resolveValueById } from '$lib/utils';
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
    const sortColumn = findColumnById(state.columns, sort.column);
    if (sortColumn && sortColumn.accessor === undefined) return [...items];

    return [...items].sort((a, b) => {
      const aValue = resolveValueById(state.columns, a, sort.column);
      const bValue = resolveValueById(state.columns, b, sort.column);

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      const cmp = compareSortable(aValue, bValue);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  });

  /**
   * The column-header click: asc → desc → unsorted, on repeat.
   *
   * "Unsorted" is `null` rather than the v7 empty-column sentinel, so the
   * third state cannot leave a direction behind for a column nobody is
   * sorting by.
   */
  function handleSort(column: string) {
    const sort = view.sort;
    if (sort?.column !== column) {
      view.sort = { column, direction: 'asc' };
    } else if (sort.direction === 'asc') {
      view.sort = { column, direction: 'desc' };
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
