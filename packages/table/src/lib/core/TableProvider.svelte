<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { attachTableContext, createTableState } from '$lib';
  import { useTableI18n } from '$lib/i18n';
  import { ColumnValidation } from '$lib/factories/ColumnValidation';
  import type { Column, TableItem, TableQuery, TableQueryResult } from '$lib/types/tableTypes';
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

  const tableState = createTableState(persistenceConfig);
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
      }
    }
  });

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
  // array still counts as controlled.
  $effect(() => {
    state.selectionControlled = selectedIds !== undefined;
    if (selectedIds) {
      tableState.setSelectedIds(selectedIds);
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

  $effect(() => {
    if (groupByKey) {
      setGroupByKey(groupByKey);
    } else if (initialGroupBy && columns && columns.length > 0) {
      setGroupByKey(initialGroupBy);
    }
  });

  $effect(() => {
    if (
      initialSummaryConfigs &&
      initialSummaryConfigs.length > 0 &&
      state.summaryConfigs.length === 0
    ) {
      tableState.setSummaryConfigs(initialSummaryConfigs);
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
    if (!tableState.hasPendingUpdates) return;

    // Track navigation state changes
    void state.currentPage;
    void state.sortColumn;
    void state.sortDirection;
    void state.searchTerm;
    void state.activeFilters;
    void state.groupByKey;

    // Auto-apply pending changes when the user navigates (view is already changing)
    tableState.applyAllUpdates();
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
