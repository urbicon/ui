<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { attachTableContext, createTableState, findColumnById } from '$lib';
  import { useTableI18n } from '$lib/i18n';
  import { ColumnValidation } from '$lib/factories/ColumnValidation';
  import type {
    Column,
    Filter,
    TableItem,
    TableQuery,
    TableQueryResult
  } from '$lib/types/tableTypes';
  import type { SummaryConfig, TablePersistenceConfig } from '$lib/stores/TableStore.svelte';

  const tt = useTableI18n();

  export type TableProviderProps = {
    items: TableItem[];
    columns: Column[];
    itemsPerPage?: number;
    initialPage?: number;
    groupOrder?: string[];
    groupByKey?: string | null;
    initialGroupBy?: string | null;
    initialSummaryConfigs?: SummaryConfig[];
    initialSort?: { column: string; direction: 'asc' | 'desc' };
    initialFilters?: Filter[];
    initialSelectedIds?: Array<string | number>;
    multiExpand?: boolean;
    loading?: boolean;
    children?: Snippet;
    persistenceConfig?: TablePersistenceConfig;
    mode?: 'client' | 'server';
    serverTotalItems?: number;
    queryFn?: (query: TableQuery, options: { signal: AbortSignal }) => Promise<TableQueryResult>;
    onQueryChange?: (query: TableQuery) => void;
    queryDebounceMs?: number;
    enableLiveUpdates?: boolean;
    autoApplyOnNavigation?: boolean;
    selectionMode?: 'none' | 'single' | 'multi';
    selectedIds?: Array<string | number>;
    onSelectionChange?: (selectedItems: TableItem[]) => void;
    enableColumnVisibility?: boolean;
    searchTerm?: string;
    onSearchTermChange?: (term: string) => void;
  };

  let {
    items = [],
    columns = [],
    itemsPerPage = 10,
    initialPage = 1,
    groupOrder = [],
    groupByKey = null,
    initialGroupBy = null,
    initialSummaryConfigs = [],
    initialSort = undefined,
    initialFilters = undefined,
    initialSelectedIds = undefined,
    multiExpand = false,
    loading = false,
    children,
    persistenceConfig,
    mode = 'client',
    serverTotalItems = 0,
    queryFn = undefined,
    onQueryChange = undefined,
    queryDebounceMs = 300,
    enableLiveUpdates = false,
    autoApplyOnNavigation = true,
    selectionMode = 'none',
    selectedIds = undefined,
    onSelectionChange = undefined,
    enableColumnVisibility = true,
    searchTerm = undefined,
    onSearchTermChange = undefined
  }: TableProviderProps = $props();

  // Store is built once from the initial persistence config — not meant to
  // re-create if the prop changes reactively. The initial* seeds are equally
  // construction-time-only (seed-once): later changes to initialSort /
  // initialFilters / initialSelectedIds / initialGroupBy / initialSummaryConfigs
  // are ignored, and each axis only fills what persistence left empty — a
  // persisted value wins (see TableSeedState). Controlled props supersede their
  // seed entirely: `selectedIds` drops `initialSelectedIds`, and a truthy
  // `groupByKey` drops `initialGroupBy` (both applied by the effects below), so
  // the prop is the source of truth from the first render (and, per
  // syncSelection, a controlled selection is never mirrored to storage). The
  // `groupByKey` gate uses truthiness — matching the effect below and the
  // pre-migration `if (groupByKey) … else if (initialGroupBy)` — so a falsy
  // `groupByKey` (its `null` default, or `''`) still lets the seed apply.
  // svelte-ignore state_referenced_locally
  const tableState = createTableState(persistenceConfig, {
    sort: initialSort,
    filters: initialFilters,
    selectedIds: selectedIds === undefined ? initialSelectedIds : undefined,
    groupBy: groupByKey ? undefined : initialGroupBy,
    summaryConfigs: initialSummaryConfigs
  });
  attachTableContext(tableState);

  const {
    state,
    setItems,
    setColumns,
    setLoading,
    setPage,
    setItemsPerPage,
    setGroupByKey,
    setGroupOrder,
    setError
  } = tableState;

  // ── Sync props → store ──

  $effect(() => {
    if (columns && columns.length > 0) {
      setColumns(columns);
      if (import.meta.env?.DEV) {
        const result = ColumnValidation.validateColumns(columns);
        if (!result.isValid) {
          console.warn('[Table] Column validation:', result.errors);
        }
        // Columns are unknown at store construction, so a seeded sort against
        // a nonexistent column stays silently inert (read-tolerant). Surface
        // it here, where columns are first known. The seed is
        // construction-time-only — read it untracked so a later prop change
        // cannot re-run this effect.
        const seededSort = untrack(() => initialSort);
        if (seededSort?.column && !findColumnById(columns, seededSort.column)) {
          console.warn(
            `[Table] initialSort.column "${seededSort.column}" does not match any column id — the seeded sort has no effect.`
          );
        }
      }
    }
  });

  // One-shot DEV sanity check on the initial server-mode configuration. The
  // actual query lifecycle (below) reads queryFn/onQueryChange reactively inside
  // its $effect, so this init-only read is intentional.
  // svelte-ignore state_referenced_locally
  if (import.meta.env?.DEV && mode === 'server' && !queryFn && !onQueryChange) {
    console.warn(
      '[Table] mode="server" without queryFn or onQueryChange — the table has no way to fetch data.'
    );
  }

  $effect(() => {
    // In server mode, items come from queryFn or external; skip direct sync if queryFn manages it
    if (items && items.length > 0 && !(mode === 'server' && queryFn)) {
      setItems(items);
    }
  });

  $effect(() => {
    if (groupOrder && groupOrder.length > 0) {
      setGroupOrder(groupOrder);
    }
  });

  $effect(() => {
    setItemsPerPage(itemsPerPage);
  });

  $effect(() => {
    setPage(initialPage);
  });

  $effect(() => {
    state.multiExpand = multiExpand;
  });

  $effect(() => {
    state.mode = mode;
  });

  $effect(() => {
    if (mode === 'server') {
      state.serverTotalItems = serverTotalItems;
    }
  });

  $effect(() => {
    state.selectionMode = selectionMode;
  });

  $effect(() => {
    state.enableColumnVisibility = enableColumnVisibility;
    // Turning the feature off means "all columns visible". Reveal everything and
    // drop any hidden set — including one hydrated from persistence — otherwise
    // persisted-hidden columns would be stranded: hidden, with both restore UIs
    // (the visibility menu and the header-menu "show" list) gated off. untrack
    // keeps this effect keyed only on the flag, not on the columns it touches.
    if (!enableColumnVisibility) {
      untrack(() => tableState.showAllColumns());
    }
  });

  // Selection is controlled when the prop is present. Set the flag *before*
  // applying, so the setSelectedIds wrapper's syncSelection sees it and skips
  // persisting — a controlled value is never mirrored to storage (persistSelection
  // is a true no-op in controlled mode). `!== undefined` so an empty controlled
  // array still counts as controlled. untrack keeps this effect keyed only on
  // the prop: setSelectedIds reads `state.selectedIds` on its write path
  // (SvelteSet mutation + syncSelection), so without it every internal row
  // click re-runs the effect, which re-asserts the stale prop value and
  // freezes the selection against user interaction.
  $effect(() => {
    state.selectionControlled = selectedIds !== undefined;
    if (selectedIds) {
      untrack(() => tableState.setSelectedIds(selectedIds));
    }
  });

  $effect(() => {
    if (onSelectionChange && state.selectionMode !== 'none') {
      const selected = tableState.selectedItems;
      onSelectionChange(selected);
    }
  });

  // Controlled search: an explicit `searchTerm` prop drives the store. Guard on
  // `!== undefined` so an empty string is a valid controlled value ("no
  // search") — and so a controlled term wins over a persisted one. Uncontrolled
  // usage leaves `searchTerm` undefined and this effect is inert.
  $effect(() => {
    if (searchTerm !== undefined) {
      tableState.setSearchTerm(searchTerm);
    }
  });

  $effect(() => {
    if (onSearchTermChange) {
      onSearchTermChange(state.searchTerm);
    }
  });

  $effect(() => {
    setLoading(loading);
  });

  // Controlled grouping: an explicit `groupByKey` prop drives the store
  // reactively. The uncontrolled `initialGroupBy` seed is applied once at
  // construction (see TableSeedState) and dropped from the seed above when
  // `groupByKey` is set, so the two never fight. `initialSummaryConfigs`
  // seeds the same way — construction-time, seed-once — so it needs no effect.
  $effect(() => {
    if (groupByKey) {
      setGroupByKey(groupByKey);
    }
  });

  // ── Server mode: queryFn lifecycle ──

  let abortController: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let initialFetchDone = false;

  $effect(() => {
    if (mode !== 'server') return;

    // Track the queryKey to detect changes
    const currentQueryKey = tableState.queryKey;

    // Debounce: clear previous timer
    if (debounceTimer) clearTimeout(debounceTimer);

    // For the initial fetch, don't debounce
    const delay = initialFetchDone ? queryDebounceMs : 0;

    debounceTimer = setTimeout(() => {
      const currentQuery = tableState.query;

      if (queryFn) {
        executeManagedFetch(currentQuery);
      } else if (onQueryChange) {
        onQueryChange(currentQuery);
      }

      initialFetchDone = true;
    }, delay);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  async function executeManagedFetch(query: TableQuery) {
    if (!queryFn) return;

    // Cancel previous in-flight request
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    const { signal } = abortController;

    tableState.setServerLoading();

    try {
      const result = await queryFn(query, { signal });

      // Ignore result if this request was aborted (superseded by a newer one)
      if (signal.aborted) return;

      tableState.setServerResult(result);
    } catch (e) {
      // Don't treat abort as an error
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (signal.aborted) return;

      const message = e instanceof Error ? e.message : tt('error.fetchFailed');
      tableState.setServerError(message);
    }
  }

  // ── Live updates: auto-apply on navigation ──
  $effect(() => {
    if (!enableLiveUpdates || !autoApplyOnNavigation) return;

    // Track ONLY the navigation signature — read unconditionally, before any
    // pending check. Tracking `hasPendingUpdates` here would re-run the effect
    // on every push and apply the buffer immediately instead of deferring it
    // to the next navigation; checking it before these reads would also leave
    // the navigation fields untracked whenever the buffer is empty.
    void state.currentPage;
    void state.sortColumn;
    void state.sortDirection;
    void state.searchTerm;
    void state.activeFilters;
    void state.groupByKey;

    // Auto-apply pending changes when the user navigates (view is already
    // changing). untrack: the pending check and the apply read/write
    // live-update state, which must not become a dependency of this effect.
    untrack(() => {
      if (tableState.hasPendingUpdates) {
        tableState.applyAllUpdates();
      }
    });
  });

  // Cleanup on component destroy
  $effect(() => {
    return () => {
      if (abortController) abortController.abort();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });
</script>

{#if children}
  {@render children()}
{/if}
