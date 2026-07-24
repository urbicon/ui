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
import type { SummaryConfig, TablePersistenceConfig } from '../TableStore.svelte';
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
export function usePersistence(state: TableState, persistenceConfig?: TablePersistenceConfig) {
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

  if (persistenceConfig) {
    if (persistenceConfig.persistFilters !== false) {
      persistentFilters = createPersistentFilters({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentFilters.hasStoredValue && Array.isArray(persistentFilters.value)) {
        state.activeFilters = persistentFilters.value.filter(isFilterShape);
        hydratedFilters = true;
      }
    }

    if (persistenceConfig.persistSearch !== false) {
      persistentSearchTerm = createPersistentSearchTerm({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentSearchTerm.hasStoredValue && typeof persistentSearchTerm.value === 'string') {
        state.searchTerm = persistentSearchTerm.value;
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
        persistentGroupByKey.hasStoredValue &&
        (groupByValue === null || typeof groupByValue === 'string')
      ) {
        state.groupByKey = groupByValue;
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
        state.summaryConfigs = configs;
        // Only reveal the summary row when there is something to show — a
        // stored *empty* set means the user removed every summary.
        state.showSummary = configs.length > 0;
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
        persistentSortState.hasStoredValue &&
        sortValue &&
        typeof sortValue === 'object' &&
        typeof sortValue.column === 'string'
      ) {
        state.sortColumn = sortValue.column;
        state.sortDirection = sortValue.direction === 'desc' ? 'desc' : 'asc';
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
        for (const id of persistentSelection.value.filter(isRowId)) state.selectedIds.add(id);
        hydratedSelection = true;
      }
    }
  }

  // Sync functions called by other concerns after mutations
  // Every sync writes a *snapshot*, never the live array: the concerns mutate
  // their arrays in place (`state.summaryConfigs[i] = config`), so assigning the
  // same reference back would be no signal change at all — the auto-save effect
  // would not re-run and the edit would never reach storage.
  function syncFilters() {
    if (persistentFilters) persistentFilters.value = [...state.activeFilters];
  }

  function syncSearch() {
    if (persistentSearchTerm) persistentSearchTerm.value = state.searchTerm;
  }

  function syncGroupByKey() {
    if (persistentGroupByKey) persistentGroupByKey.value = state.groupByKey;
  }

  function syncSummaryConfigs() {
    if (persistentSummaryConfigs) persistentSummaryConfigs.value = [...state.summaryConfigs];
  }

  function syncSortState() {
    if (persistentSortState)
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
