import { createOptionalContext } from '@urbicon-ui/blocks';
import { SvelteSet } from 'svelte/reactivity';
import type { Column, Filter, FilterOperator, TableItem } from '$lib';
import {
  findColumnById,
  getNestedValue,
  normalizeItems,
  resolveColumnId,
  resolveColumnValue,
  resolveValueById
} from '$lib/utils';
import type { TableState } from './concerns/types.js';
import { useColumnOrder } from './concerns/useColumnOrder.svelte.js';
import { useColumnVisibility } from './concerns/useColumnVisibility.svelte.js';
import { useExpansion } from './concerns/useExpansion.svelte.js';
import { useFiltering } from './concerns/useFiltering.svelte.js';
import { useFocusManagement } from './concerns/useFocusManagement.svelte.js';
import { useGrouping } from './concerns/useGrouping.svelte.js';
import { useLiveUpdates } from './concerns/useLiveUpdates.svelte.js';
import { usePagination } from './concerns/usePagination.svelte.js';
import { usePersistence } from './concerns/usePersistence.svelte.js';
import { useRemoteData } from './concerns/useRemoteData.svelte.js';
import { useSearch } from './concerns/useSearch.svelte.js';
import { useSelection } from './concerns/useSelection.svelte.js';
import { useSorting } from './concerns/useSorting.svelte.js';
import { useSummary } from './concerns/useSummary.svelte.js';

/**
 * Table context key (deprecated — kept for backwards compatibility).
 * Prefer `setTableContext()`/`getTableContext()` directly; the value is
 * no longer used internally now that the context goes through
 * `createContext<T>()`.
 * @deprecated Use `setTableContext`/`getTableContext` instead.
 */
export const TABLE_CONTEXT_KEY = 'table';

/**
 * Column summary configuration.
 * Defines which column to aggregate and how.
 */
export interface SummaryConfig {
  /** Column key to aggregate */
  column: string;
  /** Aggregation type */
  type: 'sum' | 'avg' | 'count' | 'min' | 'max';
  /** Optional custom formatter for the aggregated value */
  formatter?: (value: number) => string;
}

/**
 * Configuration for table state persistence across reloads.
 *
 * Each `persist*` axis defaults to `true` — providing a `tableId` is
 * enough to opt every view-state axis (filters, search, group, summary,
 * sort, column visibility, column order) into persistence. Set
 * individual flags to `false` to keep them volatile.
 *
 * Storage defaults to `localStorage` for every axis so reloads,
 * tab-close-and-reopen, and full browser restarts all restore the view.
 * Pass `storage: 'sessionStorage'` to limit persistence to the current
 * tab. Pagination (current page) is never persisted — page 1 on
 * navigation is intentional UX.
 */
export interface TablePersistenceConfig {
  /** Unique identifier for this table — used as the storage-key suffix. */
  tableId: string;
  /** Storage type for every axis. Defaults to `localStorage`. */
  storage?: 'localStorage' | 'sessionStorage';
  /** Write debounce in ms. Defaults to 500. */
  debounceMs?: number;
  /** Persist `activeFilters`. Default `true`. */
  persistFilters?: boolean;
  /** Persist `searchTerm`. Default `true`. */
  persistSearch?: boolean;
  /** Persist `groupByKey`. Default `true`. */
  persistGroupByKey?: boolean;
  /** Persist `summaryConfigs`. Default `true`. */
  persistSummaryConfigs?: boolean;
  /** Persist `sortColumn` + `sortDirection`. Default `true`. */
  persistSort?: boolean;
  /** Persist hidden column ids. Default `true`. */
  persistColumnVisibility?: boolean;
  /** Persist column order. Default `true`. */
  persistColumnOrder?: boolean;
}

/**
 * Creates the table state by composing independent concerns.
 *
 * Derived chain: items → filteredItems → sortedItems → grouped → paginatedItems
 *
 * Each concern owns a slice of functionality (search, filtering, sorting, etc.)
 * but all read from and write to a shared reactive state object.
 *
 * **Generic T erasure**: The consumer-facing `TableProps<T>` is generic, but the
 * store operates on `TableItem` (`Record<string, unknown>`). This is intentional —
 * Svelte's context system cannot carry generics, and the store concerns only need
 * property access by string key. Type safety for row data is the consumer's
 * responsibility at the `TableProps<T>` boundary.
 */
export function createTableState(persistenceConfig?: TablePersistenceConfig) {
  // ── Shared reactive state ──
  const state: TableState = $state({
    items: [] as TableItem[],
    columns: [] as Column[],
    loading: false,
    error: null as string | null,

    searchTerm: '',
    activeFilters: [] as Filter[],
    showAdvancedSearch: false,

    currentPage: 1,
    itemsPerPage: 10,

    sortColumn: '',
    sortDirection: 'asc' as 'asc' | 'desc',

    expandedItemId: null as string | number | null,
    expandedItemIds: new SvelteSet<string | number>(),
    multiExpand: false,

    groupByKey: null as string | null,
    collapsedGroups: new SvelteSet<string>(),
    allGroupsExpanded: true,
    groupOrder: [] as string[],

    summaryConfigs: [] as SummaryConfig[],
    showSummary: false,

    selectionMode: 'none' as 'none' | 'single' | 'multi',
    selectedIds: new SvelteSet<string | number>(),

    mode: 'client' as 'client' | 'server',
    serverTotalItems: 0
  });

  // ── Persistence (initializes state from storage) ──
  const persistence = usePersistence(state, persistenceConfig);

  // ── Concerns (composed in derived-chain order) ──
  const search = useSearch(state);
  const filtering = useFiltering(state);
  const sorting = useSorting(state, () => filtering.filteredItems);
  const grouping = useGrouping(state, () => sorting.sortedItems);
  const pagination = usePagination(
    state,
    () => filtering.filteredItems,
    () => sorting.sortedItems
  );
  const expansion = useExpansion(state);
  const columnVisibility = useColumnVisibility(state);
  const summary = useSummary(
    state,
    () => sorting.sortedItems,
    () => grouping.grouped
  );
  const selection = useSelection(state, () => filtering.filteredItems);
  const columnOrder = useColumnOrder(state);
  const focus = useFocusManagement(state, () => pagination.paginatedItems.length);
  const remoteData = useRemoteData(state);
  const liveUpdates = useLiveUpdates(state);

  // ── Apply persisted snapshots that live inside concerns ──
  // `state.columns` is still empty at this point; the consumer's
  // `columns` prop reaches `setColumns` after construction. Filtering by
  // the persisted hidden ids happens there.
  if (persistence.initialHiddenColumnIds.length > 0) {
    columnVisibility.setHiddenIds(persistence.initialHiddenColumnIds);
  }
  if (persistence.initialColumnOrder.length > 0) {
    columnOrder.applyOrder(persistence.initialColumnOrder);
  }

  // ── Thin wrappers that add persistence syncing ──
  function setItems(newItems: TableItem[]) {
    state.items = normalizeItems(newItems);
  }

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
  }

  function setError(errorMsg: string | null) {
    state.error = errorMsg;
  }

  function setSearchTerm(term: string) {
    search.setSearchTerm(term);
    persistence.syncSearch();
  }

  function addFilter(filter: Filter) {
    filtering.addFilter(filter);
    persistence.syncFilters();
  }

  function removeFilter(index: number) {
    filtering.removeFilter(index);
    persistence.syncFilters();
  }

  function removeFiltersByColumn(column: string, operator?: FilterOperator, value?: string) {
    filtering.removeFiltersByColumn(column, operator, value);
    persistence.syncFilters();
  }

  function clearAllFilters() {
    filtering.clearAllFilters();
    persistence.syncFilters();
  }

  function setGroupByKey(key: string | null) {
    grouping.setGroupByKey(key);
    persistence.syncGroupByKey();
  }

  function addSummaryConfig(config: SummaryConfig) {
    summary.addSummaryConfig(config);
    persistence.syncSummaryConfigs();
  }

  function removeSummaryConfig(column: string) {
    summary.removeSummaryConfig(column);
    persistence.syncSummaryConfigs();
  }

  function setSummaryConfigs(configs: SummaryConfig[]) {
    summary.setSummaryConfigs(configs);
    persistence.syncSummaryConfigs();
  }

  function handleSort(column: string) {
    sorting.handleSort(column);
    persistence.syncSortState();
  }

  function hideColumn(id: string) {
    columnVisibility.hideColumn(id);
    persistence.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function showColumn(id: string) {
    columnVisibility.showColumn(id);
    persistence.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function toggleColumnVisibility(id: string) {
    columnVisibility.toggleColumnVisibility(id);
    persistence.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function showAllColumns() {
    columnVisibility.showAllColumns();
    persistence.syncHiddenColumns([]);
  }

  function reorderColumn(fromIndex: number, toIndex: number) {
    columnOrder.reorderColumn(fromIndex, toIndex);
    persistence.syncColumnOrder(columnOrder.columnOrder);
  }

  function resetColumnOrder() {
    columnOrder.resetColumnOrder();
    persistence.syncColumnOrder([]);
  }

  // ── Public API ──
  // `state` is exposed for internal sub-components that need direct reads.
  // External consumers should prefer the wrapper methods (setSearchTerm,
  // addFilter, handleSort, etc.) which enforce persistence sync and side effects.
  return {
    state,

    // Derived getters
    get filteredItems() {
      return filtering.filteredItems;
    },
    get sortedItems() {
      return sorting.sortedItems;
    },
    get paginatedItems() {
      return pagination.paginatedItems;
    },
    get totalItems() {
      return pagination.totalItems;
    },
    get totalPages() {
      return pagination.totalPages;
    },
    get grouped() {
      return grouping.grouped;
    },
    get summaryData() {
      return summary.summaryData;
    },
    get groupedSummaryData() {
      return summary.groupedSummaryData;
    },

    // Data management
    setItems,
    setColumns: columnVisibility.setColumns,
    setLoading,
    setError,

    // Search
    setSearchTerm,
    toggleAdvancedSearch: search.toggleAdvancedSearch,

    // Filtering
    addFilter,
    removeFilter,
    removeFiltersByColumn,
    clearAllFilters,
    hasFilterForColumn: filtering.hasFilterForColumn,

    // Sorting
    handleSort,

    // Pagination
    setPage: pagination.setPage,
    goToPage: pagination.goToPage,
    setItemsPerPage: pagination.setItemsPerPage,

    // Expansion
    toggleExpand: expansion.toggleExpand,
    isItemExpanded: expansion.isItemExpanded,

    // Grouping
    toggleGroup: grouping.toggleGroup,
    toggleGroupExpand: grouping.toggleGroup,
    toggleAllGroups: grouping.toggleAllGroups,
    setGroupByKey,
    setGroupOrder: grouping.setGroupOrder,

    // Summary
    addSummaryConfig,
    removeSummaryConfig,
    toggleSummary: summary.toggleSummary,
    setSummaryConfigs,
    getFormattedSummaryValue: summary.getFormattedSummaryValue,

    // Utilities
    getNestedValue,
    resolveColumnId,
    resolveColumnValue,
    resolveValueById,
    findColumnById,

    // Column visibility
    get allColumns() {
      return columnVisibility.allColumns;
    },
    get hiddenColumnKeys() {
      return columnVisibility.hiddenColumnKeys;
    },
    hideColumn,
    showColumn,
    toggleColumnVisibility,
    showAllColumns,

    // Selection
    get selectedItems() {
      return selection.selectedItems;
    },
    get allSelected() {
      return selection.allSelected;
    },
    get someSelected() {
      return selection.someSelected;
    },
    selectItem: selection.selectItem,
    deselectItem: selection.deselectItem,
    toggleItem: selection.toggleItem,
    selectAll: selection.selectAll,
    deselectAll: selection.deselectAll,
    toggleAll: selection.toggleAll,
    isSelected: selection.isSelected,
    setSelectedIds: selection.setSelectedIds,

    // Column order
    get orderedColumns() {
      return columnOrder.orderedColumns;
    },
    get columnOrder() {
      return columnOrder.columnOrder;
    },
    initColumnOrder: columnOrder.initOrder,
    reorderColumn,
    resetColumnOrder,
    getColumnIndex: columnOrder.getColumnIndex,

    // Focus management
    get focusedRowIndex() {
      return focus.focusedRowIndex;
    },
    resetFocus: focus.resetFocus,
    setFocusedRow: focus.setFocusedRow,
    moveFocus: focus.moveFocus,
    isFocusedRow: focus.isFocusedRow,

    // Remote data
    get query() {
      return remoteData.query;
    },
    get queryKey() {
      return remoteData.queryKey;
    },
    setServerResult: remoteData.setServerResult,
    setServerError: remoteData.setServerError,
    setServerLoading: remoteData.setServerLoading,

    // Live updates
    get liveUpdateCounts() {
      return liveUpdates.counts;
    },
    get hasPendingUpdates() {
      return liveUpdates.hasPending;
    },
    pushInsert: liveUpdates.pushInsert,
    pushUpdate: liveUpdates.pushUpdate,
    pushDelete: liveUpdates.pushDelete,
    applyAllUpdates: liveUpdates.applyAll,
    applyInserts: liveUpdates.applyInserts,
    applyUpdates: liveUpdates.applyUpdates,
    applyDeletes: liveUpdates.applyDeletes,
    dismissAllUpdates: liveUpdates.dismissAll,
    isRecentlyUpdated: liveUpdates.isRecentlyUpdated,
    isPendingDelete: liveUpdates.isPendingDelete,

    // Persistence
    clearPersistedFilters: persistence.clearPersistedFilters,
    clearPersistedSearchTerm: persistence.clearPersistedSearchTerm,
    clearPersistedGroupByKey: persistence.clearPersistedGroupByKey,
    clearPersistedSummaryConfigs: persistence.clearPersistedSummaryConfigs,
    clearPersistedSortState: persistence.clearPersistedSortState,
    clearPersistedHiddenColumns: persistence.clearPersistedHiddenColumns,
    clearPersistedColumnOrder: persistence.clearPersistedColumnOrder,
    clearAllPersistentData: persistence.clearAllPersistentData,
    forceSavePersistentData: persistence.forceSavePersistentData
  };
}

// Optional — setTableContext returns the existing context if any, so the
// raw getter must be permissive (returns undefined when unset).
const [getTableContextRaw, setTableContextRaw] =
  createOptionalContext<ReturnType<typeof createTableState>>();

/**
 * Creates and sets the table context.
 * @param persistenceConfig - Optional persistence configuration for filters, search, grouping, and summaries.
 */
export function setTableContext(persistenceConfig?: TablePersistenceConfig) {
  const existing = getTableContextRaw();
  if (existing) return existing;

  const tableState = createTableState(persistenceConfig);
  setTableContextRaw(tableState);
  return tableState;
}

/**
 * Retrieves the table context. Throws when called outside of a `<TableProvider>`
 * — consumers within the table tree can rely on a defined return value. For the
 * rare case where the absence of a provider must be detected, use
 * `getTableContextRaw()` (internal) or `setTableContext()` (idempotent setter).
 */
export function getTableContext() {
  const ctx = getTableContextRaw();
  if (!ctx) {
    throw new Error(
      '`getTableContext()` was called outside of a `<TableProvider>`. Wrap the consuming component in `<TableProvider>` or use `setTableContext()` first.'
    );
  }
  return ctx;
}

/**
 * Set the table context to an externally-created `tableState`. Used by
 * `<TableProvider>` so it can construct the state once and share it
 * with the rest of the table tree.
 */
export function attachTableContext(tableState: ReturnType<typeof createTableState>) {
  setTableContextRaw(tableState);
}
