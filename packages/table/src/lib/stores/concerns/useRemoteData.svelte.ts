import type { TableItem, TableQuery } from '$lib/types/tableTypes';
import type { TableState } from './types';

/**
 * Remote data concern: derives the current query state for server-side fetching.
 *
 * This concern does NOT fetch data itself (keeping the store synchronous).
 * Instead, it exposes a reactive `query` object and `setServerResult()` for
 * the component layer to drive the async lifecycle.
 *
 * @param state - Shared table state.
 */
export function useRemoteData(state: TableState) {
  /**
   * Current query derived from table state.
   * Changes reactively when any filter/sort/page/search state changes.
   */
  const query = $derived.by(
    (): TableQuery => ({
      page: state.currentPage,
      itemsPerPage: state.itemsPerPage,
      sortColumn: state.sortColumn,
      sortDirection: state.sortDirection,
      searchTerm: state.searchTerm,
      activeFilters: [...state.activeFilters],
      groupByKey: state.groupByKey
    })
  );

  /**
   * Serialized query string for change detection.
   * Allows `$effect` to trigger only when the query actually changes.
   */
  const queryKey = $derived(JSON.stringify(query));

  /**
   * Apply server result to the table state.
   * Called by the component layer when `queryFn` resolves or when
   * the developer provides new items in manual mode.
   */
  function setServerResult(result: { items: TableItem[]; totalItems: number }) {
    state.items = result.items;
    state.serverTotalItems = result.totalItems;
    state.loading = false;
    state.error = null;
  }

  /**
   * Set server-side error state.
   */
  function setServerError(error: string) {
    state.loading = false;
    state.error = error;
  }

  /**
   * Set loading state (used before fetch).
   */
  function setServerLoading() {
    state.loading = true;
  }

  return {
    get query() {
      return query;
    },
    get queryKey() {
      return queryKey;
    },
    setServerResult,
    setServerError,
    setServerLoading
  };
}
