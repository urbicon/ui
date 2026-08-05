import type { Filter } from '$lib/types/tableTypes';
import {
  createPersistentColumnOrder,
  createPersistentFilters,
  createPersistentGroupByKey,
  createPersistentHiddenColumns,
  createPersistentSearchTerm,
  createPersistentSelection,
  createPersistentSortState,
  createPersistentSummaryConfigs
} from '$lib/utils';
import type { SummaryConfig, TablePersistenceConfig, TableViewState } from '../TableStore.svelte';
import type { TableState } from './types';

/**
 * Element-level shape guards. A stored value is JSON the user's browser
 * handed back — it can be any shape (a hand-edited key, a value written by an
 * older version, another app on the same origin). Container checks alone let
 * garbage *elements* through, and those reach `$derived` pipelines that assume
 * their fields exist: a filter without `column` threw on every render, from a
 * key the UI offers no way to clear. Malformed elements are dropped; if that
 * leaves the axis unusable, the whole entry counts as absent so a seed applies.
 */
function isFilterShape(value: unknown): value is Filter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Partial<Filter>;
  return typeof filter.column === 'string' && typeof filter.operator === 'string';
}

function isSummaryConfigShape(value: unknown): value is SummaryConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<SummaryConfig>;
  return typeof config.column === 'string' && typeof config.type === 'string';
}

function isRowId(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Persistence concern: manages syncing table state to/from storage.
 *
 * State on the shared `state` object (search, filters, group, summary,
 * sort) is hydrated directly here before downstream concerns initialise.
 * State that lives inside other concerns (column visibility, column
 * order) cannot be reached from here — those values are exposed via the
 * `initialHiddenColumnIds` / `initialColumnOrder` getters so the host
 * `TableStore` can hand them back to the owning concern after init.
 *
 * Mutating concerns call the matching `sync*` function after each
 * mutation; `usePersistence` debounces the write to storage internally
 * (default 500 ms, configurable via `persistenceConfig.debounceMs`).
 *
 * **Stored empty is a real state.** Hydration keys off
 * `hasStoredValue` (does storage hold an entry?), not off "is the value
 * non-empty" — so an axis the user *cleared* (no sort, no filters, no
 * grouping, no summaries, nothing selected) restores as cleared instead
 * of reading like "nothing stored". The `hydrated*` getters report that
 * per axis so the host store can keep its `initial*` seeds off an axis
 * persistence already owns. A missing **or corrupt** entry counts as
 * absent, so junk in storage can never block a seed permanently.
 */
export function usePersistence(
  state: TableState,
  persistenceConfig?: TablePersistenceConfig,
  controlledView?: () => TableViewState | undefined
) {
  /**
   * Does the controlled view state (normally the URL) own this axis?
   *
   * Per-field, by presence — the rule `syncSearch` already applied to
   * `searchControlled`, generalised. An owned axis is neither hydrated from
   * storage nor written back to it: the URL is the source of truth, and a value
   * copied into storage alongside would resurface the moment the table stopped
   * being controlled (#152, precedence URL > localStorage > `initial*` seed).
   */
  const owns = (axis: keyof TableViewState): boolean => controlledView?.()?.[axis] !== undefined;

  /**
   * Whether the shareable axes may be written to storage at all.
   *
   * Keyed on *whether a `query` prop is wired*, *not* on whether it happens to
   * carry this axis right now — and that distinction is the whole of it.
   * `owns()` reads the live URL, but the URL lags the state it mirrors: a click
   * runs `setSort` synchronously, while `onQueryChange` is debounced and
   * `goto()` is async on top. Asking `owns()` at write time therefore answers
   * "no" for the first change on a bare URL and "yes" for every one after it.
   *
   * Measured with the documented wiring and `persistControlled` at its default:
   * the reader sorts by amount (written to storage, URL still bare), the URL
   * catches up, the reader sorts by date (not written) — and the next bare
   * visit restores *amount*, the sort they abandoned. Neither "nothing is
   * stored" nor "everything is stored", but a stale intermediate, chosen by a
   * race.
   *
   * So: wire `query` and the shareable axes live in the URL, full stop.
   * `persistControlled: true` opts back into storing them as well, and it is
   * safe to unlock because only a *setter* writes — the `sync*` functions are
   * called from the store's action wrappers, never from a controlled derived
   * resolving, so following a shared link stores nothing.
   */
  const storeControlled = persistenceConfig?.persistControlled === true;
  const queryWired = (): boolean => controlledView?.() !== undefined;
  /** May the shareable axes be written to storage? */
  const writable = (): boolean => storeControlled || !queryWired();

  /**
   * Sort is **one** axis across two fields, and both hydration and write-back
   * touch both slots. Keying them off `sortColumn` alone let a controlled
   * `sortDirection` be overwritten by a stored one: `{ sortDirection: 'desc' }`
   * with `{column:'amount',direction:'asc'}` in storage hydrated the direction
   * to `'asc'` over a derived that resolved to `'desc'`, and kept writing the
   * controlled table's sort back into storage.
   */
  const ownsSort = (): boolean => owns('sortColumn') || owns('sortDirection');
  let persistentFilters: ReturnType<typeof createPersistentFilters> | undefined;
  let persistentSearchTerm: ReturnType<typeof createPersistentSearchTerm> | undefined;
  let persistentGroupByKey: ReturnType<typeof createPersistentGroupByKey> | undefined;
  let persistentSummaryConfigs: ReturnType<typeof createPersistentSummaryConfigs> | undefined;
  let persistentSortState: ReturnType<typeof createPersistentSortState> | undefined;
  let persistentHiddenColumns: ReturnType<typeof createPersistentHiddenColumns> | undefined;
  let persistentColumnOrder: ReturnType<typeof createPersistentColumnOrder> | undefined;
  let persistentSelection: ReturnType<typeof createPersistentSelection> | undefined;

  // Per-axis "persistence supplied this axis" flags. Set only when storage
  // held a parseable entry of the expected shape — an absent, corrupt or
  // wrongly-shaped entry leaves the axis untouched (and lets a seed apply).
  // The host store reads these through the `hydrated*` getters below.
  let hydratedFilters = false;
  let hydratedGroupByKey = false;
  let hydratedSummaryConfigs = false;
  let hydratedSort = false;
  let hydratedSelection = false;

  /**
   * The writes hydration would make, held back until `applyPersistedState()`.
   *
   * Reading storage stays here at construction — it is synchronous, and the
   * `hydrated*` flags below have to be right before the host store runs its
   * `initial*` seeds. What moves is the *assignment*: storage exists only in
   * the browser, so applying it during construction made the client's first
   * render disagree with the server's HTML. Measured with `{amount, asc}`
   * stored: the server emitted Ada/Grace and the client mounted Grace/Ada.
   *
   * See the SSR section of `TablePersistenceConfig` for why this is one rule
   * for every axis rather than a judgement per axis.
   */
  const pending: Array<() => void> = [];

  if (persistenceConfig) {
    if (persistenceConfig.persistFilters !== false) {
      persistentFilters = createPersistentFilters({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (
        !owns('activeFilters') &&
        persistentFilters.hasStoredValue &&
        Array.isArray(persistentFilters.value)
      ) {
        const filters = persistentFilters.value.filter(isFilterShape);
        pending.push(() => {
          state.activeFilters = filters;
        });
        hydratedFilters = true;
      }
    }

    if (persistenceConfig.persistSearch !== false) {
      persistentSearchTerm = createPersistentSearchTerm({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (
        !owns('searchTerm') &&
        persistentSearchTerm.hasStoredValue &&
        typeof persistentSearchTerm.value === 'string'
      ) {
        const term = persistentSearchTerm.value;
        pending.push(() => {
          state.searchTerm = term;
        });
      }
    }

    if (persistenceConfig.persistGroupByKey !== false) {
      persistentGroupByKey = createPersistentGroupByKey({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      const groupByValue = persistentGroupByKey.value;
      if (
        !owns('groupByKey') &&
        persistentGroupByKey.hasStoredValue &&
        (groupByValue === null || typeof groupByValue === 'string')
      ) {
        pending.push(() => {
          state.groupByKey = groupByValue;
        });
        hydratedGroupByKey = true;
      }
    }

    if (persistenceConfig.persistSummaryConfigs !== false) {
      persistentSummaryConfigs = createPersistentSummaryConfigs({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (
        persistentSummaryConfigs.hasStoredValue &&
        Array.isArray(persistentSummaryConfigs.value)
      ) {
        const configs = persistentSummaryConfigs.value.filter(isSummaryConfigShape);
        pending.push(() => {
          state.summaryConfigs = configs;
          // Only reveal the summary row when there is something to show — a
          // stored *empty* set means the user removed every summary.
          state.showSummary = configs.length > 0;
        });
        hydratedSummaryConfigs = true;
      }
    }

    if (persistenceConfig.persistSort !== false) {
      persistentSortState = createPersistentSortState({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      const sortValue = persistentSortState.value;
      if (
        !ownsSort() &&
        persistentSortState.hasStoredValue &&
        sortValue &&
        typeof sortValue === 'object' &&
        typeof sortValue.column === 'string'
      ) {
        const column = sortValue.column;
        const direction = sortValue.direction === 'desc' ? 'desc' : 'asc';
        pending.push(() => {
          state.sortColumn = column;
          state.sortDirection = direction;
        });
        hydratedSort = true;
      }
    }

    if (persistenceConfig.persistColumnVisibility !== false) {
      persistentHiddenColumns = createPersistentHiddenColumns({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
    }

    if (persistenceConfig.persistColumnOrder !== false) {
      persistentColumnOrder = createPersistentColumnOrder({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
    }

    // Selection is opt-in (default off), unlike every axis above: restoring a
    // stale selection across reloads is often surprising. `selectedIds` lives
    // on the shared `state` (like filters/search), so hydrate it directly here
    // — no concern handback needed. A controlled `selectedIds` prop re-applies
    // after construction and wins, so persistence is a no-op in that case.
    if (persistenceConfig.persistSelection === true) {
      persistentSelection = createPersistentSelection({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentSelection.hasStoredValue && Array.isArray(persistentSelection.value)) {
        const ids = persistentSelection.value.filter(isRowId);
        pending.push(() => {
          for (const id of ids) state.selectedIds.add(id);
        });
        hydratedSelection = true;
      }
    }
  }

  /**
   * Apply everything storage supplied. Called once, from an `$effect` in
   * `TableProvider` — which is the hydration boundary: it does not run on the
   * server, and on the client it runs before the browser paints.
   *
   * Idempotent, and drains itself so a second call cannot re-apply a snapshot
   * over a value the user has since changed.
   */
  function applyPersistedState(): void {
    while (pending.length > 0) pending.shift()?.();
  }

  // A controlled axis counts as "already supplied" for the `initial*` seeds,
  // whether or not persistence is configured at all — which is why this sits
  // outside the block above. Without it a `query` carrying an explicitly empty
  // axis (`?sort=` elided from the URL means "no sort", a real state the reader
  // chose) would read as "nothing supplied" and let the seed sort the view back.
  if (owns('activeFilters')) hydratedFilters = true;
  if (owns('groupByKey')) hydratedGroupByKey = true;
  if (ownsSort()) hydratedSort = true;

  // Sync functions called by other concerns after mutations
  // Every sync writes a *snapshot*, never the live array: the concerns mutate
  // their arrays in place (`state.summaryConfigs[i] = config`), so assigning the
  // same reference back would be no signal change at all — the auto-save effect
  // would not re-run and the edit would never reach storage.
  function syncFilters() {
    if (persistentFilters && writable()) {
      persistentFilters.value = [...state.activeFilters];
    }
  }

  // `searchControlled` is NOT part of `writable`: that is the separate
  // `searchTerm` *prop*, whose value the consumer owns outright and re-applies
  // on every render. `persistControlled` is about the `query` prop, where the
  // table still owns the value between navigations.
  function syncSearch() {
    if (persistentSearchTerm && !state.searchControlled && writable()) {
      persistentSearchTerm.value = state.searchTerm;
    }
  }

  function syncGroupByKey() {
    // `!state.groupControlled` for the same reason `syncSearch` carries it: the
    // standalone `groupByKey` prop is applied through an effect, so without the
    // guard a value the consumer drives would be stored as if the reader had
    // chosen it — and reappear on a later visit that no longer passes the prop.
    // This is the prop path, not the `query.groupByKey` axis; that one is what
    // `writable()` / `persistControlled` govern.
    if (persistentGroupByKey && !state.groupControlled && writable()) {
      persistentGroupByKey.value = state.groupByKey;
    }
  }

  function syncSummaryConfigs() {
    if (persistentSummaryConfigs) persistentSummaryConfigs.value = [...state.summaryConfigs];
  }

  function syncSortState() {
    if (persistentSortState && writable())
      persistentSortState.value = {
        column: state.sortColumn,
        direction: state.sortDirection
      };
  }

  function syncHiddenColumns(hiddenIds: string[]) {
    if (persistentHiddenColumns) persistentHiddenColumns.value = hiddenIds;
  }

  function syncColumnOrder(order: string[]) {
    if (persistentColumnOrder) persistentColumnOrder.value = order;
  }

  // No argument: reads the shared `state.selectedIds` itself (like syncSearch),
  // so the spread only runs when selection persistence is actually enabled.
  // Skipped while selection is controlled — the prop is the source of truth, so
  // a controlled value must never reach storage (it would resurrect on a later
  // switch to uncontrolled).
  function syncSelection() {
    if (persistentSelection && !state.selectionControlled) {
      persistentSelection.value = [...state.selectedIds];
    }
  }

  // Public API
  function clearAllPersistentData() {
    persistentFilters?.reset();
    persistentSearchTerm?.reset();
    persistentGroupByKey?.reset();
    persistentSummaryConfigs?.reset();
    persistentSortState?.reset();
    persistentHiddenColumns?.reset();
    persistentColumnOrder?.reset();
    persistentSelection?.reset();
  }

  function forceSavePersistentData() {
    persistentFilters?.forceSave();
    persistentSearchTerm?.forceSave();
    persistentGroupByKey?.forceSave();
    persistentSummaryConfigs?.forceSave();
    persistentSortState?.forceSave();
    persistentHiddenColumns?.forceSave();
    persistentColumnOrder?.forceSave();
    persistentSelection?.forceSave();
  }

  return {
    applyPersistedState,
    syncFilters,
    syncSearch,
    syncGroupByKey,
    syncSummaryConfigs,
    syncSortState,
    syncHiddenColumns,
    syncColumnOrder,
    syncSelection,
    // Hand-back snapshots for the two axes that live inside other concerns.
    // Same read-tolerance as the hydration above: a hand-edited entry that is
    // not an array of ids reads as "nothing persisted" rather than being
    // iterated (a bare string would otherwise hide one column per character).
    get initialHiddenColumnIds(): string[] {
      const stored = persistentHiddenColumns?.value;
      return Array.isArray(stored) ? stored : [];
    },
    get initialColumnOrder(): string[] {
      const stored = persistentColumnOrder?.value;
      return Array.isArray(stored) ? stored : [];
    },
    // "Persistence owns this axis" — true when storage held an entry for it,
    // including a stored *empty* one. The host store's `initial*` seeds check
    // these so a cleared axis is not re-seeded on the next load. Column
    // visibility and column order have no seed, so they need no flag: applying
    // a stored-empty snapshot there is indistinguishable from not applying it.
    get hydratedFilters(): boolean {
      return hydratedFilters;
    },
    get hydratedGroupByKey(): boolean {
      return hydratedGroupByKey;
    },
    get hydratedSummaryConfigs(): boolean {
      return hydratedSummaryConfigs;
    },
    get hydratedSort(): boolean {
      return hydratedSort;
    },
    get hydratedSelection(): boolean {
      return hydratedSelection;
    },
    clearPersistedFilters: () => persistentFilters?.reset(),
    clearPersistedSearchTerm: () => persistentSearchTerm?.reset(),
    clearPersistedGroupByKey: () => persistentGroupByKey?.reset(),
    clearPersistedSummaryConfigs: () => persistentSummaryConfigs?.reset(),
    clearPersistedSortState: () => persistentSortState?.reset(),
    clearPersistedHiddenColumns: () => persistentHiddenColumns?.reset(),
    clearPersistedColumnOrder: () => persistentColumnOrder?.reset(),
    clearPersistedSelection: () => persistentSelection?.reset(),
    clearAllPersistentData,
    forceSavePersistentData
  };
}
