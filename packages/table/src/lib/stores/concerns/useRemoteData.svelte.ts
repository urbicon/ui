import type { TableItem, TableQuery } from '$lib/types/tableTypes';
import { viewToQuery } from '$lib/view/observe.svelte';
import type { TableView } from '$lib/view/view.svelte';
import type { TableState } from './types';

/**
 * Remote data concern: derives the current query state for server-side
 * fetching — since v8 a projection of the view object, not a hand-assembled
 * copy of six loose state fields.
 *
 * This concern does NOT fetch data itself (keeping the store synchronous).
 * The managed fetch lifecycle lives in `createManagedFetch`
 * (`$lib/view/observe.svelte`), driven by `TableProvider`; the setters here
 * are its sink.
 *
 * @param state - Shared table state (the setters write into it).
 * @param view - The view object the query is projected from.
 */
export function useRemoteData(state: TableState, view: TableView) {
  /**
   * Current query derived from the view.
   * Changes reactively when any filter/sort/page/search axis changes.
   */
  const query = $derived.by((): TableQuery => viewToQuery(view.snapshot()));

  /**
   * Serialized query string for change detection.
   * Allows `$effect` to trigger only when the query actually changes.
   */
  const queryKey = $derived(JSON.stringify(query));

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
