import type { TableItem } from '$lib/types/tableTypes';
import type { TableState } from './types';

/**
 * Pagination concern: manages page state and computes paginated items.
 * In server mode, items are already paginated by the server — this concern
 * only computes `totalItems`/`totalPages` from `serverTotalItems`.
 * @param state - Shared table state.
 * @param getFilteredItems - Getter for filtered items (client mode: local count).
 * @param getSortedItems - Getter for upstream sorted items.
 */
export function usePagination(
  state: TableState,
  getFilteredItems: () => TableItem[],
  getSortedItems: () => TableItem[]
) {
  const totalItems = $derived(
    state.mode === 'server' ? state.serverTotalItems : getFilteredItems().length
  );

  const totalPages = $derived.by(() => {
    if (state.groupByKey) return 1;
    if (totalItems === 0) return 1;
    return Math.ceil(totalItems / state.itemsPerPage);
  });

  const paginatedItems = $derived.by((): TableItem[] => {
    const items = getSortedItems();

    // In server mode, items are already paginated by the server
    if (state.mode === 'server') return items;

    // Skip pagination when grouped (groups should be fully visible)
    if (state.groupByKey) return items;

    return items.slice(
      (state.currentPage - 1) * state.itemsPerPage,
      state.currentPage * state.itemsPerPage
    );
  });

  function setPage(page: number) {
    state.currentPage = page;
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      state.currentPage = page;
    }
  }

  function setItemsPerPage(count: number) {
    state.itemsPerPage = count;
    state.currentPage = 1;
  }

  return {
    get totalItems() {
      return totalItems;
    },
    get totalPages() {
      return totalPages;
    },
    get paginatedItems() {
      return paginatedItems;
    },
    setPage,
    goToPage,
    setItemsPerPage
  };
}
