/**
 * The URL binding for the v8 table view object — the SvelteKit-bound half of
 * the binding pair (`bindViewToStorage` lives in `@urbicon-ui/table`,
 * kit-free). Decorates a view with the URL as its home: deep links apply at
 * init (synchronously, during SSR too), navigations apply at runtime, and
 * the reader's changes reach the URL debounced, with every axis that equals
 * the view's defaults elided.
 *
 * Phase contract: defaults (constructor) → URL (init, synchronous) →
 * storage (after hydration) → runtime (URL navigations apply; storage never
 * applies again). At **init**, a missing param means *not claimed* — storage
 * may seed the axis (the deep-link precedence URL > storage, the one moment
 * presence matters). At **runtime**, a missing param on a bound axis means
 * *apply the default* (the back-button contract).
 *
 * ## One URL writer per page
 *
 * All bindings share a module-scope, coalescing URL writer: jobs submitted
 * in the same tick land in ONE `goto`, each job replacing only its own keys
 * and preserving everything else. That is what makes two bindings (two
 * tables with distinct `prefix`es) composable — every navigation carries
 * both bindings' slices current, so neither ever sees a "foreign" URL from
 * its sibling — and it is where the **self-navigation marker** lives: a
 * landing URL the writer itself sent is not applied back onto the view, so
 * a user edit made while the navigation was in flight survives instead of
 * being overwritten by the landing (stale) URL — the measured lost-update
 * window of the spike review.
 */
import { untrack } from 'svelte';
import { browser, building } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import {
  searchParamsToViewPartial,
  TABLE_VIEW_AXES,
  type TableViewAxis,
  type TableViewLike,
  type TableViewSnapshot,
  viewAxesNamedBy,
  viewAxisKeys,
  viewSnapshotToSearchParams
} from './table-view';

/** Order-insensitive canonical form, for echo comparison only. */
function canonical(sp: URLSearchParams): string {
  return [...sp.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('&');
}

/** The binding's own slice of a search string — foreign params excluded. */
function ownSlice(search: string, keys: readonly string[]): URLSearchParams {
  const all = new URLSearchParams(search);
  const own = new URLSearchParams();
  for (const key of keys) {
    for (const value of all.getAll(key)) own.append(key, value);
  }
  return own;
}

interface WriterJob {
  /** The submitting binding — lets a teardown withdraw its unflushed jobs. */
  owner: object;
  keys: readonly string[];
  params: URLSearchParams;
  replaceState: boolean;
}

/**
 * The app-global coalescing URL writer (module scope — it outlives route
 * changes). Safe on the server because every touch is browser-gated: flushes
 * and teardowns live in effects and timer callbacks, which never run there,
 * and registration is explicitly `browser`-gated in `bindViewToUrl` — an
 * unconditional register leaked across requests (the map outlives the
 * request, and only an effect teardown releases an entry), so request 2 of
 * the same route threw the claims error below.
 *
 * While a navigation is in flight, `page.url` is stale — so the writer keeps
 * `intendedSearch`, the last search string it sent, and uses it as BOTH the
 * merge basis and the cancels-out comparison. Without it, a flush issued
 * inside the in-flight window merged onto the stale URL: a revert during a
 * slow navigation was swallowed as "cancels out" (permanent view↔URL
 * divergence), and a sibling binding's slice was erased from the URL — the
 * two red counter-examples of the adversarial review.
 */
const writer = {
  jobs: [] as WriterJob[],
  flushQueued: false,
  /** Search strings sent via `goto` and not yet acknowledged by a landing. */
  sentPending: new Set<string>(),
  /** The last sent search string — the true URL basis while anything is pending. */
  intendedSearch: null as string | null,
  /** Memoized verdict for the most recent landing, so every binding on the
   *  page classifies one landing identically (the first query consumes the
   *  `sentPending` entry, the rest read the memo). */
  lastClassified: null as { search: string; self: boolean } | null,
  /**
   * The URL keys of every live url binding, by owner. Two prefixless
   * bindings on two views would silently manage the same keys (last flush
   * wins, a shared link loads the wrong table) — a key intersection at
   * registration is a programming error, caught here because the writer is
   * the one place that sees every binding on the page.
   */
  liveKeys: new Map<object, readonly string[]>(),

  register(owner: object, keys: readonly string[]): void {
    for (const [other, otherKeys] of this.liveKeys) {
      if (other === owner) continue;
      const clash = keys.find((key) => otherKeys.includes(key));
      if (clash) {
        throw new Error(
          `[bindViewToUrl] two url bindings on this page manage the URL key "${clash}" — give one of them a \`prefix\`.`
        );
      }
    }
    this.liveKeys.set(owner, keys);
  },

  unregister(owner: object): void {
    this.liveKeys.delete(owner);
    // Withdraw unflushed jobs: a debounce that fired in the same task as the
    // unmount must not navigate with the dead binding's params.
    this.jobs = this.jobs.filter((job) => job.owner !== owner);
  },

  submit(job: WriterJob): void {
    this.jobs.push(job);
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => this.flush());
  },

  flush(): void {
    this.flushQueued = false;
    if (this.jobs.length === 0) return;
    const jobs = this.jobs;
    this.jobs = [];
    const baseline = this.intendedSearch ?? page.url.search;
    const next = new URLSearchParams(baseline);
    let replaceState = true;
    for (const job of jobs) {
      for (const key of job.keys) next.delete(key);
      for (const [key, value] of job.params) next.append(key, value);
      replaceState &&= job.replaceState;
    }
    const qs = next.toString();
    const search = qs ? `?${qs}` : '';
    if (search === baseline) return; // coalesced jobs cancelled out
    this.sentPending.add(search);
    this.intendedSearch = search;
    void goto(`${page.url.pathname}${search}${page.url.hash}`, {
      replaceState,
      noScroll: true,
      keepFocus: true
    });
  },

  /**
   * Classify a landing URL: did this writer send it? Consumes the pending
   * entry on first query (so a later back-navigation to the same string is
   * foreign, as it should be) and memoizes the verdict for the flush so
   * every binding agrees. A foreign landing invalidates everything pending —
   * SvelteKit has cancelled those navigations. When the *intended* (last
   * sent) navigation lands, every older pending entry is cleared too: those
   * navigations were superseded and will never land, and a stale entry
   * would misclassify a later back-landing on the same string as self.
   */
  classify(search: string): 'self' | 'foreign' {
    if (this.lastClassified?.search === search) {
      return this.lastClassified.self ? 'self' : 'foreign';
    }
    const self = this.sentPending.delete(search);
    if (!self) {
      this.sentPending.clear();
      this.intendedSearch = null;
    } else if (search === this.intendedSearch) {
      this.sentPending.clear();
      this.intendedSearch = null;
    }
    this.lastClassified = { search, self };
    return self ? 'self' : 'foreign';
  }
};

/**
 * Reset the module-scope writer between tests. The writer's pending-set and
 * memo are keyed to a page's navigation stream; a test runner reusing the
 * module across tests would otherwise leak one test's in-flight markers into
 * the next.
 * @internal test-only — not part of the public API.
 */
export function __resetUrlWriterForTests(): void {
  writer.jobs = [];
  writer.flushQueued = false;
  writer.sentPending.clear();
  writer.intendedSearch = null;
  writer.lastClassified = null;
  writer.liveKeys.clear();
}

/**
 * Size of the writer's live-key registry — lets the SSR suite assert that
 * the module-global registry does not grow across simulated server requests.
 * @internal test-only — not part of the public API.
 */
export function __urlWriterLiveKeyCountForTests(): number {
  return writer.liveKeys.size;
}

/** Options for {@link bindViewToUrl}. */
export interface UrlViewBindingOptions {
  /** Axes to bind. @default all six */
  axes?: readonly TableViewAxis[];
  /** Debounce for view → URL writes in ms. @default 300 */
  debounceMs?: number;
  /**
   * Replace the current history entry instead of pushing a new one, so rapid
   * sort/filter/page edits do not flood the back button.
   * @default true
   */
  replaceState?: boolean;
  /**
   * Key prefix (`prefix: 't_'` → `?t_q=…&t_page=…`) — namespace for a second
   * bound table on the same page.
   * @default ''
   */
  prefix?: string;
  /**
   * Mirror *external* changes (a storage seed) into the URL immediately, via
   * `replaceState` — the "yesterday's view" state becomes shareable without
   * an interaction. Default `false`: the address bar does not change without
   * reader interaction; the seed reaches the URL with the first one (the
   * full snapshot is serialized then).
   * @default false
   */
  reflectExternal?: boolean;
}

const zeroRevisions = (): Record<TableViewAxis, number> => ({
  search: 0,
  sort: 0,
  page: 0,
  pageSize: 0,
  filters: 0,
  groupBy: 0
});

/** Read exactly the bound axes through the view's getters — tracked. */
function readAxes(view: TableViewLike, axes: readonly TableViewAxis[]): void {
  for (const axis of axes) void view[axis];
}

/**
 * Bind a view to the page URL. Call during component initialisation: the
 * init half runs synchronously (SSR-safe — a `?sort=…` link renders sorted
 * server HTML), the runtime halves are effects.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { Table, createTableView } from '@urbicon-ui/table';
 *   import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';
 *
 *   const view = createTableView({ defaults: { pageSize: 25 } });
 *   bindViewToUrl(view);
 * </script>
 *
 * <Table {items} {columns} {view} />
 * ```
 */
export function bindViewToUrl(view: TableViewLike, options: UrlViewBindingOptions = {}): void {
  const axes = options.axes ?? TABLE_VIEW_AXES;
  const debounceMs = options.debounceMs ?? 300;
  const replaceState = options.replaceState ?? true;
  const reflectExternal = options.reflectExternal ?? false;
  const prefix = options.prefix ?? '';
  const managedKeys = viewAxisKeys(axes, prefix);
  /** Identity handle for the writer's job/key bookkeeping. */
  const owner = {};

  view.claimAxes('url', axes);
  // The writer registry serves the CLIENT writer only. Registering during
  // SSR would leak the request: the module-global map outlives the request
  // and only the effect teardown below — which never runs on the server —
  // releases an entry, so request 2 of the same route would throw the claims
  // error (and disjoint routes would grow the map without bound). The
  // fail-loud purpose — two prefixless bindings are a programming error —
  // is fully preserved client-side, where the same page renders again.
  if (browser) writer.register(owner, managedKeys);

  // ── Init phase: URL → view, synchronous. Absence means "not claimed" here
  // (storage may seed the axis later) — the only moment presence matters.
  // While prerendering there is no query string to read (SvelteKit forbids
  // touching `url.searchParams`), so the defaults are the truth for that
  // render; the client applies the real URL through the runtime effect.
  const initialSearch = building ? '' : untrack(() => page.url.search);
  if (!building) {
    const initialParams = new URLSearchParams(initialSearch);
    const named = viewAxesNamedBy(initialParams, prefix).filter((axis) => axes.includes(axis));
    const initialPartial = searchParamsToViewPartial(initialParams, view.defaults, prefix);
    const initApply: Partial<TableViewSnapshot> = {};
    for (const axis of named) {
      (initApply as Record<TableViewAxis, unknown>)[axis] = initialPartial[axis];
    }
    view.applyExternal(initApply, 'external');
    view.markInitApplied(named);
  }

  // ── Runtime: URL → view. From here on, absence on a *bound* axis means
  // "apply the default" (the back-button contract). Guarded against the
  // initial run so a storage seed applied between init and the first
  // navigation is not flattened back to the defaults — the precise line
  // where "init absence = unclaimed" turns into "runtime absence = default".
  let lastSeenSearch = initialSearch;
  $effect(() => {
    const search = page.url.search;
    if (search === lastSeenSearch) return;
    lastSeenSearch = search;
    untrack(() => {
      // The self-navigation marker: a landing the writer itself sent is not
      // applied back. The view already holds this state — or a NEWER one,
      // when the reader kept editing while the navigation was in flight, and
      // applying the stale landing would overwrite their edit.
      if (writer.classify(search) === 'self') return;
      lastSubmitted = null; // the URL basis changed under the binding
      const params = new URLSearchParams(search);
      const partial = searchParamsToViewPartial(params, view.defaults, prefix);
      const full: Partial<TableViewSnapshot> = {};
      for (const axis of axes) {
        (full as Record<TableViewAxis, unknown>)[axis] =
          partial[axis] !== undefined ? partial[axis] : view.defaults[axis];
      }
      view.applyExternal(full, 'external');
    });
  });

  // ── Runtime: view → URL, debounced. Echo suppression compares only the
  // binding's OWN key slice (canonicalised — key order in the URL is not the
  // binding's to dictate), against the slice it last *submitted* while a
  // navigation is in flight — comparing against the live URL there would
  // re-send (and re-race) states the writer is already carrying.
  const lastSeenRevision = zeroRevisions();
  for (const axis of axes) lastSeenRevision[axis] = untrack(() => view.originOf(axis).revision);

  let lastSubmitted: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const currentBaseline = (): string =>
    lastSubmitted ?? canonical(ownSlice(page.url.search, managedKeys));

  // Whether the pending debounce window saw a reader (or system) change, as
  // opposed to a pure external mirror (`reflectExternal`): a storage seed
  // reaching the URL must never mint a history entry the reader did not
  // cause, so a mirror-only submission always replaces.
  let pendingHasUserChange = false;

  $effect(() => {
    readAxes(view, axes); // track exactly the bound axes
    untrack(() => {
      let shouldMirror = reflectExternal;
      let sawUserChange = false;
      for (const axis of axes) {
        const { revision, origin } = view.originOf(axis);
        if (revision > lastSeenRevision[axis]) {
          lastSeenRevision[axis] = revision;
          // `system` mirrors too: the table cleaning a value may clean the
          // URL (virtualized × grouping). Only `external` (a binding
          // applying) stays silent.
          if (origin === 'user' || origin === 'system') {
            shouldMirror = true;
            sawUserChange = true;
          }
        }
      }
      if (!shouldMirror) return;
      if (sawUserChange) pendingHasUserChange = true;
      const serialized = viewSnapshotToSearchParams(view.snapshot(), view.defaults, axes, prefix);
      if (canonical(serialized) === currentBaseline()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        // Serialize from the *live* view — the debounce window may have seen
        // further changes; the last state is the one worth navigating to.
        const latest = viewSnapshotToSearchParams(view.snapshot(), view.defaults, axes, prefix);
        const latestCanonical = canonical(latest);
        const mirrorOnly = !pendingHasUserChange;
        pendingHasUserChange = false;
        if (latestCanonical === currentBaseline()) return;
        lastSubmitted = latestCanonical;
        writer.submit({
          owner,
          keys: managedKeys,
          params: latest,
          replaceState: mirrorOnly ? true : replaceState
        });
      }, debounceMs);
    });
    // No per-run teardown — the timer must survive unrelated re-runs, or
    // every keystroke would cancel the pending write.
  });

  // Destroy-only teardown: a dependency-free effect runs once; its teardown
  // fires when the owning scope is destroyed. Without it, a pending debounce
  // outlives the component and navigates with the dead table's params onto
  // whatever page comes next — and the claims would block a remounting child
  // (`{#if}`) on a longer-lived view from binding again.
  $effect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      view.releaseAxes('url', axes);
      writer.unregister(owner);
    };
  });
}
