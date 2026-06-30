import type { TableItem } from '$lib/types/tableTypes';
import { findColumnById, resolveValueById } from '$lib/utils';
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
 * @param getFilteredItems - Getter for upstream filtered items.
 */
export function useSorting(state: TableState, getFilteredItems: () => TableItem[]) {
  const sortedItems = $derived.by((): TableItem[] => {
    const items = getFilteredItems();

    // In server mode, items are already sorted by the server
    if (state.mode === 'server') return items;

    if (!items.length || !state.sortColumn) return [...items];

    // Synthetic columns have no accessor — sorting by them is structurally
    // undefined and the resolver would return undefined for every row. Skip
    // the sort entirely in that case rather than scramble row order.
    const sortColumn = findColumnById(state.columns, state.sortColumn);
    if (sortColumn && sortColumn.accessor === undefined) return [...items];

    return [...items].sort((a, b) => {
      const aValue = resolveValueById(state.columns, a, state.sortColumn);
      const bValue = resolveValueById(state.columns, b, state.sortColumn);

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      const cmp = compareSortable(aValue, bValue);
      return state.sortDirection === 'asc' ? cmp : -cmp;
    });
  });

  function handleSort(column: string) {
    if (state.sortColumn === column) {
      if (state.sortDirection === 'asc') {
        state.sortDirection = 'desc';
      } else {
        state.sortColumn = '';
        state.sortDirection = 'asc';
      }
    } else {
      state.sortColumn = column;
      state.sortDirection = 'asc';
    }
  }

  /**
   * Set the sort column + direction explicitly. Unlike `handleSort` (which
   * cycles asc → desc → none on repeated calls), this sets an exact state and
   * is used by the mobile sort control, where there is no column header to click.
   * Pass an empty `column` to clear the sort.
   */
  function setSort(column: string, direction: 'asc' | 'desc') {
    state.sortColumn = column;
    state.sortDirection = column ? direction : 'asc';
  }

  return {
    get sortedItems() {
      return sortedItems;
    },
    handleSort,
    setSort
  };
}
