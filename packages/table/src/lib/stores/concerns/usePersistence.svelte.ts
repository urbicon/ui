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
import type { TablePersistenceConfig } from '../TableStore.svelte';
import type { TableState } from './types';

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

  if (persistenceConfig) {
    if (persistenceConfig.persistFilters !== false) {
      persistentFilters = createPersistentFilters({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentFilters.value.length > 0) {
        state.activeFilters = persistentFilters.value;
      }
    }

    if (persistenceConfig.persistSearch !== false) {
      persistentSearchTerm = createPersistentSearchTerm({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentSearchTerm.value) {
        state.searchTerm = persistentSearchTerm.value;
      }
    }

    if (persistenceConfig.persistGroupByKey !== false) {
      persistentGroupByKey = createPersistentGroupByKey({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentGroupByKey.value) {
        state.groupByKey = persistentGroupByKey.value;
      }
    }

    if (persistenceConfig.persistSummaryConfigs !== false) {
      persistentSummaryConfigs = createPersistentSummaryConfigs({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentSummaryConfigs.value.length > 0) {
        state.summaryConfigs = persistentSummaryConfigs.value;
        state.showSummary = true;
      }
    }

    if (persistenceConfig.persistSort !== false) {
      persistentSortState = createPersistentSortState({
        tableId: persistenceConfig.tableId,
        storage: persistenceConfig.storage,
        debounceMs: persistenceConfig.debounceMs
      });
      if (persistentSortState.value.column) {
        state.sortColumn = persistentSortState.value.column;
        state.sortDirection = persistentSortState.value.direction;
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
      for (const id of persistentSelection.value) state.selectedIds.add(id);
    }
  }

  // Sync functions called by other concerns after mutations
  function syncFilters() {
    if (persistentFilters) persistentFilters.value = state.activeFilters;
  }

  function syncSearch() {
    if (persistentSearchTerm) persistentSearchTerm.value = state.searchTerm;
  }

  function syncGroupByKey() {
    if (persistentGroupByKey) persistentGroupByKey.value = state.groupByKey;
  }

  function syncSummaryConfigs() {
    if (persistentSummaryConfigs) persistentSummaryConfigs.value = state.summaryConfigs;
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
    get initialHiddenColumnIds(): string[] {
      return persistentHiddenColumns?.value ?? [];
    },
    get initialColumnOrder(): string[] {
      return persistentColumnOrder?.value ?? [];
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
