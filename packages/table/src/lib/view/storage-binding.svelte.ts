/**
 * The storage binding (kit-free half of the v8 binding pair). Decorates a
 * {@link TableView} with localStorage persistence: reads synchronously at
 * construction, applies once after hydration — from an effect, so it never
 * reaches server HTML — and only to axes no binding applied at init (the
 * deep-link precedence URL > storage). Writes on reader changes only: per
 * axis, the (revision, origin) pair decides, so an `external` application
 * (someone else's link) and a `system` discard (virtualized × grouping)
 * never land in storage.
 *
 * Phase contract: defaults (constructor) → URL (init, synchronous) →
 * storage (once, after hydration) → runtime (URL navigations apply; storage
 * never applies again, only writes).
 */
import { untrack } from 'svelte';
import type { Filter } from '$lib/types/tableTypes';
import type { TableView, TableViewSnapshot, ViewAxis, ViewSort } from './view.svelte';

/**
 * The storage binding's default axes EXCLUDE `page` — a measured finding, not
 * a whim: with all six axes bound, the reader's page was stored and restored
 * on the next visit, which persistence deliberately never does ("page 1 on
 * navigation is intentional UX"). The URL binding keeps all six (a shared
 * link SHOULD name its page).
 *
 * `pageSize` staying IN is a deliberate behaviour delta against v7: no
 * pagination value used to be persisted at all. "Yesterday's page size is
 * still set" is squarely the storage binding's promise, so it stays —
 * flagged in the v8 notes alongside the seed-resync delta.
 */
export const STORAGE_DEFAULT_AXES: readonly ViewAxis[] = [
  'search',
  'sort',
  'pageSize',
  'filters',
  'groupBy'
];

/** Options for {@link bindViewToStorage}. */
export interface StorageBindingOptions {
  /** Unique identifier for this table — used as the storage-key suffix. */
  key: string;
  /** Axes to persist. @default STORAGE_DEFAULT_AXES (all but `page`) */
  axes?: readonly ViewAxis[];
  /** Storage to use. @default window.localStorage */
  storage?: Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;
  /** Write debounce in ms. @default 500 */
  debounceMs?: number;
}

/** What {@link bindViewToStorage} hands back — the two imperative affordances. */
export interface StorageBindingHandle {
  /**
   * Remove this table's stored view entry (and drop any pending write) — the
   * "reset saved view" button. The live view is untouched; only storage is.
   */
  clear(): void;
  /**
   * Write pending changes immediately instead of waiting for the debounce.
   * Useful right before a programmatic navigation — the destroy teardown
   * deliberately DROPS pending writes (no side effects after death), so an
   * edit younger than `debounceMs` is lost on unmount unless flushed.
   */
  flush(): void;
}

const FILTER_OPERATORS = new Set([
  'contains',
  'equals',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan'
]);

function isFilterShape(value: unknown): value is Filter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Partial<Filter>;
  return (
    typeof filter.column === 'string' &&
    filter.column.length > 0 &&
    typeof filter.operator === 'string' &&
    FILTER_OPERATORS.has(filter.operator) &&
    typeof filter.value === 'string'
  );
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

/**
 * Per-axis shape validation of a stored value. A stored value is JSON the
 * user's browser handed back — it can be any shape (a hand-edited key, a
 * value written by an older version, another app on the same origin), and it
 * reaches `$derived` pipelines that assume their fields exist. Same
 * read-tolerance class as everywhere else: a malformed value reads as
 * "nothing stored" (returns `undefined`); malformed filter *elements* are
 * dropped individually.
 */
function validateAxisValue(axis: ViewAxis, value: unknown): unknown {
  switch (axis) {
    case 'search':
      return typeof value === 'string' ? value : undefined;
    case 'sort': {
      if (value === null) return null;
      if (!value || typeof value !== 'object') return undefined;
      const sort = value as Partial<ViewSort>;
      if (typeof sort.column !== 'string' || sort.column.length === 0) return undefined;
      return {
        column: sort.column,
        direction: sort.direction === 'desc' ? 'desc' : 'asc'
      } satisfies ViewSort;
    }
    case 'page':
    case 'pageSize':
      return isPositiveInt(value) ? value : undefined;
    case 'filters':
      return Array.isArray(value) ? value.filter(isFilterShape) : undefined;
    case 'groupBy':
      return value === null || (typeof value === 'string' && value.length > 0) ? value : undefined;
  }
}

const zeroRevisions = (): Record<ViewAxis, number> => ({
  search: 0,
  sort: 0,
  page: 0,
  pageSize: 0,
  filters: 0,
  groupBy: 0
});

/** Read exactly the bound axes through the view's getters — tracked. */
function readAxes(view: TableView, axes: readonly ViewAxis[]): void {
  for (const axis of axes) void view[axis];
}

/**
 * Bind a view to web storage. Call during component initialisation (the
 * runtime halves are effects). SSR-safe: on the server there is no storage,
 * so construction reads nothing and the effects never run.
 *
 * @example "Yesterday's view is still there"
 * ```ts
 * const view = createTableView({ defaults: { pageSize: 25 } });
 * bindViewToStorage(view, { key: 'invoices' });
 * ```
 */
export function bindViewToStorage(
  view: TableView,
  options: StorageBindingOptions
): StorageBindingHandle {
  const axes = options.axes ?? STORAGE_DEFAULT_AXES;
  const debounceMs = options.debounceMs ?? 500;
  const storage =
    options.storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  const storageKey = `urbicon_table_view_${options.key}_v1`;

  view.claimAxes('storage', axes);

  // Synchronous read — construction time. Corrupt entries count as absent.
  let stored: Record<string, unknown> | null = null;
  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          stored = parsed as Record<string, unknown>;
        }
      }
    } catch {
      stored = null;
    }
  }

  // ── Apply once, after hydration. The decision *which* axes to apply is
  // taken here rather than at construction, which is what makes registration
  // order irrelevant: by the time effects run, every binding created during
  // component init has registered its init claims.
  //
  // "Once" is scoped to the VIEW's lifetime, not this binding's: the marks
  // live on the view (`markStorageApplied`), so a remounting child (`{#if}`)
  // on a longer-lived view does not re-hydrate stale storage over state the
  // reader has since changed — the phase contract says storage never applies
  // again, and a remount does not restart the view's life.
  let applied = false;
  $effect(() => {
    if (applied) return;
    applied = true;
    untrack(() => {
      const freshAxes = axes.filter((axis) => !view.wasStorageApplied(axis));
      view.markStorageApplied(freshAxes);
      if (!stored) return;
      const partial: Partial<TableViewSnapshot> = {};
      for (const axis of freshAxes) {
        if (axis in stored && !view.wasInitApplied(axis)) {
          const value = validateAxisValue(axis, stored[axis]);
          if (value !== undefined) {
            (partial as Record<ViewAxis, unknown>)[axis] = value;
          }
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

  function writePending(): void {
    if (pending.size === 0 || !storage) return;
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
    try {
      storage.setItem(storageKey, JSON.stringify(current));
    } catch {
      // Quota/security errors must not take the table down — the view
      // simply stops being persisted, same as with storage disabled.
    }
  }

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
            // if the reader had chosen it.
            pending.delete(axis);
          }
        }
      }
      if (!dirty || !storage) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        writePending();
      }, debounceMs);
    });
    // No per-run teardown — the timer must survive unrelated re-runs, or
    // every keystroke would cancel the pending write.
  });

  // Destroy-only teardown: drop the pending write instead of letting it fire
  // after unmount (no side effects after death), and release the claims so a
  // remounting child on a longer-lived view can bind again.
  $effect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending.clear();
      view.releaseAxes('storage', axes);
    };
  });

  return {
    clear() {
      pending.clear();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        storage?.removeItem?.(storageKey);
      } catch {
        // Same containment as the write path.
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      writePending();
    }
  };
}
