import type { TableItem } from '$lib/types/tableTypes';
import type { TableView } from '$lib/view/view.svelte';
import { resolvePageDescriptor } from './page-descriptor';
import type { TableState } from './types';

/**
 * Pagination concern: manages page state and computes paginated items.
 * In server mode, items are already paginated by the server — this concern
 * only resolves the page descriptor from `serverTotal`.
 *
 * The counting questions (total, page count, clamped page, pager visibility)
 * are answered once, by {@link resolvePageDescriptor}; this concern owns the
 * one `$derived` around it and the slicing of the client-mode page.
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
  const descriptor = $derived(
    resolvePageDescriptor({
      mode: state.mode,
      serverTotal: state.serverTotal,
      filteredCount: getFilteredItems().length,
      loadedCount: state.items.length,
      rawPage: view.page,
      pageSize: view.pageSize,
      grouped: !!state.effectiveGroupBy,
      virtualized: state.virtualized
    })
  );

  const paginatedItems = $derived.by((): TableItem[] => {
    const items = getSortedItems();

    // In server mode, items are already paginated by the server
    if (state.mode !== 'client') return items;

    // Skip pagination when grouped, so groups are fully visible. Client mode
    // only in effect — the server-mode branch above already returned, because
    // there the server did the slicing (#159).
    if (state.effectiveGroupBy) return items;

    return items.slice(
      (descriptor.effectivePage - 1) * view.pageSize,
      descriptor.effectivePage * view.pageSize
    );
  });

  function setPage(page: number) {
    view.page = page;
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= descriptor.totalPages) {
      view.page = page;
    }
  }

  function setPageSize(count: number) {
    view.pageSize = count;
    view.page = 1;
  }

  return {
    /**
     * The resolved page: totals, clamped page, fetch page, range start and
     * pager visibility — one answer for every reader.
     */
    get descriptor() {
      return descriptor;
    },
    get totalItems() {
      return descriptor.totalItems;
    },
    get totalPages() {
      return descriptor.totalPages;
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
      return descriptor.effectivePage;
    },
    setPage,
    goToPage,
    setPageSize
  };
}
