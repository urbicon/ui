import type { TableItem } from '$lib/types/tableTypes';
import type { TableState } from './types';

/**
 * Remote data concern: the sink of the managed server fetch.
 *
 * This concern does NOT fetch data itself (keeping the store synchronous),
 * and since v8 it does not project the query either — the managed fetch
 * lifecycle lives in `createManagedFetch` (`$lib/view/observe.svelte`),
 * driven by `TableProvider`, which derives its query via
 * `viewToQuery(view.snapshot())` itself. The setters here are where its
 * results land.
 *
 * @param state - Shared table state (the setters write into it).
 */
export function useRemoteData(state: TableState) {
  /**
   * Apply server result to the table state.
   * Called by the managed fetch when `source.query` resolves.
   */
  function setServerResult(result: { items: TableItem[]; totalItems: number }) {
    state.items = result.items;
    state.serverTotalItems = result.totalItems;
    state.loading = false;
    state.error = null;
  }

  /** Set server-side error state. */
  function setServerError(error: string) {
    state.loading = false;
    state.error = error;
  }

  /** Set loading state (used before fetch). */
  function setServerLoading() {
    state.loading = true;
  }

  return {
    setServerResult,
    setServerError,
    setServerLoading
  };
}
