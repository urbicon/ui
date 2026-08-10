import type { TableItem } from '$lib/types/tableTypes';
import type { TableView } from '$lib/view/view.svelte';
import type { TableState } from './types';

/**
 * Pagination concern: manages page state and computes paginated items.
 * In server mode, items are already paginated by the server — this concern
 * only computes `totalItems`/`totalPages` from `serverTotal`.
 * @param state - Shared table state.
 * @param view - The view object the page axes live on.
 * @param getFilteredItems - Getter for filtered items (client mode: local count).
 * @param getSortedItems - Getter for upstream sorted items.
 */
export function usePagination(
  state: TableState,
  view: TableView,
  getFilteredItems: () => TableItem[],
  getSortedItems: () => TableItem[]
) {
  const totalItems = $derived(
    state.mode === 'server' ? state.serverTotal : getFilteredItems().length
  );

  const totalPages = $derived.by(() => {
    // Grouping suspends paging in CLIENT mode only, where every row is already
    // here and a group can therefore be shown whole — which is the thing a
    // group means.
    //
    // Server mode cannot make that promise: the rest of a group may sit on pages
    // this client has never fetched, and collapsing to one page here removed the
    // pager, so a reader saw one page's worth of rows presented as the whole
    // result and had no control left to reach the rest (#159). There, grouping
    // buckets the page it has and paging stays.
    if (state.effectiveGroupBy && state.mode !== 'server') return 1;
    if (totalItems === 0) return 1;
    return Math.ceil(totalItems / view.pageSize);
  });

  /**
   * The page actually rendered: `view.page` clamped into range.
   *
   * `view.page` is written by pagination, search, filtering and grouping —
   * none of which can know whether the page still exists after the page size
   * or the item count changed. Before 2026-08 the reset rode along inside
   * `setPageSize` (which reset the page as a side effect), so raising a
   * rows-per-page control from
   * 3 to 20 while on page 5 left the page at 5 against a single page —
   * `slice(80, 100)` on 100 rows, an empty body with the data right there, and a
   * pager reading "5 / 1".
   *
   * Clamping here makes that state unrepresentable instead of relying on every
   * writer to remember the reset. It also covers an out-of-range page arriving
   * from the view (its defaults, a URL, storage), which never had a guard at all.
   */
  const effectivePage = $derived(Math.min(Math.max(view.page, 1), totalPages));

  const paginatedItems = $derived.by((): TableItem[] => {
    const items = getSortedItems();

    // In server mode, items are already paginated by the server
    if (state.mode === 'server') return items;

    // Skip pagination when grouped, so groups are fully visible. Client mode
    // only in effect — the server-mode branch above already returned, because
    // there the server did the slicing (#159).
    if (state.effectiveGroupBy) return items;

    return items.slice((effectivePage - 1) * view.pageSize, effectivePage * view.pageSize);
  });

  function setPage(page: number) {
    view.page = page;
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      view.page = page;
    }
  }

  function setPageSize(count: number) {
    view.pageSize = count;
    view.page = 1;
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
     * `view.page` clamped into range — what `paginatedItems` actually sliced.
     * Read this for anything user-facing; `view.page` is the reader's *intent*
     * and can sit out of range after the page size or the item count changed
     * under it.
     */
    get effectivePage() {
      return effectivePage;
    },
    setPage,
    goToPage,
    setPageSize
  };
}
