/**
 * View observation and the managed fetch layer.
 *
 * `observeView` is the documented replacement for `onQueryChange` consumers
 * who want view changes without a URL — analytics, manual server flows. A
 * helper rather than a recipe on purpose: debounce and echo-freedom are
 * exactly the two things a hand-rolled `$effect` typically gets wrong.
 *
 * `createManagedFetch` drives a managed source's fetch lifecycle off the
 * view. Identity-hardening: the fetch effect tracks the *structural*
 * `viewKey` and the *boolean* "is a managed source wired", never the source
 * object or its `query` function — a parent re-render handing in a fresh
 * `source={{ query: (q) => … }}` literal must not refetch (the
 * #153-regression-1 class).
 */
import { untrack } from 'svelte';
import type { TableQuery, TableQueryResult } from '$lib/types/tableTypes';
import { resolveSource, type TableSource } from './source';
import type { TableView, TableViewSnapshot } from './view.svelte';

/** Project a view snapshot into the `TableQuery` shape `queryFn` receives. */
export function viewToQuery(snapshot: TableViewSnapshot): TableQuery {
  return {
    page: snapshot.page,
    itemsPerPage: snapshot.pageSize,
    sortColumn: snapshot.sort?.column ?? '',
    sortDirection: snapshot.sort?.direction ?? 'asc',
    searchTerm: snapshot.search,
    // A defensive copy, like v7's hand-projected query: the query object
    // leaves the table (queryFn, observers) — a consumer mutating it must
    // not mutate the view's live filter state through the shared reference.
    activeFilters: [...snapshot.filters],
    groupByKey: snapshot.groupBy
  };
}

/** Where a managed fetch reports its lifecycle — the store's server setters. */
export interface FetchSink {
  onLoading?: () => void;
  onResult: (result: TableQueryResult) => void;
  /** `null` = the rejection carried no message — the sink supplies its own (i18n) fallback. */
  onError?: (message: string | null) => void;
}

/**
 * Drives a managed source's fetch lifecycle off the view. First fetch is
 * immediate, every later one debounced (`source.debounceMs`, default 300).
 * In-flight requests are aborted when superseded. Call during component
 * initialisation (the lifecycle is effects).
 */
export function createManagedFetch<T>(
  view: TableView,
  getSource: () => TableSource<T>,
  sink: FetchSink
): void {
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
    if (!isManaged) {
      // A live flip away from the managed variant (source prop changed to
      // client/manual): the in-flight fetch must not land on top of the
      // re-seeded items, and a pending debounce must not start a new one.
      // `initialDone` resets so a later flip back gets its immediate first
      // fetch again.
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      abortController?.abort();
      abortController = null;
      initialDone = false;
      return;
    }
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
    // survive an unrelated re-run; superseding is handled by the
    // debounce-clear above plus the abort below.
  });

  // Destroy-only teardown: without it a pending debounce fires a fetch after
  // unmount and calls the sink of a dead table; an in-flight request keeps
  // running with nobody to abort it.
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
      sink.onError?.(e instanceof Error ? e.message : null);
    }
  }
}

/** Options for {@link observeView}. */
export interface ObserveViewOptions {
  /** Debounce for calls after the immediate first one. @default 300 */
  debounceMs?: number;
}

/**
 * Observe a view's six axes without binding them anywhere: analytics, manual
 * server flows, server sync. Fires synchronously once on registration
 * (parity with the old `onQueryChange` initial emission), then debounced on
 * every structural change — echo-free, because a structurally identical
 * write never reaches the view's signals in the first place. Call during
 * component initialisation.
 *
 * @example Manual server flow
 * ```ts
 * const view = createTableView();
 * observeView(view, (snapshot) => fetchPage(viewToQuery(snapshot)));
 * ```
 */
export function observeView(
  view: TableView,
  callback: (snapshot: TableViewSnapshot) => void,
  options: ObserveViewOptions = {}
): void {
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

  // Destroy-only teardown: a pending debounce must not call the consumer's
  // callback after the observing scope is gone.
  $effect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  });
}
