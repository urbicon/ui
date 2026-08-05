import { createOptionalContext } from '@urbicon-ui/blocks';
import { BASE_LOCALE } from '@urbicon-ui/i18n';
import { SvelteSet } from 'svelte/reactivity';
import type { Column, Filter, TableItem } from '$lib';
import {
  findColumnById,
  getNestedValue,
  normalizeItems,
  resolveColumnId,
  resolveColumnValue,
  resolveValueById
} from '$lib/utils';
import { resolveSource, type TableSource } from '$lib/view/source';
import { createTableView, type TableView } from '$lib/view/view.svelte';
import type { TableState } from './concerns/types.js';
import { useColumnOrder } from './concerns/useColumnOrder.svelte.js';
import { useColumnVisibility } from './concerns/useColumnVisibility.svelte.js';
import { useExpansion } from './concerns/useExpansion.svelte.js';
import { useFiltering } from './concerns/useFiltering.svelte.js';
import { useFocusManagement } from './concerns/useFocusManagement.svelte.js';
import { useGrouping } from './concerns/useGrouping.svelte.js';
import { useLiveUpdates } from './concerns/useLiveUpdates.svelte.js';
import { usePagination } from './concerns/usePagination.svelte.js';
import { usePrefs } from './concerns/usePrefs.svelte.js';
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
 * The table's preference channel (#152): column visibility, column order,
 * summaries — and, opt-in, the selection. Preferences belong to the *table*:
 * nobody wants to share a link that hides columns on the other end, so they
 * live in web storage, never in the URL. The six view axes (search, sort,
 * page, page size, filters, grouping) are the view object's business —
 * persisted, if at all, through `bindViewToStorage`.
 *
 * Stored values are read at construction and **applied after hydration**
 * (storage does not exist on the server, so anything applied earlier makes
 * the client's first render disagree with the server HTML). `defaults` are
 * deterministic on both sides and therefore apply at construction — a
 * default-hidden column is hidden in the server HTML too. A stored value
 * wins over the matching default, including a stored *empty* one.
 */
export interface TablePrefsConfig {
  /**
   * Where to persist the preferences. A string is the shorthand for
   * `{ key }`; without this field the preferences stay volatile and only
   * `defaults` apply.
   */
  storage?:
    | string
    | {
        /** Unique identifier for this table — used as the storage-key suffix. */
        key: string;
        /** Storage type. @default 'localStorage' */
        kind?: 'localStorage' | 'sessionStorage';
        /** Write debounce in ms. @default 500 */
        debounceMs?: number;
      };
  /** Initial preferences for a table nobody has touched yet. */
  defaults?: {
    /** Column ids hidden initially. */
    hiddenColumns?: string[];
    /** Initial column order (resolved column ids). */
    columnOrder?: string[];
    /** Initial summary configurations. */
    summaries?: SummaryConfig[];
  };
  /**
   * Persist selected row ids across reloads. **Opt-in — default `false`**,
   * unlike every axis above (a restored selection surprises more often than
   * it helps). No effect when `selectedIds` is controlled: the prop is the
   * source of truth, so a controlled value is never written to storage.
   * Rows are keyed by `item.id`; without a stable `id` the selection falls
   * back to the row's position index, which restores onto *different* rows
   * after a reorder — enable this only for data with stable ids.
   */
  persistSelection?: boolean;
}

/**
 * The consumer props the store derives from, handed in as getters so the source
 * stays tracked.
 *
 * Every entry here used to be mirrored into the store by an `$effect` in
 * `TableProvider`. Effects do not run during server rendering, so none of it
 * reached the prerendered HTML — the table rendered its empty state and, on the
 * docs site, 81 API pages asserted the documented component had no properties
 * (#10). As getters feeding deriveds, the same values are evaluated during SSR.
 *
 * All optional: a store constructed without them behaves exactly as the old
 * defaults did, which is what keeps the store's own test suite meaningful.
 */
export interface TablePropSources {
  /** The data source union — `TableProvider` resolves the `items` shorthand into it. */
  source?: () => TableSource | undefined;
  columns?: () => Column[];
  multiExpand?: () => boolean;
  groupOrder?: () => string[];
  selectionMode?: () => 'none' | 'single' | 'multi';
  /** Whether `selectedIds` is controlled — i.e. the prop is present. */
  selectionControlled?: () => boolean;
  rowClickSelects?: () => boolean;
  activeRowId?: () => string | number | null;
  virtualized?: () => boolean;
  enableColumnVisibility?: () => boolean;
}

/** Construction-time seeds that are neither view nor preference state. */
export interface TableSeedState {
  /**
   * Initial selected row ids (keyed by `item.id`, row-index fallback),
   * applied once at construction. A selection restored via
   * `prefs.persistSelection` takes precedence — including a stored *empty*
   * one; ignored entirely when the controlled `selectedIds` prop is present.
   */
  selectedIds?: Array<string | number>;
}

// Referentially stable empty list — the managed-source item slot must not
// change identity across re-evaluations, or every parent render would count
// as an items change.
const NO_ITEMS: TableItem[] = [];

/**
 * Creates the table state by composing independent concerns.
 *
 * Derived chain: items → filteredItems → sortedItems → grouped → paginatedItems
 *
 * Each concern owns a slice of functionality (search, filtering, sorting, etc.)
 * but all read from and write to a shared reactive state object. Since v8 the
 * six view axes on that object are pass-throughs onto the {@link TableView}:
 * a concern writing `state.currentPage = 1` writes `view.page`, with `user`
 * origin — which is what lets the bindings tell a reader's change from an
 * applied one without the store keeping any ownership bookkeeping of its own.
 *
 * **Generic T erasure**: The consumer-facing `TableProps<T>` is generic, but the
 * store operates on `TableItem` (`Record<string, unknown>`). This is intentional —
 * Svelte's context system cannot carry generics, and the store concerns only need
 * property access by string key. Type safety for row data is the consumer's
 * responsibility at the `TableProps<T>` boundary.
 */
export function createTableState(
  view?: TableView,
  prefs?: TablePrefsConfig,
  props?: TablePropSources,
  seed?: TableSeedState
) {
  // A table without a `view` prop owns an unbound view of its own — the
  // zero-config path. `TableProvider` resolves `view`/`viewDefaults` before
  // handing the result in here.
  const tableView = view ?? createTableView();

  // ── Source resolution ────────────────────────────────────────────────────
  //
  // Two derived stages, deliberately (#153-R1 class): `resolvedSource`
  // re-evaluates whenever the consumer passes a fresh `source` literal —
  // which an inline `source={{ query: (q) => … }}` does on every parent
  // render. The stages below extract *stable* values out of it (a mode
  // string, the items reference, booleans), and Svelte skips propagation
  // when a derived's new value is referentially identical to the old one —
  // so nothing downstream re-runs unless the content actually changed.
  const resolvedSource = $derived(resolveSource(props?.source?.() ?? NO_ITEMS));
  const sourceMode = $derived(resolvedSource.mode);
  const sourceItems = $derived(
    resolvedSource.mode === 'server-managed' ? NO_ITEMS : resolvedSource.items
  );
  const sourceLoading = $derived(
    resolvedSource.mode === 'server-managed' ? false : resolvedSource.loading
  );
  const sourceError = $derived(
    resolvedSource.mode === 'server-managed' ? null : resolvedSource.error
  );
  const sourceTotal = $derived(resolvedSource.mode === 'server-manual' ? resolvedSource.total : 0);
  const mode = $derived(sourceMode === 'client' ? ('client' as const) : ('server' as const));

  // ── Prop-driven slots ────────────────────────────────────────────────────
  //
  // Overridable deriveds: evaluated during SSR (#10), still writable for the
  // second writers — live updates and managed fetches assign to
  // `state.items`/`loading`/`error`/`serverTotalItems`. An assignment holds
  // until the value behind it changes, which then re-seeds.
  // See docs/SVELTE5-PATTERNS.md → "Prop-derived state".
  let items = $derived(normalizeItems(sourceItems));
  let loading = $derived(sourceLoading);
  let error = $derived(sourceError);
  let serverTotalItems = $derived(sourceTotal);
  let multiExpand = $derived(props?.multiExpand?.() ?? false);
  let groupOrder = $derived(props?.groupOrder?.() ?? []);
  let selectionMode = $derived(props?.selectionMode?.() ?? 'none');
  let selectionControlled = $derived(props?.selectionControlled?.() ?? false);
  let rowClickSelects = $derived(props?.rowClickSelects?.() ?? false);
  let activeRowId = $derived(props?.activeRowId?.() ?? null);
  let virtualized = $derived(props?.virtualized?.() ?? false);
  let enableColumnVisibility = $derived(props?.enableColumnVisibility?.() ?? true);

  // `state.columns` is the *visible* subset. The full list comes from the prop,
  // the filtering lives in `useColumnVisibility` — which needs `state` to exist
  // first, so both accessors are bound in after the concerns are built. Until
  // then the unfiltered prop list is the honest answer (nothing is hidden yet).
  let columnsView: (() => Column[]) | null = null;
  let columnsWrite: ((next: Column[]) => void) | null = null;

  // ── Shared reactive state ──
  //
  // The six view axes are pass-throughs onto the view object — reading tracks
  // the view's `$state` fields, writing goes through the view's field setters
  // and therefore counts as the reader's own change (`user` origin). The
  // sort pair maps onto the single `view.sort` value: clearing the column
  // clears the sort, and a direction write on an unsorted view is a no-op
  // (an unsorted view has no direction — the serializers normalize it away
  // the same way).
  const state: TableState = $state({
    get items() {
      return items;
    },
    set items(next: TableItem[]) {
      items = next;
    },
    get columns() {
      return columnsView?.() ?? props?.columns?.() ?? [];
    },
    set columns(next: Column[]) {
      columnsWrite?.(next);
    },
    get loading() {
      return loading;
    },
    set loading(next: boolean) {
      loading = next;
    },
    get error() {
      return error;
    },
    set error(next: string | null) {
      error = next;
    },

    get searchTerm() {
      return tableView.search;
    },
    set searchTerm(next: string) {
      tableView.search = next;
    },
    get activeFilters() {
      return tableView.filters;
    },
    set activeFilters(next: Filter[]) {
      tableView.filters = next;
    },
    showAdvancedSearch: false,

    get currentPage() {
      return tableView.page;
    },
    set currentPage(next: number) {
      tableView.page = next;
    },
    get itemsPerPage() {
      return tableView.pageSize;
    },
    set itemsPerPage(next: number) {
      tableView.pageSize = next;
    },

    get sortColumn() {
      return tableView.sort?.column ?? '';
    },
    set sortColumn(next: string) {
      tableView.sort = next
        ? { column: next, direction: tableView.sort?.direction ?? 'asc' }
        : null;
    },
    get sortDirection() {
      return tableView.sort?.direction ?? 'asc';
    },
    set sortDirection(next: 'asc' | 'desc') {
      if (tableView.sort) {
        tableView.sort = { column: tableView.sort.column, direction: next };
      }
    },

    expandedItemId: null as string | number | null,
    expandedItemIds: new SvelteSet<string | number>(),
    get multiExpand() {
      return multiExpand;
    },
    set multiExpand(next: boolean) {
      multiExpand = next;
    },

    /**
     * Grouping carries a gate, not just a value: grouped virtualization is
     * not implemented, and a key that slips through deactivates
     * virtualization and renders the *entire* item set. The read-side gate
     * here holds during SSR too — a `?group=…` deep link on a virtualized
     * table renders ungrouped on the server. The runtime *discard* (which
     * cleans the URL and un-dirties storage) is `TableProvider`'s
     * `applyExternal({ groupBy: null }, 'system')`.
     */
    get groupByKey() {
      const requested = tableView.groupBy;
      // Gated on the same overridable slot `useGrouping`'s setter gate reads
      // (`state.virtualized`) — not on the raw prop — so the two gates can
      // never disagree about what "virtualized" currently means.
      return requested && virtualized ? null : requested;
    },
    set groupByKey(next: string | null) {
      tableView.groupBy = next;
    },
    /**
     * The grouping key the consumer *declared* via `view.defaults.groupBy`,
     * kept for the lifetime of the table and never written again.
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
    get groupOrder() {
      return groupOrder;
    },
    set groupOrder(next: string[]) {
      groupOrder = next;
    },

    summaryConfigs: [] as SummaryConfig[],
    showSummary: false,

    get selectionMode() {
      return selectionMode;
    },
    set selectionMode(next: 'none' | 'single' | 'multi') {
      selectionMode = next;
    },
    selectedIds: new SvelteSet<string | number>(),
    get selectionControlled() {
      return selectionControlled;
    },
    set selectionControlled(next: boolean) {
      selectionControlled = next;
    },
    get rowClickSelects() {
      return rowClickSelects;
    },
    set rowClickSelects(next: boolean) {
      rowClickSelects = next;
    },
    /**
     * The row currently being shown elsewhere (master/detail) — distinct from
     * selection, which implies an action on a set. Marking it needed
     * `selectionMode` before, which also switches on the checkbox column.
     */
    get activeRowId() {
      return activeRowId;
    },
    set activeRowId(next: string | number | null) {
      activeRowId = next;
    },
    get virtualized() {
      return virtualized;
    },
    set virtualized(next: boolean) {
      virtualized = next;
    },

    get mode() {
      return mode;
    },
    get serverTotalItems() {
      return serverTotalItems;
    },
    set serverTotalItems(next: number) {
      serverTotalItems = next;
    },

    get enableColumnVisibility() {
      return enableColumnVisibility;
    },
    set enableColumnVisibility(next: boolean) {
      enableColumnVisibility = next;
    }
  });

  // ── Prefs (reads storage at construction, applies after hydration) ──
  const prefsStore = usePrefs(state, prefs);

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
  const columnVisibility = useColumnVisibility(() => props?.columns?.() ?? []);
  // Bind the visible-column view now that the concern exists. Before this line
  // `state.columns` answers with the unfiltered prop list, which is correct:
  // nothing can be hidden yet.
  columnsView = () => columnVisibility.visibleColumns;
  columnsWrite = (next) => columnVisibility.setColumns(next);
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
  const remoteData = useRemoteData(state, tableView);
  const liveUpdates = useLiveUpdates(state);

  /**
   * Apply everything storage supplied — summaries and selection on the shared
   * state, plus the column visibility and order that live inside their own
   * concerns. Called by `TableProvider` from an `$effect`, which is the
   * hydration boundary: storage is a client-only layer, so nothing read from
   * it may reach the server HTML (see {@link TablePrefsConfig}).
   *
   * The `defaults` do NOT run through here — they are deterministic on both
   * sides of hydration and applied at construction below, so a default-hidden
   * column is hidden in the server HTML too. A stored value arriving here
   * overrides the default, including a stored *empty* one.
   */
  function applyPersistedState() {
    prefsStore.applyPersistedState();
    const storedHidden = prefsStore.storedHiddenColumnIds;
    if (storedHidden !== null) {
      columnVisibility.setHiddenIds(storedHidden);
    }
    const storedOrder = prefsStore.storedColumnOrder;
    if (storedOrder !== null && storedOrder.length > 0) {
      columnOrder.applyOrder(storedOrder);
    }
  }

  // ── Construction-time defaults ──
  //
  // Prefs defaults apply synchronously (SSR-visible); a stored value replaces
  // them after hydration. Deliberately WITHOUT a storage write-back: since v8
  // a default is not synced into storage — only what the reader themselves
  // changes is written. After a deploy with changed defaults the new default
  // greets returning readers who never touched the axis (the seed-resync
  // delta, v8 notes).
  if (prefs?.defaults?.hiddenColumns?.length) {
    columnVisibility.setHiddenIds(prefs.defaults.hiddenColumns);
  }
  if (prefs?.defaults?.columnOrder?.length) {
    columnOrder.applyOrder(prefs.defaults.columnOrder);
  }
  const summaryDefaults = prefs?.defaults?.summaries;
  if (
    summaryDefaults &&
    summaryDefaults.length > 0 &&
    state.summaryConfigs.length === 0 &&
    !prefsStore.hydratedSummaryConfigs
  ) {
    // Copy so the default never aliases the consumer's array — the
    // add/update path can mutate an entry in place.
    summary.setSummaryConfigs([...summaryDefaults]);
  }
  if (
    seed?.selectedIds &&
    seed.selectedIds.length > 0 &&
    state.selectedIds.size === 0 &&
    !prefsStore.hydratedSelection
  ) {
    selection.setSelectedIds(seed.selectedIds);
  }
  if (tableView.defaults.groupBy) {
    // Recorded even when grouping is not currently applied: it is a
    // declaration about what the grouping menu should offer, not about what
    // is grouped right now.
    state.declaredGroupByKey = tableView.defaults.groupBy;
  }

  // ── Thin wrappers ──
  //
  // The view axes need no persistence syncing anymore: they write into the
  // view object, and whatever bindings the consumer attached observe it. The
  // prefs axes keep their explicit `sync*` calls — prefs storage is fed from
  // the table's own action wrappers, never from a value resolving.
  function setItems(newItems: TableItem[]) {
    state.items = normalizeItems(newItems);
  }

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
  }

  function setError(errorMsg: string | null) {
    state.error = errorMsg;
  }

  function addSummaryConfig(config: SummaryConfig) {
    summary.addSummaryConfig(config);
    prefsStore.syncSummaryConfigs();
  }

  function removeSummaryConfig(column: string) {
    summary.removeSummaryConfig(column);
    prefsStore.syncSummaryConfigs();
  }

  function setSummaryConfigs(configs: SummaryConfig[]) {
    summary.setSummaryConfigs(configs);
    prefsStore.syncSummaryConfigs();
  }

  function hideColumn(id: string) {
    columnVisibility.hideColumn(id);
    prefsStore.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function showColumn(id: string) {
    columnVisibility.showColumn(id);
    prefsStore.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function toggleColumnVisibility(id: string) {
    columnVisibility.toggleColumnVisibility(id);
    prefsStore.syncHiddenColumns([...columnVisibility.hiddenColumnKeys]);
  }

  function showAllColumns() {
    columnVisibility.showAllColumns();
    prefsStore.syncHiddenColumns([]);
  }

  function reorderColumn(fromIndex: number, toIndex: number) {
    columnOrder.reorderColumn(fromIndex, toIndex);
    prefsStore.syncColumnOrder(columnOrder.columnOrder);
  }

  function resetColumnOrder() {
    columnOrder.resetColumnOrder();
    prefsStore.syncColumnOrder([]);
  }

  // Selection mutations sync to storage after mutating (a no-op unless
  // persistSelection is enabled). `isSelected` stays a passthrough (read-only).
  function selectItem(id: string | number) {
    selection.selectItem(id);
    prefsStore.syncSelection();
  }

  function deselectItem(id: string | number) {
    selection.deselectItem(id);
    prefsStore.syncSelection();
  }

  function toggleItem(id: string | number) {
    selection.toggleItem(id);
    prefsStore.syncSelection();
  }

  function selectAll() {
    selection.selectAll();
    prefsStore.syncSelection();
  }

  function deselectAll() {
    selection.deselectAll();
    prefsStore.syncSelection();
  }

  function toggleAll() {
    selection.toggleAll();
    prefsStore.syncSelection();
  }

  function setSelectedIds(ids: Array<string | number>) {
    selection.setSelectedIds(ids);
    prefsStore.syncSelection();
  }

  // Live-update deletes prune deleted rows out of the selection
  // (`applyDeletes`, and `applyAll` which calls it), mutating `selectedIds`
  // outside the selection methods above — so they re-sync persisted selection
  // too. `applyInserts`/`applyUpdates`/`dismissAll` never touch selection.
  function applyAllUpdates() {
    liveUpdates.applyAll();
    prefsStore.syncSelection();
  }

  function applyDeletes() {
    liveUpdates.applyDeletes();
    prefsStore.syncSelection();
  }

  // ── Public API ──
  // `state` is exposed for internal sub-components that need direct reads.
  // External consumers should prefer the wrapper methods (setSearchTerm,
  // addFilter, handleSort, etc.) which enforce side effects like the
  // page-1 reset.
  return {
    state,
    /** The view object this table reads and writes — the six shareable axes. */
    view: tableView,

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
    /**
     * The page actually rendered — `state.currentPage` clamped into range.
     *
     * Everything user-facing reads this, never `state.currentPage`: the raw
     * value is the reader's *intent* and can sit out of range after
     * `itemsPerPage` or the item count changed under it. Displaying it produced
     * a pager reading "5 / 1", and paging keys computed from it went dead in
     * both directions — `PageDown` compares `5 < 3`, `PageUp` asks `goToPage(4)`
     * which the range check rejects.
     */
    get effectivePage() {
      return pagination.effectivePage;
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
    setSearchTerm: search.setSearchTerm,
    toggleAdvancedSearch: search.toggleAdvancedSearch,

    // Filtering
    addFilter: filtering.addFilter,
    removeFilter: filtering.removeFilter,
    removeFiltersByColumn: filtering.removeFiltersByColumn,
    clearAllFilters: filtering.clearAllFilters,
    hasFilterForColumn: filtering.hasFilterForColumn,

    // Sorting
    handleSort: sorting.handleSort,
    setSort: sorting.setSort,

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
    setGroupByKey: grouping.setGroupByKey,
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
    applyPersistedState,
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

    // Prefs persistence
    clearPersistedSummaryConfigs: prefsStore.clearPersistedSummaryConfigs,
    clearPersistedHiddenColumns: prefsStore.clearPersistedHiddenColumns,
    clearPersistedColumnOrder: prefsStore.clearPersistedColumnOrder,
    clearPersistedSelection: prefsStore.clearPersistedSelection,
    clearAllPersistentData: prefsStore.clearAllPersistentData,
    forceSavePersistentData: prefsStore.forceSavePersistentData
  };
}

// Optional — setTableContext returns the existing context if any, so the
// raw getter must be permissive (returns undefined when unset).
const [getTableContextRaw, setTableContextRaw] =
  createOptionalContext<ReturnType<typeof createTableState>>();

/**
 * The BCP 47 tag the formatting cells hand to `Intl`, resolved once per table.
 *
 * A getter rather than a value, so a locale switch re-renders: `<TableProvider>`
 * puts `() => resolveDateLocale('auto', useI18n().locale)` here during its own
 * init, and the cells read it.
 *
 * Per table, not per cell, because every cell and every mobile card is its own
 * component instance — a virtualized 2000-row table would otherwise build a
 * fresh `useI18n()` object (eight getters) for each one, thousands of times,
 * to answer a question with the same answer every time.
 */
const [getCellLocaleRaw, setCellLocaleRaw] = createOptionalContext<() => string>();

/**
 * Called by `<TableProvider>` once, alongside {@link attachTableContext}.
 *
 * Exported for the provider, not for consumers: it is pure wiring, and a
 * consumer calling it would silently re-point the formatting locale for a
 * subtree. `getCellLocale()` is the half worth reaching for — a custom
 * `column.component` cell wants the table's resolved tag.
 */
export function attachCellLocale(resolve: () => string) {
  setCellLocaleRaw(resolve);
}

/**
 * The resolved formatting locale for this table. Falls back to the base locale
 * when no provider is mounted, matching `useI18n()`'s own read-tolerance — a
 * cell rendered outside a `<TableProvider>` still formats identically on both
 * sides of hydration.
 */
export function getCellLocale(): string {
  return getCellLocaleRaw()?.() ?? BASE_LOCALE;
}

/**
 * Creates and sets the table context.
 * @param prefs - Optional preference configuration (column visibility, order,
 * summaries, opt-in selection persistence). Ignored when an existing context
 * is returned.
 */
export function setTableContext(prefs?: TablePrefsConfig) {
  const existing = getTableContextRaw();
  if (existing) return existing;

  const tableState = createTableState(undefined, prefs);
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
