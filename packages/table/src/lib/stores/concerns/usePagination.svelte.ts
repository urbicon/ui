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

  /**
   * The page actually rendered: `currentPage` clamped into range.
   *
   * `currentPage` derives from the `initialPage` prop and is written by
   * pagination, search, filtering and grouping — none of which can know whether
   * the page still exists after `itemsPerPage` or the item count changed. Before
   * 2026-08 the reset rode along inside `setItemsPerPage` (which set
   * `currentPage = 1` as a side effect), so raising a rows-per-page control from
   * 3 to 20 while on page 5 left `currentPage` at 5 against a single page —
   * `slice(80, 100)` on 100 rows, an empty body with the data right there, and a
   * pager reading "5 / 1".
   *
   * Clamping here makes that state unrepresentable instead of relying on every
   * writer to remember the reset. It also covers an out-of-range `initialPage`,
   * which never had a guard at all.
   */
  const effectivePage = $derived(Math.min(Math.max(state.currentPage, 1), totalPages));

  const paginatedItems = $derived.by((): TableItem[] => {
    const items = getSortedItems();

    // In server mode, items are already paginated by the server
    if (state.mode === 'server') return items;

    // Skip pagination when grouped (groups should be fully visible)
    if (state.groupByKey) return items;

    return items.slice(
      (effectivePage - 1) * state.itemsPerPage,
      effectivePage * state.itemsPerPage
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
    /**
     * `currentPage` clamped into range — what `paginatedItems` actually sliced.
     * Read this for anything user-facing; `state.currentPage` can sit out of
     * range after the page size or the item count changed under it.
     */
    get effectivePage() {
      return effectivePage;
    },
    setPage,
    goToPage,
    setItemsPerPage
  };
}
