<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  import { attachTableContext, attachCellLocale, createTableState, findColumnById } from '$lib';
  import { useTableI18n } from '$lib/i18n';
  import { ColumnValidation } from '$lib/factories/ColumnValidation';
  import type {
    Column,
    Filter,
    TableItem,
    TableQuery,
    TableQueryResult
  } from '$lib/types/tableTypes';
  import type {
    SummaryConfig,
    TablePersistenceConfig,
    TableViewState
  } from '$lib/stores/TableStore.svelte';
  import type { TableContext } from './table/index';

  const tt = useTableI18n();

  // Resolved once per table and published on the context, not read per cell —
  // see `attachCellLocale`. A getter, so a locale switch re-renders the cells.
  const i18n = useI18n();
  attachCellLocale(() => resolveDateLocale('auto', i18n.locale));

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
    virtualized?: boolean;
    loading?: boolean;
    error?: string | null;
    children?: Snippet;
    persistenceConfig?: TablePersistenceConfig;
    mode?: 'client' | 'server';
    serverTotalItems?: number;
    queryFn?: (query: TableQuery, options: { signal: AbortSignal }) => Promise<TableQueryResult>;
    onQueryChange?: (query: TableQuery) => void;
    query?: TableViewState;
    queryDebounceMs?: number;
    enableLiveUpdates?: boolean;
    autoApplyOnNavigation?: boolean;
    selectionMode?: 'none' | 'single' | 'multi';
    rowClickSelects?: boolean;
    activeRowId?: string | number | null;
    selectedIds?: Array<string | number>;
    onSelectionChange?: (selectedItems: TableItem[]) => void;
    enableColumnVisibility?: boolean;
    searchTerm?: string;
    onSearchTermChange?: (term: string) => void;
    onReady?: (context: TableContext) => void;
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
    virtualized = false,
    loading = false,
    error = null,
    children,
    persistenceConfig,
    mode = 'client',
    serverTotalItems = 0,
    queryFn = undefined,
    onQueryChange = undefined,
    query = undefined,
    queryDebounceMs = 300,
    enableLiveUpdates = false,
    autoApplyOnNavigation = true,
    selectionMode = 'none',
    rowClickSelects = false,
    activeRowId = null,
    selectedIds = undefined,
    onSelectionChange = undefined,
    enableColumnVisibility = true,
    searchTerm = undefined,
    onSearchTermChange = undefined,
    onReady = undefined
  }: TableProviderProps = $props();

  /**
   * Whether a managed fetch is configured — as a boolean, deliberately.
   *
   * The prop getters below feed deriveds, and a derived that read `queryFn`
   * itself would re-evaluate whenever the consumer passes a fresh arrow
   * (`queryFn={(q) => …}` re-creates it on every parent render), discarding the
   * fetched rows. `!!queryFn` only changes when one appears or disappears.
   */
  const hasQueryFn = $derived(!!queryFn);
  /**
   * Same treatment for `onQueryChange`, and here it matters even more: the
   * emission effect below has to know whether anybody is listening *before* it
   * decides to run. Reading the callback itself would put its identity on the
   * effect's dependency list, so an inline `onQueryChange={(q) => …}` would
   * re-fire the effect on every parent render — and since the listener's job is
   * to write the query into the URL, that is a navigation loop, not just noise.
   */
  const hasQueryChange = $derived(!!onQueryChange);

  // Store is built once from the initial persistence config — not meant to
  // re-create if the prop changes reactively. The initial* seeds are equally
  // construction-time-only (seed-once): later changes to initialSort /
  // initialFilters / initialSelectedIds / initialGroupBy / initialSummaryConfigs
  // are ignored, and each axis only fills what persistence has nothing stored
  // for — a persisted value wins, including a persisted *empty* one, so a
  // cleared axis is not re-seeded (see TableSeedState). Controlled props
  // supersede their seed entirely: `selectedIds` drops `initialSelectedIds`,
  // and a truthy `groupByKey` drops `initialGroupBy` (both applied by the
  // effects below), so the prop is the source of truth from the first render
  // (and, per syncSelection, a controlled selection is never mirrored to
  // storage). The `groupByKey` gate uses truthiness — matching the effect
  // below and the pre-migration `if (groupByKey) … else if (initialGroupBy)`
  // — so a falsy `groupByKey` (its `null` default, or `''`) still lets the
  // seed apply.
  // svelte-ignore state_referenced_locally
  const tableState = createTableState(
    persistenceConfig,
    {
      sort: initialSort,
      filters: initialFilters,
      selectedIds: selectedIds === undefined ? initialSelectedIds : undefined,
      groupBy: groupByKey ? undefined : initialGroupBy,
      summaryConfigs: initialSummaryConfigs
    },
    // Prop → store, as getters rather than as effects. This block replaces
    // sixteen `$effect(() => { state.X = X })` mirrors; because a derived is
    // evaluated during SSR, the server now renders the actual rows and columns
    // instead of an empty table (#10). Values with a second writer (items,
    // pagination, loading/error) stay assignable — the derived re-seeds when the
    // prop behind it changes. See docs/SVELTE5-PATTERNS.md → "Prop-derived state".
    {
      // A managed `queryFn` owns the item list; the prop must not fight the
      // fetch lifecycle, so it contributes nothing in that mode (unchanged
      // behaviour, previously the `!(mode === 'server' && queryFn)` guard).
      //
      // Reads `hasQueryFn`, NOT `queryFn` — this is a derived, not an effect,
      // and the difference bites. `queryFn` is a function prop, so
      // `<Table queryFn={(q) => …}>` hands it a fresh identity on every parent
      // re-render. Depending on the identity would invalidate this derived,
      // re-seed `state.items` to `[]`, and throw away the rows `useRemoteData`
      // had assigned — with nothing to refetch them, since the fetch effect
      // tracks only `mode` and `queryKey`. A boolean changes only when a
      // `queryFn` actually appears or disappears, and Svelte skips propagation
      // when a derived's new value is referentially identical to the old one.
      items: () => (mode === 'server' && hasQueryFn ? [] : (items as TableItem[])),
      columns: () => columns,
      // Same ownership rule, same reason for the boolean.
      loading: () => (mode === 'server' && hasQueryFn ? false : loading),
      error: () => (mode === 'server' && hasQueryFn ? null : error),
      initialPage: () => initialPage,
      itemsPerPage: () => itemsPerPage,
      multiExpand: () => multiExpand,
      groupOrder: () => groupOrder,
      selectionMode: () => selectionMode,
      selectionControlled: () => selectedIds !== undefined,
      searchControlled: () => searchTerm !== undefined,
      rowClickSelects: () => rowClickSelects,
      activeRowId: () => activeRowId ?? null,
      virtualized: () => virtualized,
      mode: () => mode,
      serverTotalItems: () => (mode === 'server' ? serverTotalItems : 0),
      enableColumnVisibility: () => enableColumnVisibility,
      query: () => query
    }
  );
  attachTableContext(tableState);

  const { state, setGroupByKey } = tableState;

  // Virtualization vs. grouping. `state.virtualized` now derives from the prop,
  // so the flag needs no syncing; what remains is the one-way *clearing* of a
  // group key that persistence or a seed put in place before the mode was known.
  // Done synchronously, before the first render, so a virtualized table never
  // renders its full item set for a frame. Storage is deliberately left alone,
  // so a persisted grouping applies again on the next load without `virtualized`.
  // svelte-ignore state_referenced_locally
  if (virtualized && state.groupByKey) {
    if (import.meta.env?.DEV) {
      console.warn(
        `[Table] Ignoring grouping ("${state.groupByKey}") on a virtualized table — grouped virtualization is not implemented. Drop \`virtualized\` to group, or group server-side.`
      );
    }
    state.groupByKey = null;
  }

  // The collapse set holds *group names* — values of whatever column is grouped
  // by — so it cannot outlive its key: after regrouping, those names mean
  // nothing, and one that happens to match collapses a group nobody touched.
  // `setGroupByKey` clears it for every imperative path, but `state.groupByKey`
  // also derives from the controlled `query` prop, which changes on plain
  // navigation (#152) without passing through any setter. Watching the value
  // covers that door. `currentPage` deliberately stays out of it: resetting to
  // page 1 belongs to a click, not to a link that names its own page.
  let lastGroupKey: string | null | undefined;
  $effect(() => {
    const key = state.groupByKey;
    const previous = untrack(() => lastGroupKey);
    lastGroupKey = key;
    if (previous === undefined || key === previous) return;
    untrack(() => {
      state.collapsedGroups = new SvelteSet();
      state.allGroupsExpanded = true;
    });
  });

  // Runtime toggle into virtualization: clear a group key that is active by then.
  // Still an effect — it is not a derivation but a one-way write to a *different*
  // piece of state, which is exactly what effects are for.
  $effect(() => {
    if (!virtualized) return;
    const active = untrack(() => state.groupByKey);
    if (!active) return;
    if (import.meta.env?.DEV) {
      console.warn(
        `[Table] Ignoring grouping ("${active}") on a virtualized table — grouped virtualization is not implemented.`
      );
    }
    untrack(() => {
      state.groupByKey = null;
    });
  });

  // ── DEV validation of the props the store now derives from ──
  // The values reach the store as getters (see `createTableState` above); what is
  // left here is telling the developer when they do not make sense. Effects,
  // legitimately: they only report.
  $effect(() => {
    if (!import.meta.env?.DEV || !columns || columns.length === 0) return;
    const result = ColumnValidation.validateColumns(columns);
    if (!result.isValid) {
      console.warn('[Table] Column validation:', result.errors);
    }
    // A seeded sort against a nonexistent column stays silently inert
    // (read-tolerant), so surface it. The seed is construction-time-only — read
    // it untracked so a later prop change cannot re-run this.
    const seededSort = untrack(() => initialSort);
    if (seededSort?.column && !findColumnById(columns, seededSort.column)) {
      console.warn(
        `[Table] initialSort.column "${seededSort.column}" does not match any column id — the seeded sort has no effect.`
      );
    }
    // The `query` twin of the check above, and the more important one: this
    // value usually comes from a URL, so it can be set by whoever sent the
    // link rather than by the developer.
    const controlledSort = query?.sortColumn;
    if (controlledSort && !findColumnById(columns, controlledSort)) {
      console.warn(
        `[Table] query.sortColumn "${controlledSort}" does not match any column id — the table renders unsorted.`
      );
    }
  });

  // A controlled axis silently outranks the prop that would otherwise seed it,
  // and silently switches persistence off for that axis. That is the intended
  // precedence (#152: URL > localStorage > seed), but "intended" and "visible"
  // are different things: the seed prop stays in the call site looking like it
  // does something. Every neighbouring conflict in this file is reported, so
  // this one is too.
  $effect(() => {
    if (!import.meta.env?.DEV || !query) return;
    const shadowed: string[] = [];
    const seeds = untrack(() => ({
      initialSort,
      initialFilters,
      initialGroupBy,
      initialPage,
      itemsPerPage,
      searchTerm
    }));
    // Only props whose value proves the consumer passed them. `initialPage`,
    // `itemsPerPage` and `initialGroupBy` carry defaults, so "present" is not
    // observable — compared against the default instead, which reports the
    // cases that actually differ and stays quiet on the ones that cannot.
    if ((query.sortColumn !== undefined || query.sortDirection !== undefined) && seeds.initialSort)
      shadowed.push('initialSort');
    if (query.activeFilters !== undefined && seeds.initialFilters?.length)
      shadowed.push('initialFilters');
    if (query.groupByKey !== undefined && seeds.initialGroupBy) shadowed.push('initialGroupBy');
    if (query.page !== undefined && seeds.initialPage !== 1) shadowed.push('initialPage');
    if (query.itemsPerPage !== undefined && seeds.itemsPerPage !== 10)
      shadowed.push('itemsPerPage');
    if (query.searchTerm !== undefined && seeds.searchTerm !== undefined)
      shadowed.push('searchTerm');
    if (shadowed.length > 0) {
      console.warn(
        `[Table] \`query\` controls the same axes as ${shadowed.map((s) => `\`${s}\``).join(', ')} — the controlled value wins and the prop has no effect. Move the value into the query, or drop the prop.`
      );
    }
    if (persistenceConfig) {
      const axes = (
        ['sortColumn', 'sortDirection', 'searchTerm', 'activeFilters', 'groupByKey'] as const
      ).filter((axis) => query[axis] !== undefined);
      if (axes.length > 0) {
        console.warn(
          `[Table] \`query\` controls ${axes.map((a) => `\`${a}\``).join(', ')}, so \`persistenceConfig\` neither restores nor stores ${axes.length === 1 ? 'that axis' : 'those axes'} — the link is the source of truth for them.`
        );
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

  // Turning column visibility off means "all columns visible": reveal everything
  // and drop any hidden set — including one hydrated from persistence —
  // otherwise persisted-hidden columns would be stranded (hidden, with both
  // restore UIs gated off). A write to a different slice, so still an effect;
  // untrack keeps it keyed only on the flag.
  $effect(() => {
    if (enableColumnVisibility) return;
    untrack(() => tableState.showAllColumns());
  });

  // Controlled selection: the flag itself derives from the prop (see above), but
  // *applying* the value is a write into the selection set, which is a genuine
  // effect. untrack keeps it keyed only on the prop: setSelectedIds reads
  // `state.selectedIds` on its write path, so without it every internal row click
  // would re-run this, re-assert the stale prop value and freeze the selection
  // against user interaction.
  $effect(() => {
    if (!selectedIds) return;
    untrack(() => tableState.setSelectedIds(selectedIds));
  });

  $effect(() => {
    if (onSelectionChange && state.selectionMode !== 'none') {
      const selected = tableState.selectedItems;
      onSelectionChange(selected);
    }
  });

  // Controlled search: `state.searchControlled` derives from the prop (see
  // above), so `syncSearch` sees the flag from the first render and never
  // mirrors a controlled term to storage. Applying the value is still a write —
  // guarded on `!== undefined` so an empty string is a valid controlled value
  // ("no search") and a controlled term wins over a persisted one. No `untrack`
  // needed, unlike the selection twin: this path reads nothing reactive
  // (`useSearch.setSearchTerm` only assigns, and syncSearch short-circuits on
  // the flag before it would touch `state.searchTerm`).
  $effect(() => {
    if (searchTerm === undefined) return;
    tableState.setSearchTerm(searchTerm);
  });

  $effect(() => {
    if (onSearchTermChange) {
      onSearchTermChange(state.searchTerm);
    }
  });

  // Consumer-driven loading/error. Both slots belong to whoever fetches: in
  // client mode and in the manual server flow (`onQueryChange`) that is the
  // consumer, so the props drive the store (through the getters above). A managed
  // `queryFn` owns the same two slots itself (setServerLoading / setServerResult
  // / setServerError), so the props contribute nothing there instead of racing
  // the fetch lifecycle — and DEV says so rather than swallowing the conflict.
  const managedFetch = $derived(mode === 'server' && !!queryFn);

  $effect(() => {
    if (!managedFetch) return;
    if (import.meta.env?.DEV && (loading || error !== null)) {
      console.warn(
        '[Table] `loading`/`error` are ignored while a managed `queryFn` is set — the table drives both. Drop the props or switch to `onQueryChange` for manual control.'
      );
    }
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

  // Hand the context to consumers outside the table's tree (getTableContext()
  // only resolves inside it). Declared *after* the prop→store effects above, so
  // it flushes last and the callback sees columns and items already synced —
  // Svelte runs user effects in creation order. untrack keeps the callback off
  // the dependency list; an inline arrow prop would otherwise re-fire this on
  // every parent re-render.
  let readyFired = false;
  $effect(() => {
    if (readyFired || !onReady) return;
    readyFired = true;
    untrack(() => onReady(tableState));
  });

  // ── Server mode: queryFn lifecycle ──

  let abortController: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let initialFetchDone = false;

  $effect(() => {
    // Server mode runs this for the fetch. Client mode runs it only to emit —
    // which is what lets the view state reach the URL, and through the URL the
    // server (#152). `query`/`queryKey` were always computed mode-independently;
    // only the emission was gated.
    if (mode !== 'server' && !hasQueryChange) return;

    // Track the queryKey to detect changes
    const currentQueryKey = tableState.queryKey;

    // Debounce: clear previous timer
    if (debounceTimer) clearTimeout(debounceTimer);

    // For the initial fetch, don't debounce
    const delay = initialFetchDone ? queryDebounceMs : 0;

    debounceTimer = setTimeout(() => {
      const currentQuery = tableState.query;

      // `queryFn` is a *server*-mode contract; in client mode the table owns
      // the data and there is nothing to fetch, so only the emission runs.
      if (mode === 'server' && queryFn) {
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
