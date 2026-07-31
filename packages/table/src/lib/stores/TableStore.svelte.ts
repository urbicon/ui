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
 * Each view-state axis defaults to `true` — providing a `tableId` is
 * enough to opt filters, search, group, summary, sort, column visibility
 * and column order into persistence. Set individual flags to `false` to
 * keep them volatile. Row **selection is the exception**: it is opt-in via
 * `persistSelection: true` (a restored selection surprises more often than
 * it helps).
 *
 * Storage defaults to `localStorage` for every axis so reloads,
 * tab-close-and-reopen, and full browser restarts all restore the view.
 * Pass `storage: 'sessionStorage'` to limit persistence to the current
 * tab. Pagination (current page) is never persisted — page 1 on
 * navigation is intentional UX.
 *
 * An axis is only written once its value differs from the default, so a
 * table nobody touched leaves storage untouched as well. From then on the
 * stored value is restored verbatim — *including an empty one*: clearing
 * the sort, the filters, the grouping, the summaries or the selection is
 * itself persisted and wins over the matching `initial*` seed.
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
  /**
   * Persist selected row ids across reloads. **Opt-in — default `false`**,
   * unlike every axis above (a restored selection surprises more often than it
   * helps). Genuinely no effect when `selectedIds` is controlled: the prop is
   * the source of truth, so a controlled value is never written to storage.
   * Rows are keyed by `item.id`; without a stable `id` the selection falls back
   * to the row's position index, which restores onto *different* rows after a
   * reorder — enable this only for data with stable ids.
   */
  persistSelection?: boolean;
}

/**
 * Uncontrolled initial view state, applied once at store construction —
 * immediately after persistence hydration. Each axis seeds only when
 * persistence did not supply it, so a value restored from storage always
 * wins. The seeded value is synced back to storage exactly like a user
 * action would be (every axis writes through the persistence-syncing
 * wrappers below). Controlled props are gated one level up:
 * `TableProvider` drops the `selectedIds` seed whenever the controlled
 * `selectedIds` prop is present, and the `groupBy` seed whenever the
 * controlled `groupByKey` prop is truthy.
 *
 * "Persistence supplied it" means storage held an *entry* for that axis,
 * not that the entry was non-empty: an axis the user cleared (no sort, no
 * filters, no grouping, no summaries, nothing selected) is persisted as
 * cleared and beats the seed too — cleared state survives a reload. Only
 * an absent or corrupt entry lets the seed through.
 */
export interface TableSeedState {
  /**
   * Initial sort. `column` must match a column's resolved id; an empty
   * column is treated as "no seed".
   */
  sort?: { column: string; direction: 'asc' | 'desc' };
  /** Initial selected row ids (keyed by `item.id`, row-index fallback). */
  selectedIds?: Array<string | number>;
  /** Initial advanced filters. */
  filters?: Filter[];
  /**
   * Initial grouping key. A key restored via `persistGroupByKey` takes
   * precedence — including a stored `null` (the user ungrouped); a
   * nullish/empty seed is treated as "no seed".
   */
  groupBy?: string | null;
  /**
   * Initial summary configurations. A set restored via
   * `persistSummaryConfigs` takes precedence — including a stored empty
   * set (the user removed every summary); an empty seed is "no seed".
   */
  summaryConfigs?: SummaryConfig[];
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
export function createTableState(
  persistenceConfig?: TablePersistenceConfig,
  seed?: TableSeedState
) {
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
    /**
     * The grouping key the consumer *declared* via `initialGroupBy`, kept for
     * the lifetime of the table and never written again.
     *
     * Grouping accepts any item field, not only the ones that have a column —
     * a table can group by `day` while showing no Day column, because the day
     * belongs in the group header and would be redundant in every row. The
     * grouping menu lists columns, so such a key has no option: the Select held
     * a value it could not display, DEV-logged `[Select] value "day" has no
     * matching option`, and once the user ungrouped there was no way back.
     *
     * Deriving the missing option from the *active* `groupByKey` fixes only the
     * display half — it disappears the moment you ungroup, which is precisely
     * the reported symptom. The declaration is the right source: the consumer
     * asked for this grouping, so it belongs in the menu whether or not it is
     * currently applied.
     */
    declaredGroupByKey: null as string | null,
    collapsedGroups: new SvelteSet<string>(),
    allGroupsExpanded: true,
    groupOrder: [] as string[],

    summaryConfigs: [] as SummaryConfig[],
    showSummary: false,

    selectionMode: 'none' as 'none' | 'single' | 'multi',
    selectedIds: new SvelteSet<string | number>(),
    selectionControlled: false,
    searchControlled: false,
    rowClickSelects: false,
    /**
     * The row currently being shown elsewhere (master/detail) — distinct from
     * selection, which implies an action on a set. Marking it needed
     * `selectionMode` before, which also switches on the checkbox column.
     */
    activeRowId: null as string | number | null,
    virtualized: false,

    mode: 'client' as 'client' | 'server',
    serverTotalItems: 0,

    enableColumnVisibility: true
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

  /**
   * The item rows in the order they are actually rendered — the one index space
   * keyboard navigation moves through.
   *
   * Ungrouped this is just the current page. Grouped it is NOT: `grouped` buckets
   * every *sorted* item (grouping bypasses pagination entirely), and a collapsed
   * group renders no item rows at all. Feeding `paginatedItems.length` to focus
   * management was therefore wrong in both directions when grouped — it counted a
   * page's worth of rows against a full, partially-hidden list.
   *
   * Group headers are deliberately NOT part of this sequence: they carry their own
   * `tabindex={0}` and answer Enter/Space by collapsing, so they are reachable by
   * Tab without competing with the arrow keys for an index.
   */
  const navigableItems = $derived.by((): TableItem[] => {
    if (!state.groupByKey) return pagination.paginatedItems;
    return Object.entries(grouping.grouped)
      .filter(([groupName]) => !state.collapsedGroups.has(groupName))
      .flatMap(([, groupItems]) => groupItems);
  });

  const focus = useFocusManagement(state, () => navigableItems.length);
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

  // ── Seed uncontrolled initial view state (sort / filters / selection /
  // groupBy / summaryConfigs) ──
  // Runs exactly once, here at construction — before the first render and
  // before the first server-mode query emission, so the header sort indicator
  // and the initial `query` both carry the seed. Persistence hydrated the
  // shared state above, so each axis seeds only when persistence did not
  // supply it: a persisted value wins — including a persisted *empty* one
  // (`hydrated*`), so an axis the user cleared stays cleared instead of being
  // re-seeded on every load. Writes go through the persistence-syncing
  // wrappers (hoisted function declarations below), so a seeded value reaches
  // storage exactly like a user action would.
  if (seed?.sort?.column && !state.sortColumn && !persistence.hydratedSort) {
    setSort(seed.sort.column, seed.sort.direction);
  }
  if (
    seed?.filters &&
    seed.filters.length > 0 &&
    state.activeFilters.length === 0 &&
    !persistence.hydratedFilters
  ) {
    state.activeFilters = [...seed.filters];
    persistence.syncFilters();
  }
  if (
    seed?.selectedIds &&
    seed.selectedIds.length > 0 &&
    state.selectedIds.size === 0 &&
    !persistence.hydratedSelection
  ) {
    setSelectedIds(seed.selectedIds);
  }
  if (seed?.groupBy) {
    // Recorded even when the seed is not applied (a persisted key wins), because
    // it is a declaration about what the menu should offer, not about what is
    // currently grouped.
    state.declaredGroupByKey = seed.groupBy;
  }
  if (seed?.groupBy && !state.groupByKey && !persistence.hydratedGroupByKey) {
    setGroupByKey(seed.groupBy);
  }
  if (
    seed?.summaryConfigs &&
    seed.summaryConfigs.length > 0 &&
    state.summaryConfigs.length === 0 &&
    !persistence.hydratedSummaryConfigs
  ) {
    // Copy so the seed never aliases the consumer's array (mirrors the
    // `initialFilters` seed above) — `setSummaryConfigs` stores the reference
    // as-is, and the add/update path can mutate an entry in place.
    setSummaryConfigs([...seed.summaryConfigs]);
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

  function setSort(column: string, direction: 'asc' | 'desc') {
    sorting.setSort(column, direction);
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

  // Selection mutations sync to storage after mutating (a no-op unless
  // persistSelection is enabled). `isSelected` stays a passthrough (read-only).
  function selectItem(id: string | number) {
    selection.selectItem(id);
    persistence.syncSelection();
  }

  function deselectItem(id: string | number) {
    selection.deselectItem(id);
    persistence.syncSelection();
  }

  function toggleItem(id: string | number) {
    selection.toggleItem(id);
    persistence.syncSelection();
  }

  function selectAll() {
    selection.selectAll();
    persistence.syncSelection();
  }

  function deselectAll() {
    selection.deselectAll();
    persistence.syncSelection();
  }

  function toggleAll() {
    selection.toggleAll();
    persistence.syncSelection();
  }

  function setSelectedIds(ids: Array<string | number>) {
    selection.setSelectedIds(ids);
    persistence.syncSelection();
  }

  // Live-update deletes prune deleted rows out of the selection
  // (`applyDeletes`, and `applyAll` which calls it), mutating `selectedIds`
  // outside the selection methods above — so they re-sync persisted selection
  // too. `applyInserts`/`applyUpdates`/`dismissAll` never touch selection.
  function applyAllUpdates() {
    liveUpdates.applyAll();
    persistence.syncSelection();
  }

  function applyDeletes() {
    liveUpdates.applyDeletes();
    persistence.syncSelection();
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
    /** Rendered item rows in visual order (collapsed groups excluded) — the index
     *  space `focusedRowIndex` addresses. See the derivation above. */
    get navigableItems() {
      return navigableItems;
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
    setSort,

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
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    deselectAll,
    toggleAll,
    isSelected: selection.isSelected,
    setSelectedIds,

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
    applyAllUpdates,
    applyInserts: liveUpdates.applyInserts,
    applyUpdates: liveUpdates.applyUpdates,
    applyDeletes,
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
 * @param seed - Optional uncontrolled initial view state (sort, selection, filters, groupBy, summaryConfigs); a persisted value wins per axis. Ignored when an existing context is returned.
 */
export function setTableContext(persistenceConfig?: TablePersistenceConfig, seed?: TableSeedState) {
  const existing = getTableContextRaw();
  if (existing) return existing;

  const tableState = createTableState(persistenceConfig, seed);
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
