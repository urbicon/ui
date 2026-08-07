import type { TableItem } from '$lib/types/tableTypes';
import type { TableState } from './types';

/**
 * Remote data concern: the sink of the managed server fetch.
 *
 * This concern does NOT fetch data itself (keeping the store synchronous),
 * and it does not build the query either — the managed fetch lifecycle lives
 * in `createManagedFetch` (`$lib/view/observe.svelte`), driven by
 * `TableProvider`, and since #162 there is no projection left to do: the
 * query IS `view.snapshot()`. The setters here are where its results land.
 *
 * @param state - Shared table state (the setters write into it).
 */
export function useRemoteData(state: TableState) {
  /**
   * Apply server result to the table state.
   * Called by the managed fetch when `source.query` resolves.
   */
  function setServerResult(result: { items: TableItem[]; total: number }) {
    state.items = result.items;
    state.serverTotal = result.total;
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
