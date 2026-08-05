/**
 * SPIKE §3.3 / §7.1 / §7.2 — the two bindings as decorations OVER the view
 * object, plus a fake URL with SvelteKit's timing (setter synchronous, `goto`
 * applying asynchronously) so the race the old write gate existed for is
 * reproducible in a test.
 *
 * Phase contract (§3.3): defaults (constructor) → URL (init, synchronous,
 * SSR too) → storage (after hydration) → runtime (URL navigations apply;
 * storage never applies again, only writes).
 */
import { untrack } from 'svelte';
import { axesNamedBy, searchParamsToViewPartial, viewToSearchParams } from './serialize';
import { type TableView, type TableViewSnapshot, VIEW_AXES, type ViewAxis } from './view.svelte';

/**
 * Stand-in for SvelteKit's page/goto pair, with the one property that made
 * the old ownership question racy: writes apply in a microtask, reads are
 * reactive. Keeps a history stack so the back button is testable.
 */
export class FakeUrl {
  #search = $state('');
  #history: string[];
  /** Measurement counters. */
  gotoCount = 0;
  pushCount = 0;

  constructor(initial = '') {
    this.#search = initial;
    this.#history = [initial];
  }

  get search(): string {
    return this.#search;
  }

  goto(search: string, opts: { replaceState?: boolean } = {}): void {
    this.gotoCount += 1;
    const replaceState = opts.replaceState ?? true;
    queueMicrotask(() => {
      if (replaceState) {
        this.#history[this.#history.length - 1] = search;
      } else {
        this.#history.push(search);
        this.pushCount += 1;
      }
      this.#search = search;
    });
  }

  /** The back button — synchronous, like a popstate delivering a new URL. */
  back(): void {
    if (this.#history.length > 1) {
      this.#history.pop();
      this.#search = this.#history[this.#history.length - 1];
    }
  }
}

/** Read exactly the bound axes through the view's getters — tracked. */
function readAxes(view: TableView, axes: readonly ViewAxis[]): void {
  for (const axis of axes) void view[axis];
}

const zeroRevisions = (): Record<ViewAxis, number> => ({
  search: 0,
  sort: 0,
  page: 0,
  pageSize: 0,
  filters: 0,
  groupBy: 0
});

export interface UrlBindingOptions {
  axes?: readonly ViewAxis[];
  debounceMs?: number;
  replaceState?: boolean;
  /**
   * §3.3 open UX question, both variants buildable: `true` mirrors *every*
   * divergence between view and URL (a storage seed becomes shareable
   * immediately, via replaceState); `false` (today's behaviour) mirrors only
   * once a `user` or `system` change occurs — the full snapshot is written
   * then, so the seed reaches the URL with the first interaction.
   */
  reflectExternal?: boolean;
}

/**
 * URL binding. Init applies synchronously (SSR-safe: no effects involved in
 * the init half); the runtime halves are effects and need a reactivity
 * context (component init or `$effect.root`).
 */
export function bindViewToUrl(view: TableView, url: FakeUrl, options: UrlBindingOptions = {}) {
  const axes = options.axes ?? VIEW_AXES;
  const debounceMs = options.debounceMs ?? 300;
  const reflectExternal = options.reflectExternal ?? false;

  view.claimAxes('url', axes);

  // ── Init phase: URL → view, synchronous. Absence means "not claimed" here
  // (storage may seed the axis later) — the only moment presence matters.
  const initialSearch = untrack(() => url.search);
  const initialParams = new URLSearchParams(initialSearch);
  const named = axesNamedBy(initialParams).filter((axis) => axes.includes(axis));
  const initialPartial = searchParamsToViewPartial(initialParams);
  const initApply: Partial<TableViewSnapshot> = {};
  for (const axis of named) {
    (initApply as Record<ViewAxis, unknown>)[axis] = initialPartial[axis];
  }
  view.applyExternal(initApply, 'external');
  view.markInitApplied(named);

  // ── Runtime: URL → view. From here on, absence on a *bound* axis means
  // "apply the default" (the back-button contract, m6/Prüfstein 17). Guarded
  // against the initial run so a storage seed applied between init and the
  // first navigation is not flattened back to the defaults.
  let lastSeenSearch = initialSearch;
  $effect(() => {
    const search = url.search;
    if (search === lastSeenSearch) return;
    lastSeenSearch = search;
    untrack(() => {
      const params = new URLSearchParams(search);
      const partial = searchParamsToViewPartial(params);
      const full: Partial<TableViewSnapshot> = {};
      for (const axis of axes) {
        (full as Record<ViewAxis, unknown>)[axis] =
          partial[axis] !== undefined ? partial[axis] : view.defaults[axis];
      }
      view.applyExternal(full, 'external');
    });
  });

  // ── Runtime: view → URL, debounced, echo-suppressed by comparing the
  // serialisation against the current URL before any `goto`.
  const lastSeenRevision = zeroRevisions();
  for (const axis of axes) lastSeenRevision[axis] = untrack(() => view.originOf(axis).revision);

  let timer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    readAxes(view, axes); // track exactly the bound axes
    untrack(() => {
      let shouldMirror = reflectExternal;
      for (const axis of axes) {
        const { revision, origin } = view.originOf(axis);
        if (revision > lastSeenRevision[axis]) {
          lastSeenRevision[axis] = revision;
          // `system` mirrors too: the table cleaning a value may clean the
          // URL (M6). Only `external` (a binding applying) stays silent.
          if (origin === 'user' || origin === 'system') shouldMirror = true;
        }
      }
      if (!shouldMirror) return;
      const serialized = viewToSearchParams(view.snapshot(), view.defaults, axes).toString();
      if (serialized === normalizeSearch(url.search)) return; // echo suppression
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        // Serialize from the *live* view — the debounce window may have seen
        // further changes; the last state is the one worth navigating to.
        const latest = viewToSearchParams(view.snapshot(), view.defaults, axes).toString();
        if (latest === normalizeSearch(url.search)) return;
        url.goto(latest, { replaceState: options.replaceState ?? true });
      }, debounceMs);
    });
    // No teardown that clears the timer between runs — it must survive them,
    // or every keystroke would cancel the pending write.
  });
}

function normalizeSearch(search: string): string {
  return new URLSearchParams(search).toString();
}

/**
 * The storage binding's default axes EXCLUDE `page` — a spike finding, not a
 * whim: with all six axes bound, the first composition test stored the
 * reader's page and restored it on the next visit, which today's persistence
 * deliberately never does ("page 1 on navigation is intentional UX"). The
 * two bindings therefore need different axis defaults; the URL binding keeps
 * all six (a shared link SHOULD name its page).
 */
export const STORAGE_DEFAULT_AXES: readonly ViewAxis[] = [
  'search',
  'sort',
  'pageSize',
  'filters',
  'groupBy'
];

export interface StorageBindingOptions {
  key: string;
  axes?: readonly ViewAxis[];
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  debounceMs?: number;
}

/**
 * Storage binding (kit-free). Reads synchronously at construction, applies
 * once after hydration — from an effect, so it never reaches server HTML —
 * and only to axes no earlier-initialised binding applied at init. Writes on
 * reader changes only: per axis, the (revision, origin) pair decides, so an
 * `external` application (someone else's link) and a `system` discard
 * (virtualized × grouping) never land in storage.
 */
export function bindViewToStorage(view: TableView, options: StorageBindingOptions) {
  const axes = options.axes ?? STORAGE_DEFAULT_AXES;
  const debounceMs = options.debounceMs ?? 500;
  const storage = options.storage ?? window.localStorage;
  const storageKey = `urbicon_table_view_${options.key}_v1`;

  view.claimAxes('storage', axes);

  // Synchronous read — construction time, like today.
  let stored: Record<string, unknown> | null = null;
  try {
    const raw = storage.getItem(storageKey);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        stored = parsed as Record<string, unknown>;
      }
    }
  } catch {
    stored = null; // corrupt entry counts as absent
  }

  // ── Apply once, after hydration. The decision *which* axes to apply is
  // taken here rather than at construction, which is what makes registration
  // order irrelevant: by the time effects run, every binding created during
  // component init has registered its init claims (measured both orders in
  // spike.composition.svelte.test.ts).
  let applied = false;
  $effect(() => {
    if (applied) return;
    applied = true;
    untrack(() => {
      if (!stored) return;
      const partial: Partial<TableViewSnapshot> = {};
      for (const axis of axes) {
        if (axis in stored && !view.wasInitApplied(axis)) {
          (partial as Record<ViewAxis, unknown>)[axis] = stored[axis];
        }
      }
      view.applyExternal(partial, 'external');
    });
  });

  // ── Write on reader changes, per axis, debounced. `pending` remembers
  // *which* axes are dirty; the values are read live in the flush so the
  // last edit inside the debounce window is what lands in storage.
  const lastSeenRevision = zeroRevisions();
  for (const axis of axes) lastSeenRevision[axis] = untrack(() => view.originOf(axis).revision);

  const pending = new Set<ViewAxis>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    readAxes(view, axes); // track exactly the bound axes
    untrack(() => {
      let dirty = false;
      for (const axis of axes) {
        const { revision, origin } = view.originOf(axis);
        if (revision > lastSeenRevision[axis]) {
          lastSeenRevision[axis] = revision;
          if (origin === 'user') {
            pending.add(axis);
            dirty = true;
          } else {
            // The design rule verbatim: an axis is written only when its LAST
            // change was the reader's. A later external application or system
            // discard un-dirties it — without this, a user edit followed by a
            // system discard inside one debounce window stored the discard as
            // if the reader had chosen it (measured in spike.origin).
            pending.delete(axis);
          }
        }
      }
      if (!dirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (pending.size === 0) return;
        let current: Record<string, unknown> = {};
        try {
          const raw = storage.getItem(storageKey);
          const parsed: unknown = raw === null ? {} : JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            current = parsed as Record<string, unknown>;
          }
        } catch {
          current = {};
        }
        const live = view.snapshot();
        for (const axis of pending) current[axis] = live[axis];
        pending.clear();
        storage.setItem(storageKey, JSON.stringify(current));
      }, debounceMs);
    });
  });
}
