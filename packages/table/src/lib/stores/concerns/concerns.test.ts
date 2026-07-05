import { describe, expect, it } from 'vitest';
import type { Column, Filter } from '$lib/types/tableTypes';
import type { SummaryConfig } from '../TableStore.svelte';
import type { TableState } from './types';

// Concern tests for pure logic (non-reactive parts).
// Reactive $derived chains are tested indirectly via the existing TableStore tests.
// These tests validate the concern API contracts.

describe('useSearch', () => {
  // Search concern mutates state.searchTerm and state.currentPage.
  // Since $state requires Svelte runtime, we test the contract:
  // setSearchTerm(term) should update searchTerm and reset page.

  it('contract: setSearchTerm updates term and resets page', async () => {
    const { useSearch } = await import('./useSearch.svelte.js');
    const state = {
      searchTerm: '',
      showAdvancedSearch: false,
      currentPage: 5
    } as unknown as TableState;

    const search = useSearch(state);
    search.setSearchTerm('hello');

    expect(state.searchTerm).toBe('hello');
    expect(state.currentPage).toBe(1);
  });

  it('contract: toggleAdvancedSearch flips state', async () => {
    const { useSearch } = await import('./useSearch.svelte.js');
    const state = {
      searchTerm: '',
      showAdvancedSearch: false,
      currentPage: 1
    } as unknown as TableState;

    const search = useSearch(state);
    search.toggleAdvancedSearch();
    expect(state.showAdvancedSearch).toBe(true);
    search.toggleAdvancedSearch();
    expect(state.showAdvancedSearch).toBe(false);
  });
});

describe('useExpansion', () => {
  it('contract: toggleExpand in single mode', async () => {
    const { useExpansion } = await import('./useExpansion.svelte.js');
    const state = {
      multiExpand: false,
      expandedItemId: null,
      expandedItemIds: new Set()
    } as unknown as TableState;

    const expansion = useExpansion(state);

    expansion.toggleExpand('row-1');
    expect(state.expandedItemId).toBe('row-1');

    expansion.toggleExpand('row-1');
    expect(state.expandedItemId).toBe(null);
  });

  it('contract: toggleExpand in multi mode', async () => {
    const { useExpansion } = await import('./useExpansion.svelte.js');
    const state = {
      multiExpand: true,
      expandedItemId: null,
      expandedItemIds: new Set<string | number>()
    } as unknown as TableState;

    const expansion = useExpansion(state);

    expansion.toggleExpand('row-1');
    expect(state.expandedItemIds.has('row-1')).toBe(true);

    expansion.toggleExpand('row-2');
    expect(state.expandedItemIds.has('row-1')).toBe(true);
    expect(state.expandedItemIds.has('row-2')).toBe(true);

    expansion.toggleExpand('row-1');
    expect(state.expandedItemIds.has('row-1')).toBe(false);
    expect(state.expandedItemIds.has('row-2')).toBe(true);
  });

  it('contract: isItemExpanded reflects state', async () => {
    const { useExpansion } = await import('./useExpansion.svelte.js');

    const singleState = {
      multiExpand: false,
      expandedItemId: 'row-1',
      expandedItemIds: new Set()
    } as unknown as TableState;
    const singleExpansion = useExpansion(singleState);
    expect(singleExpansion.isItemExpanded('row-1')).toBe(true);
    expect(singleExpansion.isItemExpanded('row-2')).toBe(false);

    const multiState = {
      multiExpand: true,
      expandedItemId: null,
      expandedItemIds: new Set(['row-1', 'row-3'])
    } as unknown as TableState;
    const multiExpansion = useExpansion(multiState);
    expect(multiExpansion.isItemExpanded('row-1')).toBe(true);
    expect(multiExpansion.isItemExpanded('row-2')).toBe(false);
    expect(multiExpansion.isItemExpanded('row-3')).toBe(true);
  });
});

describe('useSorting', () => {
  it('contract: handleSort cycles through asc → desc → off', async () => {
    const { useSorting } = await import('./useSorting.svelte.js');
    const state = {
      sortColumn: '',
      sortDirection: 'asc' as 'asc' | 'desc'
    } as unknown as TableState;

    const sorting = useSorting(state, () => []);

    // First click: set column, asc
    sorting.handleSort('name');
    expect(state.sortColumn).toBe('name');
    expect(state.sortDirection).toBe('asc');

    // Second click: same column, desc
    sorting.handleSort('name');
    expect(state.sortColumn).toBe('name');
    expect(state.sortDirection).toBe('desc');

    // Third click: same column, reset
    sorting.handleSort('name');
    expect(state.sortColumn).toBe('');
    expect(state.sortDirection).toBe('asc');
  });

  it('contract: clicking a different column resets to asc', async () => {
    const { useSorting } = await import('./useSorting.svelte.js');
    const state = {
      sortColumn: 'name',
      sortDirection: 'desc' as 'asc' | 'desc'
    } as unknown as TableState;

    const sorting = useSorting(state, () => []);

    sorting.handleSort('age');
    expect(state.sortColumn).toBe('age');
    expect(state.sortDirection).toBe('asc');
  });
});

describe('useGrouping', () => {
  it('contract: setGroupByKey resets collapse state and page', async () => {
    const { useGrouping } = await import('./useGrouping.svelte.js');
    const state = {
      groupByKey: null as string | null,
      collapsedGroups: new Set(['Engineering']),
      allGroupsExpanded: false,
      currentPage: 3,
      groupOrder: []
    } as unknown as TableState;

    const grouping = useGrouping(state, () => []);

    grouping.setGroupByKey('department');
    expect(state.groupByKey).toBe('department');
    expect(state.collapsedGroups.size).toBe(0);
    expect(state.allGroupsExpanded).toBe(true);
    expect(state.currentPage).toBe(1);
  });

  it('contract: setGroupByKey(null) clears grouping', async () => {
    const { useGrouping } = await import('./useGrouping.svelte.js');
    const state = {
      groupByKey: 'department' as string | null,
      collapsedGroups: new Set<string>(),
      allGroupsExpanded: true,
      currentPage: 1,
      groupOrder: []
    } as unknown as TableState;

    const grouping = useGrouping(state, () => []);

    grouping.setGroupByKey(null);
    expect(state.groupByKey).toBe(null);
  });
});

// Regression guard: the v2 column-shape exists so search, sort and group
// route through the column's accessor (function or string). Without these
// tests we could re-introduce the `getNestedValue(item, 'objectProperty')`
// path that quietly stringifies `{...}` to '[object Object]' and breaks
// every consumer that used a function-accessor column.
describe('derived ops use the accessor (function or string)', () => {
  type Row = { id: number; user: { name: string }; tier: string };
  const items: Row[] = [
    { id: 1, user: { name: 'Alice' }, tier: 'gold' },
    { id: 2, user: { name: 'Bob' }, tier: 'silver' },
    { id: 3, user: { name: 'Charlie' }, tier: 'gold' }
  ];
  const columns: Column<Row>[] = [
    { id: 'userName', accessor: (r) => r.user.name, title: 'Name' },
    { accessor: 'tier', title: 'Tier' }
  ];

  it('search matches a function accessor', async () => {
    const { useFiltering } = await import('./useFiltering.svelte.js');
    const state = {
      mode: 'client',
      items,
      columns,
      searchTerm: 'bob',
      activeFilters: [],
      currentPage: 1
    } as unknown as TableState;

    const filtering = useFiltering(state);
    expect(filtering.filteredItems).toHaveLength(1);
    expect((filtering.filteredItems[0] as Row).id).toBe(2);
  });

  it('sort uses a function accessor', async () => {
    const { useSorting } = await import('./useSorting.svelte.js');
    const state = {
      mode: 'client',
      columns,
      sortColumn: 'userName',
      sortDirection: 'asc' as const
    } as unknown as TableState;

    const sorting = useSorting(state, () => items);
    expect(sorting.sortedItems.map((r) => (r as Row).id)).toEqual([1, 2, 3]);
  });

  it('group buckets rows by a function-accessor value', async () => {
    const { useGrouping } = await import('./useGrouping.svelte.js');
    const state = {
      mode: 'client',
      columns,
      groupByKey: 'userName',
      collapsedGroups: new Set<string>(),
      allGroupsExpanded: true,
      currentPage: 1,
      groupOrder: []
    } as unknown as TableState;

    const grouping = useGrouping(state, () => items);
    expect(Object.keys(grouping.grouped).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('synthetic-only sort id leaves order untouched (no scrambling)', async () => {
    const { useSorting } = await import('./useSorting.svelte.js');
    const syntheticCols: Column<Row>[] = [{ id: 'actions', title: '' }];
    const state = {
      mode: 'client',
      columns: syntheticCols,
      sortColumn: 'actions',
      sortDirection: 'asc' as const
    } as unknown as TableState;

    const sorting = useSorting(state, () => items);
    expect(sorting.sortedItems.map((r) => (r as Row).id)).toEqual([1, 2, 3]);
  });
});

describe('useFiltering', () => {
  it('contract: addFilter adds to activeFilters and resets page', async () => {
    const { useFiltering } = await import('./useFiltering.svelte.js');
    const state = {
      items: [],
      columns: [],
      searchTerm: '',
      activeFilters: [] as Filter[],
      currentPage: 3
    } as unknown as TableState;

    const filtering = useFiltering(state);

    filtering.addFilter({ column: 'name', operator: 'contains', value: 'Alice' });
    expect(state.activeFilters).toHaveLength(1);
    expect(state.currentPage).toBe(1);
  });

  it('contract: removeFilter removes by index', async () => {
    const { useFiltering } = await import('./useFiltering.svelte.js');
    const state = {
      items: [],
      columns: [],
      searchTerm: '',
      activeFilters: [
        { column: 'name', operator: 'contains', value: 'Alice' },
        { column: 'age', operator: 'greaterThan', value: '25' }
      ],
      currentPage: 1
    } as unknown as TableState;

    const filtering = useFiltering(state);

    filtering.removeFilter(0);
    expect(state.activeFilters).toHaveLength(1);
    expect(state.activeFilters[0].column).toBe('age');
  });

  it('contract: clearAllFilters empties filters', async () => {
    const { useFiltering } = await import('./useFiltering.svelte.js');
    const state = {
      items: [],
      columns: [],
      searchTerm: '',
      activeFilters: [{ column: 'name', operator: 'contains', value: 'Alice' }],
      currentPage: 2
    } as unknown as TableState;

    const filtering = useFiltering(state);

    filtering.clearAllFilters();
    expect(state.activeFilters).toHaveLength(0);
    expect(state.currentPage).toBe(1);
  });

  it('contract: hasFilterForColumn returns correct results', async () => {
    const { useFiltering } = await import('./useFiltering.svelte.js');
    const state = {
      items: [],
      columns: [],
      searchTerm: '',
      activeFilters: [{ column: 'name', operator: 'contains', value: 'Alice' }],
      currentPage: 1
    } as unknown as TableState;

    const filtering = useFiltering(state);

    expect(filtering.hasFilterForColumn('name')).toBe(true);
    expect(filtering.hasFilterForColumn('age')).toBe(false);
    expect(filtering.hasFilterForColumn('name', 'contains')).toBe(true);
    expect(filtering.hasFilterForColumn('name', 'equals')).toBe(false);
  });
});

describe('useSummary', () => {
  it('contract: getFormattedSummaryValue formats by type', async () => {
    const { useSummary } = await import('./useSummary.svelte.js');
    const state = {
      summaryConfigs: [
        { column: 'salary', type: 'sum' as const },
        { column: 'age', type: 'avg' as const },
        { column: 'count', type: 'count' as const }
      ],
      columns: [],
      showSummary: true,
      groupByKey: null
    } as unknown as TableState;

    const s = useSummary(
      state,
      () => [],
      () => ({})
    );

    expect(s.getFormattedSummaryValue('salary', 50000.7)).toBe('50001');
    expect(s.getFormattedSummaryValue('age', 30.456)).toBe('30.46');
    expect(s.getFormattedSummaryValue('count', 42)).toBe('42');
  });

  it('contract: getFormattedSummaryValue uses custom formatter', async () => {
    const { useSummary } = await import('./useSummary.svelte.js');
    const state = {
      summaryConfigs: [
        { column: 'salary', type: 'sum' as const, formatter: (v: number) => `$${v.toFixed(2)}` }
      ],
      showSummary: true,
      groupByKey: null
    } as unknown as TableState;

    const s = useSummary(
      state,
      () => [],
      () => ({})
    );

    expect(s.getFormattedSummaryValue('salary', 50000)).toBe('$50000.00');
  });

  it('contract: addSummaryConfig auto-enables summary', async () => {
    const { useSummary } = await import('./useSummary.svelte.js');
    const state = {
      summaryConfigs: [] as SummaryConfig[],
      showSummary: false,
      groupByKey: null
    } as unknown as TableState;

    const s = useSummary(
      state,
      () => [],
      () => ({})
    );

    s.addSummaryConfig({ column: 'salary', type: 'sum' });
    expect(state.showSummary).toBe(true);
    expect(state.summaryConfigs).toHaveLength(1);
  });

  it('contract: removeSummaryConfig auto-disables when empty', async () => {
    const { useSummary } = await import('./useSummary.svelte.js');
    const state = {
      summaryConfigs: [{ column: 'salary', type: 'sum' as const }],
      showSummary: true,
      groupByKey: null
    } as unknown as TableState;

    const s = useSummary(
      state,
      () => [],
      () => ({})
    );

    s.removeSummaryConfig('salary');
    expect(state.showSummary).toBe(false);
    expect(state.summaryConfigs).toHaveLength(0);
  });
});

describe('useFocusManagement', () => {
  it('contract: initial focusedRowIndex is 0', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: moveFocus down increments index', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(1);

    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(2);
  });

  it('contract: moveFocus up decrements index', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.setFocusedRow(3);
    focus.moveFocus('up');
    expect(focus.focusedRowIndex).toBe(2);
  });

  it('contract: moveFocus respects boundaries', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 3);

    // Can't go below 0
    focus.moveFocus('up');
    expect(focus.focusedRowIndex).toBe(0);

    // Can't go above count-1
    focus.setFocusedRow(2);
    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(2);
  });

  it('contract: moveFocus first/last jumps to boundaries', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 10);

    focus.moveFocus('last');
    expect(focus.focusedRowIndex).toBe(9);

    focus.moveFocus('first');
    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: resetFocus returns to 0', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.setFocusedRow(4);
    expect(focus.focusedRowIndex).toBe(4);

    focus.resetFocus();
    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: isFocusedRow checks correctly', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.setFocusedRow(2);
    expect(focus.isFocusedRow(0)).toBe(false);
    expect(focus.isFocusedRow(2)).toBe(true);
    expect(focus.isFocusedRow(4)).toBe(false);
  });

  it('contract: setFocusedRow clamps to valid range', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 3);

    focus.setFocusedRow(100);
    expect(focus.focusedRowIndex).toBe(2);

    focus.setFocusedRow(-5);
    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: handles empty list gracefully', async () => {
    const { useFocusManagement } = await import('./useFocusManagement.svelte.js');
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 0);

    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(0);

    focus.moveFocus('last');
    expect(focus.focusedRowIndex).toBe(0);
  });
});

describe('useRemoteData', () => {
  function makeServerState() {
    return {
      currentPage: 1,
      itemsPerPage: 10,
      sortColumn: 'name',
      sortDirection: 'asc' as const,
      searchTerm: '',
      activeFilters: [],
      groupByKey: null,
      items: [],
      serverTotalItems: 0,
      loading: false,
      error: null as string | null,
      mode: 'server' as const
    } as unknown as TableState;
  }

  it('contract: query derives from state', async () => {
    const { useRemoteData } = await import('./useRemoteData.svelte.js');
    const state = makeServerState();
    const remote = useRemoteData(state);

    const q = remote.query;
    expect(q.page).toBe(1);
    expect(q.itemsPerPage).toBe(10);
    expect(q.sortColumn).toBe('name');
    expect(q.sortDirection).toBe('asc');
    expect(q.searchTerm).toBe('');
    expect(q.activeFilters).toEqual([]);
    expect(q.groupByKey).toBeNull();
  });

  it('contract: setServerResult updates items and totalItems', async () => {
    const { useRemoteData } = await import('./useRemoteData.svelte.js');
    const state = makeServerState();
    state.loading = true;
    const remote = useRemoteData(state);

    remote.setServerResult({
      items: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      totalItems: 100
    });

    expect(state.items).toHaveLength(2);
    expect(state.serverTotalItems).toBe(100);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('contract: setServerError sets error and clears loading', async () => {
    const { useRemoteData } = await import('./useRemoteData.svelte.js');
    const state = makeServerState();
    state.loading = true;
    const remote = useRemoteData(state);

    remote.setServerError('Network error');

    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
  });

  it('contract: setServerLoading sets loading state', async () => {
    const { useRemoteData } = await import('./useRemoteData.svelte.js');
    const state = makeServerState();
    const remote = useRemoteData(state);

    remote.setServerLoading();
    expect(state.loading).toBe(true);
  });

  it('contract: queryKey is a JSON string for change detection', async () => {
    const { useRemoteData } = await import('./useRemoteData.svelte.js');
    const state = makeServerState();
    const remote = useRemoteData(state);

    const key = remote.queryKey;
    expect(typeof key).toBe('string');
    const parsed = JSON.parse(key);
    expect(parsed.page).toBe(1);
    expect(parsed.sortColumn).toBe('name');
  });

  it('contract: activeFilters in query are a copy (not a reference)', async () => {
    const { useRemoteData } = await import('./useRemoteData.svelte.js');
    const state = makeServerState();
    state.activeFilters = [{ column: 'name', operator: 'contains', value: 'A' }];
    const remote = useRemoteData(state);

    const q = remote.query;
    expect(q.activeFilters).toEqual(state.activeFilters);
    expect(q.activeFilters).not.toBe(state.activeFilters);
  });
});

describe('server mode: concern passthrough', () => {
  it('useFiltering passes through items in server mode', async () => {
    const { useFiltering } = await import('./useFiltering.svelte.js');
    const state = {
      mode: 'server',
      items: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      columns: [{ accessor: 'name', title: 'Name' }],
      searchTerm: 'xyz', // Would normally filter everything out
      activeFilters: [{ column: 'name', operator: 'equals', value: 'Nobody' }],
      currentPage: 1
    } as unknown as TableState;

    const filtering = useFiltering(state);
    // In server mode, items pass through unchanged despite search/filter
    expect(filtering.filteredItems).toHaveLength(2);
  });

  it('useSorting passes through items in server mode', async () => {
    const { useSorting } = await import('./useSorting.svelte.js');
    const state = {
      mode: 'server',
      sortColumn: 'name',
      sortDirection: 'desc' as const
    } as unknown as TableState;

    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];

    const sorting = useSorting(state, () => items);
    // In server mode, items pass through unchanged (server sorted)
    expect(sorting.sortedItems).toBe(items); // Same reference = no copy/sort
  });

  it('usePagination uses serverTotalItems in server mode', async () => {
    const { usePagination } = await import('./usePagination.svelte.js');
    const state = {
      mode: 'server',
      serverTotalItems: 500,
      currentPage: 3,
      itemsPerPage: 25,
      groupByKey: null
    } as unknown as TableState;

    const items = [{ id: 1 }, { id: 2 }]; // Only current page's items
    const pagination = usePagination(
      state,
      () => items,
      () => items
    );

    expect(pagination.totalItems).toBe(500);
    expect(pagination.totalPages).toBe(20); // 500/25
    expect(pagination.paginatedItems).toBe(items); // Passthrough
  });
});

describe('useLiveUpdates', () => {
  function makeLiveState() {
    return {
      items: [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 }
      ],
      selectionMode: 'none' as const,
      selectedIds: new Set<string | number>()
    } as unknown as TableState;
  }

  it('contract: pushInsert adds item to pending', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    expect(live.counts.inserts).toBe(1);
    expect(live.hasPending).toBe(true);
  });

  it('contract: pushInsert deduplicates by id', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.pushInsert({ id: 4, name: 'Diana Updated' });
    expect(live.counts.inserts).toBe(1);
    expect(live.pendingInserts[0].name).toBe('Diana Updated');
  });

  it('contract: pushUpdate adds to pending updates', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushUpdate(1, { name: 'Alice Updated' });
    expect(live.counts.updates).toBe(1);
  });

  it('contract: pushUpdate merges changes for same id', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushUpdate(1, { name: 'Alice v2' });
    live.pushUpdate(1, { age: 31 });
    expect(live.counts.updates).toBe(1);
    expect(live.pendingUpdates[0].changes).toEqual({ name: 'Alice v2', age: 31 });
  });

  it('contract: pushDelete adds to pending deletes', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushDelete(2);
    expect(live.counts.deletes).toBe(1);
    expect(live.isPendingDelete(2)).toBe(true);
  });

  it('contract: pushDelete of pending insert removes from both', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    expect(live.counts.inserts).toBe(1);

    live.pushDelete(4);
    // Should cancel each other out
    expect(live.counts.inserts).toBe(0);
    expect(live.counts.deletes).toBe(0);
  });

  it('contract: applyInserts merges into state.items', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.applyInserts();

    expect(state.items).toHaveLength(4);
    expect(state.items[3].name).toBe('Diana');
    expect(live.counts.inserts).toBe(0);
  });

  it('contract: applyUpdates modifies existing items', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushUpdate(1, { name: 'Alice Updated', age: 31 });
    live.applyUpdates();

    expect(state.items[0].name).toBe('Alice Updated');
    expect(state.items[0].age).toBe(31);
    expect(live.counts.updates).toBe(0);
  });

  it('contract: applyDeletes removes items from state', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushDelete(2);
    live.applyDeletes();

    expect(state.items).toHaveLength(2);
    expect(state.items.find((i) => i.id === 2)).toBeUndefined();
    expect(live.counts.deletes).toBe(0);
  });

  it('contract: applyDeletes cleans up selection', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    state.selectionMode = 'multi';
    state.selectedIds = new Set([1, 2, 3]);
    const live = useLiveUpdates(state);

    live.pushDelete(2);
    live.applyDeletes();

    expect(state.selectedIds.has(2)).toBe(false);
    expect(state.selectedIds.has(1)).toBe(true);
    expect(state.selectedIds.has(3)).toBe(true);
  });

  it('contract: applyAll applies all pending changes', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.pushUpdate(1, { name: 'Alice Updated' });
    live.pushDelete(3);

    live.applyAll();

    expect(state.items).toHaveLength(3); // 3 original - 1 deleted + 1 inserted
    expect(state.items.find((i) => i.id === 3)).toBeUndefined();
    expect(state.items.find((i) => i.id === 1)?.name).toBe('Alice Updated');
    expect(state.items.find((i) => i.id === 4)?.name).toBe('Diana');
    expect(live.hasPending).toBe(false);
  });

  it('contract: dismissAll clears all pending without applying', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.pushUpdate(1, { name: 'Updated' });
    live.pushDelete(2);

    live.dismissAll();

    expect(live.hasPending).toBe(false);
    expect(state.items).toHaveLength(3); // Unchanged
    expect(state.items[0].name).toBe('Alice'); // Not updated
  });

  it('contract: counts reflects all pending types', async () => {
    const { useLiveUpdates } = await import('./useLiveUpdates.svelte.js');
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.pushInsert({ id: 5, name: 'Eve' });
    live.pushUpdate(1, { name: 'Updated' });
    live.pushDelete(3);

    expect(live.counts).toEqual({
      inserts: 2,
      updates: 1,
      deletes: 1,
      total: 4
    });
  });
});

describe('useColumnOrder', () => {
  const columns = [
    { accessor: 'name', title: 'Name' },
    { accessor: 'age', title: 'Age' },
    { accessor: 'email', title: 'Email' },
    { accessor: 'role', title: 'Role' }
  ] as Column[];

  it('contract: reorderColumn moves column forward', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(0, 2);

    expect(co.columnOrder).toEqual(['age', 'email', 'name', 'role']);
  });

  it('contract: reorderColumn moves column backward', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(3, 1);

    expect(co.columnOrder).toEqual(['name', 'role', 'age', 'email']);
  });

  it('contract: reorderColumn same index is no-op', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(1, 1);

    expect(co.columnOrder).toEqual(['name', 'age', 'email', 'role']);
  });

  it('contract: resetColumnOrder clears custom order', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(0, 3);
    expect(co.columnOrder[0]).not.toBe('name');

    co.resetColumnOrder();
    expect(co.columnOrder).toEqual([]);
  });

  it('contract: getColumnIndex returns correct index', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    expect(co.getColumnIndex('name')).toBe(0);
    expect(co.getColumnIndex('role')).toBe(3);
    expect(co.getColumnIndex('nonexistent')).toBe(-1);
  });

  it('contract: reorderColumn auto-initializes order if empty', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    // Don't call initOrder, reorderColumn should auto-init
    co.reorderColumn(0, 2);

    expect(co.columnOrder.length).toBe(4);
  });
});

describe('useSelection', () => {
  function makeState(mode: 'none' | 'single' | 'multi' = 'multi') {
    return {
      items: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ],
      selectionMode: mode,
      selectedIds: new Set<string | number>()
    } as unknown as TableState;
  }

  it('contract: selectItem adds id in multi mode', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.selectItem(1);
    expect(state.selectedIds.has(1)).toBe(true);

    sel.selectItem(2);
    expect(state.selectedIds.has(1)).toBe(true);
    expect(state.selectedIds.has(2)).toBe(true);
  });

  it('contract: selectItem replaces in single mode', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('single');
    const sel = useSelection(state, () => state.items);

    sel.selectItem(1);
    expect(state.selectedIds.has(1)).toBe(true);

    sel.selectItem(2);
    expect(state.selectedIds.has(1)).toBe(false);
    expect(state.selectedIds.has(2)).toBe(true);
    expect(state.selectedIds.size).toBe(1);
  });

  it('contract: selectItem is no-op in none mode', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('none');
    const sel = useSelection(state, () => state.items);

    sel.selectItem(1);
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: deselectItem removes id', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    state.selectedIds = new Set([1, 2]);
    const sel = useSelection(state, () => state.items);

    sel.deselectItem(1);
    expect(state.selectedIds.has(1)).toBe(false);
    expect(state.selectedIds.has(2)).toBe(true);
  });

  it('contract: toggleItem toggles selection', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.toggleItem(1);
    expect(state.selectedIds.has(1)).toBe(true);

    sel.toggleItem(1);
    expect(state.selectedIds.has(1)).toBe(false);
  });

  it('contract: selectAll selects all filtered items', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.selectAll();
    expect(state.selectedIds.size).toBe(3);
    expect(state.selectedIds.has(1)).toBe(true);
    expect(state.selectedIds.has(2)).toBe(true);
    expect(state.selectedIds.has(3)).toBe(true);
  });

  it('contract: selectAll is no-op in single mode', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('single');
    const sel = useSelection(state, () => state.items);

    sel.selectAll();
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: deselectAll clears all', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    state.selectedIds = new Set([1, 2, 3]);
    const sel = useSelection(state, () => state.items);

    sel.deselectAll();
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: isSelected checks membership', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    state.selectedIds = new Set([2]);
    const sel = useSelection(state, () => state.items);

    expect(sel.isSelected(1)).toBe(false);
    expect(sel.isSelected(2)).toBe(true);
    expect(sel.isSelected(3)).toBe(false);
  });

  it('contract: setSelectedIds replaces the set', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    state.selectedIds = new Set([1]);
    const sel = useSelection(state, () => state.items);

    sel.setSelectedIds([2, 3]);
    expect(state.selectedIds.has(1)).toBe(false);
    expect(state.selectedIds.has(2)).toBe(true);
    expect(state.selectedIds.has(3)).toBe(true);
  });

  it('contract: toggleAll selects all when none selected', async () => {
    const { useSelection } = await import('./useSelection.svelte.js');
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.toggleAll();
    expect(state.selectedIds.size).toBe(3);
  });
});

describe('useColumnVisibility', () => {
  const columns = [
    { accessor: 'name', title: 'Name' },
    { accessor: 'age', title: 'Age' },
    { accessor: 'email', title: 'Email' }
  ] as Column[];

  it('contract: hideColumn removes from state.columns', async () => {
    const { useColumnVisibility } = await import('./useColumnVisibility.svelte.js');
    const state = { columns: [] } as unknown as TableState;
    const cv = useColumnVisibility(state);

    cv.setColumns(columns);
    cv.hideColumn('age');

    expect(state.columns.map((c) => c.accessor)).toEqual(['name', 'email']);
    expect(cv.hiddenColumnKeys.has('age')).toBe(true);
  });

  it('contract: showColumn restores a previously hidden column', async () => {
    const { useColumnVisibility } = await import('./useColumnVisibility.svelte.js');
    const state = { columns: [] } as unknown as TableState;
    const cv = useColumnVisibility(state);

    cv.setColumns(columns);
    cv.hideColumn('age');
    cv.showColumn('age');

    expect(state.columns.map((c) => c.accessor)).toEqual(['name', 'age', 'email']);
    expect(cv.hiddenColumnKeys.has('age')).toBe(false);
  });

  it('contract: setHiddenIds seeds the hidden-set before setColumns', async () => {
    const { useColumnVisibility } = await import('./useColumnVisibility.svelte.js');
    const state = { columns: [] } as unknown as TableState;
    const cv = useColumnVisibility(state);

    // Persisted snapshot lands first (hydrate phase).
    cv.setHiddenIds(['age', 'email']);
    expect(cv.hiddenColumnKeys.has('age')).toBe(true);
    expect(cv.hiddenColumnKeys.has('email')).toBe(true);

    // Then the consumer's columns prop reaches the store.
    cv.setColumns(columns);

    // state.columns must be filtered by the persisted hidden ids.
    expect(state.columns.map((c) => c.accessor)).toEqual(['name']);
  });

  it('contract: showAllColumns reveals persisted-hidden columns', async () => {
    // Guards the enableColumnVisibility={false} recovery path: TableProvider
    // calls showAllColumns() when the feature is off so a column hidden in a
    // prior (persisted) session is never stranded without a restore UI.
    const { useColumnVisibility } = await import('./useColumnVisibility.svelte.js');
    const state = { columns: [] } as unknown as TableState;
    const cv = useColumnVisibility(state);

    cv.setHiddenIds(['age', 'email']);
    cv.setColumns(columns);
    expect(state.columns.map((c) => c.accessor)).toEqual(['name']);

    cv.showAllColumns();

    expect(state.columns.map((c) => c.accessor)).toEqual(['name', 'age', 'email']);
    expect(cv.hiddenColumnKeys.size).toBe(0);
  });

  it('contract: setHiddenIds with empty array clears the hidden-set', async () => {
    const { useColumnVisibility } = await import('./useColumnVisibility.svelte.js');
    const state = { columns: [] } as unknown as TableState;
    const cv = useColumnVisibility(state);

    cv.setColumns(columns);
    cv.hideColumn('age');
    cv.setHiddenIds([]);

    expect(cv.hiddenColumnKeys.size).toBe(0);
  });

  it('contract: showAllColumns clears hidden-set and restores state.columns', async () => {
    const { useColumnVisibility } = await import('./useColumnVisibility.svelte.js');
    const state = { columns: [] } as unknown as TableState;
    const cv = useColumnVisibility(state);

    cv.setColumns(columns);
    cv.hideColumn('age');
    cv.hideColumn('email');
    cv.showAllColumns();

    expect(state.columns.map((c) => c.accessor)).toEqual(['name', 'age', 'email']);
    expect(cv.hiddenColumnKeys.size).toBe(0);
  });
});

describe('useColumnOrder — applyOrder', () => {
  const columns = [
    { accessor: 'name', title: 'Name' },
    { accessor: 'age', title: 'Age' },
    { accessor: 'email', title: 'Email' },
    { accessor: 'role', title: 'Role' }
  ] as Column[];

  it('contract: applyOrder seeds the persisted order', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.applyOrder(['role', 'name', 'email', 'age']);

    expect(co.columnOrder).toEqual(['role', 'name', 'email', 'age']);
    expect(co.orderedColumns.map((c) => c.accessor)).toEqual(['role', 'name', 'email', 'age']);
  });

  it('contract: applyOrder gracefully handles ids that no longer exist', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    // 'phone' is in the snapshot but not in current columns — should be skipped.
    co.applyOrder(['role', 'phone', 'name']);

    expect(co.orderedColumns.map((c) => c.accessor)).toEqual([
      'role',
      'name',
      'age',
      'email' // unknown remainders appended in their natural order
    ]);
  });

  it('contract: applyOrder with empty array resets to natural order', async () => {
    const { useColumnOrder } = await import('./useColumnOrder.svelte.js');
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.applyOrder(['role', 'email']);
    co.applyOrder([]);

    expect(co.orderedColumns).toBe(state.columns);
  });
});

describe('usePersistence — surface contract', () => {
  // The persistence concern reads/writes through `createPersistentState`
  // from @urbicon-ui/blocks. That helper is a no-op in Node (where these
  // tests run — `typeof window === 'undefined'`), so we cannot assert
  // round-tripped values here. We do, however, verify that:
  //   1. without a `persistenceConfig` the concern is a pure no-op,
  //   2. with one, every `sync*` method is exposed,
  //   3. neither shape mutates `state` on construction.

  function makeState(): TableState {
    return {
      searchTerm: '',
      activeFilters: [],
      groupByKey: null,
      summaryConfigs: [],
      sortColumn: '',
      sortDirection: 'asc',
      showSummary: false,
      selectedIds: new Set<string | number>()
    } as unknown as TableState;
  }

  it('contract: without config exposes sync* as no-ops', async () => {
    const { usePersistence } = await import('./usePersistence.svelte.js');
    const state = makeState();

    const persistence = usePersistence(state);

    // Calling any sync method should not throw.
    persistence.syncFilters();
    persistence.syncSearch();
    persistence.syncGroupByKey();
    persistence.syncSummaryConfigs();
    persistence.syncSortState();
    persistence.syncHiddenColumns(['age']);
    persistence.syncColumnOrder(['name', 'age']);
    persistence.syncSelection();

    // Initial hidden / order are empty when not opted in.
    expect(persistence.initialHiddenColumnIds).toEqual([]);
    expect(persistence.initialColumnOrder).toEqual([]);
  });

  it('contract: with config exposes the new sort/visibility/order sync methods', async () => {
    const { usePersistence } = await import('./usePersistence.svelte.js');
    const state = makeState();

    const persistence = usePersistence(state, { tableId: 'test-table' });

    expect(typeof persistence.syncSortState).toBe('function');
    expect(typeof persistence.syncHiddenColumns).toBe('function');
    expect(typeof persistence.syncColumnOrder).toBe('function');
    expect(typeof persistence.syncSelection).toBe('function');
    expect(typeof persistence.clearPersistedSortState).toBe('function');
    expect(typeof persistence.clearPersistedHiddenColumns).toBe('function');
    expect(typeof persistence.clearPersistedColumnOrder).toBe('function');
    expect(typeof persistence.clearPersistedSelection).toBe('function');
  });

  it('contract: selection persistence is opt-in and never throws either way', async () => {
    const { usePersistence } = await import('./usePersistence.svelte.js');
    const state = makeState();
    state.selectedIds.add('row-1');

    // Default (no persistSelection flag): syncSelection is a harmless no-op —
    // the persistent store is never created, so the shared set is left alone.
    const off = usePersistence(state, { tableId: 'sel-off' });
    expect(() => off.syncSelection()).not.toThrow();

    // Opt-in: construction hydrates the shared set (a Node no-op here) and
    // syncSelection engages without throwing. Round-tripping needs a DOM — see
    // the block comment above.
    const on = usePersistence(state, { tableId: 'sel-on', persistSelection: true });
    expect(() => on.syncSelection()).not.toThrow();
    expect(typeof on.clearPersistedSelection).toBe('function');
  });

  it('contract: clearAllPersistentData covers every axis without throwing', async () => {
    const { usePersistence } = await import('./usePersistence.svelte.js');
    const state = makeState();

    const persistence = usePersistence(state, { tableId: 'test-table' });
    expect(() => persistence.clearAllPersistentData()).not.toThrow();
    expect(() => persistence.forceSavePersistentData()).not.toThrow();
  });
});
