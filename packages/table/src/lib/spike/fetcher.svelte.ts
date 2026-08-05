/**
 * SPIKE §7.4 — the managed fetch layer over a view object, and the
 * `observeView` replacement for `onQueryChange` consumers who do not want
 * the URL (manual fetch, analytics).
 *
 * The identity-hardening (M2/§7.3): the fetch effect tracks the *structural*
 * `viewKey` and the *boolean* "is a managed source wired", never the source
 * object or its `query` function — a parent re-render handing in a fresh
 * `source={{ query: (q) => … }}` literal must not refetch (measured with a
 * fetch counter in spike.fetch.svelte.test.ts, the #153-regression-1 setup).
 */
import { untrack } from 'svelte';
import type { TableItem, TableQuery, TableQueryResult } from '$lib/types/tableTypes';
import { resolveSource, type TableSource } from './source';
import type { TableView, TableViewSnapshot } from './view.svelte';

export function viewToQuery(snapshot: TableViewSnapshot): TableQuery {
  return {
    page: snapshot.page,
    itemsPerPage: snapshot.pageSize,
    sortColumn: snapshot.sort?.column ?? '',
    sortDirection: snapshot.sort?.direction ?? 'asc',
    searchTerm: snapshot.search,
    activeFilters: snapshot.filters,
    groupByKey: snapshot.groupBy
  };
}

export interface FetchSink {
  onLoading?: () => void;
  onResult: (result: TableQueryResult) => void;
  onError?: (message: string) => void;
}

/**
 * Drives a managed source's fetch lifecycle off the view. First fetch is
 * immediate, every later one debounced (`source.debounceMs`, default 300).
 * In-flight requests are aborted when superseded.
 */
export function createManagedFetch<T extends TableItem>(
  view: TableView,
  getSource: () => TableSource<T>,
  sink: FetchSink
) {
  // Boolean, structural: a fresh source literal with the same shape does not
  // change this derived, so the effect below never sees it.
  const isManaged = $derived(resolveSource(getSource()).mode === 'server-managed');
  // Structural view identity: a filters array replaced by a structurally
  // identical one serialises identically, so no fetch.
  const viewKey = $derived(JSON.stringify(view.snapshot()));

  let initialDone = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  $effect(() => {
    if (!isManaged) return;
    void viewKey; // the only other tracked dependency
    const delay = initialDone
      ? untrack(() => {
          const resolved = resolveSource(getSource());
          return resolved.mode === 'server-managed' ? resolved.debounceMs : 300;
        })
      : 0;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      initialDone = true;
      void execute();
    }, delay);
    // No timer-clearing teardown between runs — the pending fetch must
    // survive an unrelated re-run, and superseding is handled by the
    // debounce-clear above plus the abort below.
  });

  // Destroy-only teardown (review M4): without it a pending debounce fires a
  // fetch after unmount and calls the sink of a dead table; an in-flight
  // request keeps running with nobody to abort it.
  $effect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      abortController?.abort();
    };
  });

  async function execute(): Promise<void> {
    // Resolve the source at execution time, untracked — its identity may be
    // fresh on every parent render; only its *content* matters here.
    const resolved = untrack(() => resolveSource(getSource()));
    if (resolved.mode !== 'server-managed') return;
    if (abortController) abortController.abort();
    abortController = new AbortController();
    const { signal } = abortController;
    sink.onLoading?.();
    try {
      const result = await resolved.query(
        untrack(() => viewToQuery(view.snapshot())),
        { signal }
      );
      if (signal.aborted) return;
      sink.onResult(result);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (signal.aborted) return;
      sink.onError?.(e instanceof Error ? e.message : 'fetch failed');
    }
  }
}

export interface ObserveViewOptions {
  debounceMs?: number;
}

/**
 * §3.5/M3d — the documented replacement for `onQueryChange` consumers that
 * want view changes without a URL: analytics, manual server flows. Fires
 * synchronously once on registration (parity with today's initial emission),
 * then debounced on every structural change.
 */
export function observeView(
  view: TableView,
  callback: (snapshot: TableViewSnapshot) => void,
  options: ObserveViewOptions = {}
) {
  const debounceMs = options.debounceMs ?? 300;
  const viewKey = $derived(JSON.stringify(view.snapshot()));
  let first = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    void viewKey;
    if (first) {
      first = false;
      untrack(() => callback(view.snapshot()));
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      callback(untrack(() => view.snapshot()));
    }, debounceMs);
  });

  // Destroy-only teardown (review M4): a pending debounce must not call the
  // consumer's callback after the observing scope is gone.
  $effect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  });
}
