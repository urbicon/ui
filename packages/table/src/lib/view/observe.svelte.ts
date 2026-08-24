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
import type { TablePage } from '$lib/types/tableTypes';
import { resolveSource, type TableSource } from './source';
import type { TableView, TableViewSnapshot } from './view.svelte';

/** Options for {@link createManagedFetch}. */
export interface ManagedFetchOptions {
  /**
   * One-shot handshake with a debounce further up: called once per effect
   * run, `true` means the view change that triggered this run had already
   * been waited out upstream, so the fetch skips its own `source.debounceMs`
   * and goes out at the end of the wait that already happened.
   *
   * Exactly one caller passes it — `TableProvider`, wired to the search bar's
   * `searchDebounceMs` timer (#255). Deliberately a *take*: the mark is
   * consumed by the read, so it cannot survive into an unrelated view change
   * that is still owed its debounce. Keep the implementation non-reactive —
   * this is read from inside an effect.
   */
  takePreDebounced?: () => boolean;
}

/** Where a managed fetch reports its lifecycle — the store's server setters. */
export interface FetchSink {
  onLoading?: () => void;
  onResult: (result: TablePage) => void;
  /** `null` = the rejection carried no message — the sink supplies its own (i18n) fallback. */
  onError?: (message: string | null) => void;
}

/**
 * Drives a managed source's fetch lifecycle off the view. First fetch is
 * immediate, every later one debounced (`source.debounceMs`, default 300).
 * In-flight requests are aborted when superseded. Call during component
 * initialisation (the lifecycle is effects).
 *
 * Feature-frozen with `ServerManagedSource` (2026-08-06, #160; reasoning in
 * the `source.ts` header): no `refetch()`, no cache, no retry, no
 * invalidation hook. Each of those turns this into a data layer. Fix bugs
 * here, send capabilities to the manual `processing: 'server'` flow.
 *
 * `getFetchSnapshot` is what the fetch actually asks for — by default the raw
 * view snapshot. The provider passes a projection whose `page` follows the
 * *displayed* (clamped) page: key and execution read the same function, so
 * when a response reveals the intent was out of range, the projected page
 * changes, the key changes, and the debounced refetch recovers the reader —
 * without anything writing the view (the raw intent stays, for a later
 * page-size change to resurrect). No loop: the recovering response leaves the
 * projection where it is.
 *
 * `options.takePreDebounced` lets a change that was *already* debounced
 * upstream skip this debounce — see {@link ManagedFetchOptions}.
 */
export function createManagedFetch<T>(
  view: TableView,
  getSource: () => TableSource<T>,
  sink: FetchSink,
  getFetchSnapshot: () => TableViewSnapshot = () => view.snapshot(),
  options: ManagedFetchOptions = {}
): void {
  // Boolean, structural: a fresh source literal with the same shape does not
  // change this derived, so the effect below never sees it.
  const isManaged = $derived(resolveSource(getSource()).mode === 'server-managed');
  // Structural fetch identity: a filters array replaced by a structurally
  // identical one serialises identically, so no fetch. Built on the SAME
  // snapshot the execution sends — a key over the raw view with an execution
  // over the projection could skip exactly the refetch that recovers an
  // out-of-range page.
  const viewKey = $derived(JSON.stringify(getFetchSnapshot()));

  let initialDone = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  $effect(() => {
    // Consumed at the top of every run, so the mark never reaches a second
    // one: whatever this run decides, the next change starts from an empty
    // mark. `untrack` because consuming it must never make this effect a
    // dependent of its own consumption.
    //
    // What it does NOT do is keep a mark from outliving an unmanaged spell.
    // The branch below returns before `void viewKey`, so while no managed
    // source is wired the effect has exactly one dependency left (`isManaged`)
    // and client-mode view changes never re-run it — a mark armed there stays
    // armed until the flip back. Harmless for one reason only, and it is the
    // line below, not this one: `initialDone = false` makes the first fetch
    // after a flip immediate anyway, so a stale mark cannot shorten a wait
    // anybody was owed. Remove that reset and the stale mark becomes the only
    // thing hiding a debounced first fetch (pinned in the live-flip describe
    // of observe.svelte.test.ts).
    const preDebounced = untrack(() => options.takePreDebounced?.() === true);
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
    // The first fetch never waits — and neither does one whose change already
    // waited upstream: the search bar's debounce and this one are two halves
    // of ONE budget per keystroke, not two budgets in series (#255).
    const delay =
      initialDone && !preDebounced
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
        untrack(() => getFetchSnapshot()),
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
 * observeView(view, (snapshot) => fetchPage(snapshot));
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
