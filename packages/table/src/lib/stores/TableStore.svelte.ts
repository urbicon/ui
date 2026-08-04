import { createOptionalContext } from '@urbicon-ui/blocks';
import { BASE_LOCALE } from '@urbicon-ui/i18n';
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
  items?: () => TableItem[];
  columns?: () => Column[];
  loading?: () => boolean;
  error?: () => string | null;
  initialPage?: () => number;
  itemsPerPage?: () => number;
  multiExpand?: () => boolean;
  groupOrder?: () => string[];
  selectionMode?: () => 'none' | 'single' | 'multi';
  /** Whether `selectedIds` is controlled — i.e. the prop is present. */
  selectionControlled?: () => boolean;
  /** Whether `searchTerm` is controlled — i.e. the prop is not `undefined`. */
  searchControlled?: () => boolean;
  rowClickSelects?: () => boolean;
  activeRowId?: () => string | number | null;
  virtualized?: () => boolean;
  mode?: () => 'client' | 'server';
  serverTotalItems?: () => number;
  enableColumnVisibility?: () => boolean;
  /**
   * Controlled view state, normally the parsed URL (#152).
   *
   * Per-field ownership: a field that is present outranks both persistence and
   * the matching `initial*` seed for its axis; a field left `undefined` changes
   * nothing. The same rule `searchControlled` already applies to `searchTerm`,
   * generalised — which is why these are deriveds and not writes: the store
   * still assigns to them on every user interaction, and a new value from the
   * URL re-seeds the slot afterwards.
   */
  query?: () => TableViewState | undefined;
}

/**
 * The view state a table can hand out and take back — the axes that decide
 * *which data is shown*, and therefore exactly the axes the server has to know
 * and a shared link has to carry (#152). Structurally the writable half of
 * `TableQuery`; every field optional, because a consumer may control some axes
 * and leave the rest to the table.
 */
export interface TableViewState {
  page?: number;
  itemsPerPage?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  searchTerm?: string;
  activeFilters?: Filter[];
  groupByKey?: string | null;
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
  seed?: TableSeedState,
  props?: TablePropSources
) {
  // ── Prop-driven slots ────────────────────────────────────────────────────
  //
  // Each of these used to be a plain `$state` field that `TableProvider` filled
  // from a prop inside an `$effect` — about sixteen of them. `$effect` does not
  // run during SSR, so the server rendered an empty table and the prerendered
  // HTML claimed the component had no rows (#10).
  //
  // As deriveds they are evaluated during the server render, and — since 5.25 —
  // they are still writable, which is what the second writers need: live updates
  // and remote fetches assign to `state.items`, pagination assigns to
  // `state.currentPage`. An assignment holds until the prop behind it changes,
  // which then re-seeds. That combination is the reason this is a derived and
  // not a hand-written `override ?? prop` getter: the re-seed is the part you
  // cannot hand-build.
  //
  // See docs/SVELTE5-PATTERNS.md → "Prop-derived state".
  //
  // **Reactivity depth, deliberately shallower than before.** A `$state` data
  // property deep-proxies whatever is assigned to it, so `state.items[0].name
  // = 'x'` used to notify. A `$derived` does not wrap its value, so it no
  // longer does — measured: the write lands, no reader re-runs. Replacing the
  // whole array (`state.items = […]`, what `setItems`, `useLiveUpdates` and
  // `useRemoteData` all do) notifies exactly as before, and nothing in the
  // library mutates a row in place. Consumers reaching the state through
  // `onReady` must do the same: edit a row via `pushUpdate` or by assigning a
  // new array, never by writing through to a row. Pinned by
  // TableStore.columns.svelte.test.ts.
  let items = $derived(normalizeItems(props?.items?.() ?? []));
  let loading = $derived(props?.loading?.() ?? false);
  let error = $derived(props?.error?.() ?? null);
  let currentPage = $derived(props?.query?.()?.page ?? props?.initialPage?.() ?? 1);
  let itemsPerPage = $derived(props?.query?.()?.itemsPerPage ?? props?.itemsPerPage?.() ?? 10);
  // The four axes below used to be plain `$state` seeded by persistence and the
  // `initial*` seeds. As prop-derived slots they resolve during SSR, which is
  // the point: a link carrying `?sort=name` has to render sorted on the server
  // (#152). Nothing changes when no `query` is passed — the fallbacks are the
  // values these fields held before.
  let sortColumn = $derived(props?.query?.()?.sortColumn ?? '');
  let sortDirection = $derived(props?.query?.()?.sortDirection ?? 'asc');
  let searchTerm = $derived(props?.query?.()?.searchTerm ?? '');
  let activeFilters = $derived(props?.query?.()?.activeFilters ?? []);
  /**
   * Grouping carries a gate, not just a value: grouped virtualization is not
   * implemented, and a key that slips through deactivates virtualization and
   * renders the *entire* item set — the failure `virtualized` exists to
   * prevent. `setGroupByKey` has guarded every imperative path into grouping
   * for that reason; a URL is one more path, and an unguarded
   * `?group=status` on a virtualized table would be the worst of them, since
   * nobody had to click anything to get there.
   *
   * Applying the gate here rather than in an effect also makes it hold during
   * SSR, which the imperative gate never did.
   */
  let groupByKey = $derived.by(() => {
    const requested = props?.query?.()?.groupByKey ?? null;
    return requested && (props?.virtualized?.() ?? false) ? null : requested;
  });
  let multiExpand = $derived(props?.multiExpand?.() ?? false);
  let groupOrder = $derived(props?.groupOrder?.() ?? []);
  let selectionMode = $derived(props?.selectionMode?.() ?? 'none');
  let selectionControlled = $derived(props?.selectionControlled?.() ?? false);
  let searchControlled = $derived(props?.searchControlled?.() ?? false);
  let rowClickSelects = $derived(props?.rowClickSelects?.() ?? false);
  let activeRowId = $derived(props?.activeRowId?.() ?? null);
  let virtualized = $derived(props?.virtualized?.() ?? false);
  let mode = $derived(props?.mode?.() ?? 'client');
  let serverTotalItems = $derived(props?.serverTotalItems?.() ?? 0);
  let enableColumnVisibility = $derived(props?.enableColumnVisibility?.() ?? true);

  // `state.columns` is the *visible* subset. The full list comes from the prop,
  // the filtering lives in `useColumnVisibility` — which needs `state` to exist
  // first, so both accessors are bound in after the concerns are built. Until
  // then the unfiltered prop list is the honest answer (nothing is hidden yet).
  let columnsView: (() => Column[]) | null = null;
  let columnsWrite: ((next: Column[]) => void) | null = null;

  // ── Shared reactive state ──
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
      return searchTerm;
    },
    set searchTerm(next: string) {
      searchTerm = next;
    },
    get activeFilters() {
      return activeFilters;
    },
    set activeFilters(next: Filter[]) {
      activeFilters = next;
    },
    showAdvancedSearch: false,

    get currentPage() {
      return currentPage;
    },
    set currentPage(next: number) {
      currentPage = next;
    },
    get itemsPerPage() {
      return itemsPerPage;
    },
    set itemsPerPage(next: number) {
      itemsPerPage = next;
    },

    get sortColumn() {
      return sortColumn;
    },
    set sortColumn(next: string) {
      sortColumn = next;
    },
    get sortDirection() {
      return sortDirection;
    },
    set sortDirection(next: 'asc' | 'desc') {
      sortDirection = next;
    },

    expandedItemId: null as string | number | null,
    expandedItemIds: new SvelteSet<string | number>(),
    get multiExpand() {
      return multiExpand;
    },
    set multiExpand(next: boolean) {
      multiExpand = next;
    },

    get groupByKey() {
      return groupByKey;
    },
    set groupByKey(next: string | null) {
      groupByKey = next;
    },
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
    get searchControlled() {
      return searchControlled;
    },
    set searchControlled(next: boolean) {
      searchControlled = next;
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
    set mode(next: 'client' | 'server') {
      mode = next;
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

  // ── Persistence (initializes state from storage) ──
  // The controlled view state is handed in so persistence can step aside for
  // every axis it owns — precedence URL > localStorage > `initial*` seed (#152).
  const persistence = usePersistence(state, persistenceConfig, () => props?.query?.());

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
