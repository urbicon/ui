import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Column, Filter, TableItem } from '$lib/types/tableTypes';
import type { TableView, TableViewSnapshot } from '$lib/view/view.svelte';
import type { SummaryConfig } from '../TableStore.svelte';
import type { TableState } from './types';
import { useColumnOrder } from './useColumnOrder.svelte.js';
import { useColumnVisibility } from './useColumnVisibility.svelte.js';
import { useExpansion } from './useExpansion.svelte.js';
import { useFiltering } from './useFiltering.svelte.js';
import { useFocusManagement } from './useFocusManagement.svelte.js';
import { useGrouping } from './useGrouping.svelte.js';
import { useLiveUpdates } from './useLiveUpdates.svelte.js';
import { usePagination } from './usePagination.svelte.js';
import { usePrefs } from './usePrefs.svelte.js';
import { useRemoteData } from './useRemoteData.svelte.js';
import { useSearch } from './useSearch.svelte.js';
import { useSelection } from './useSelection.svelte.js';
import { useSorting } from './useSorting.svelte.js';
import { useSummary } from './useSummary.svelte.js';

// Some concerns DEV-warn on legitimate test input (e.g. a groupBy write on a
// virtualized state). Correct in production, noise here.
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

/**
 * A minimal stand-in for the view object the axis-owning concerns now take
 * (#166). These tests deliberately run outside a Svelte runtime — they pin the
 * concerns' *contracts*, not their reactivity — so a plain object with the six
 * axes is exactly the surface under test. `createTableView` would work too and
 * would drag in the module-scope SSR warning for nothing.
 */
function fakeView(overrides: Partial<TableViewSnapshot> = {}): TableView {
  return {
    search: '',
    sort: null,
    page: 1,
    pageSize: 10,
    filters: [],
    groupBy: null,
    ...overrides
  } as unknown as TableView;
}

// Concern tests for pure logic (non-reactive parts).
// Reactive $derived chains are tested indirectly via the existing TableStore tests.
// These tests validate the concern API contracts.

describe('useSearch', () => {
  // Search concern mutates state.searchTerm and state.currentPage.
  // Since $state requires Svelte runtime, we test the contract:
  // setSearch(term) should update searchTerm and reset page.

  it('contract: setSearch updates term and resets page', () => {
    const view = fakeView({ page: 5 });

    const search = useSearch(view);
    search.setSearch('hello');

    expect(view.search).toBe('hello');
    expect(view.page).toBe(1);
  });
});

describe('useExpansion', () => {
  it('contract: toggleExpand in single mode', () => {
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

  it('contract: toggleExpand in multi mode', () => {
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

  it('contract: isItemExpanded reflects state', () => {
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
  it('contract: handleSort cycles through asc → desc → off', () => {
    const view = fakeView();
    const sorting = useSorting({} as TableState, view, () => []);

    // First click: set column, asc
    sorting.handleSort('name');
    expect(view.sort).toEqual({ column: 'name', direction: 'asc' });

    // Second click: same column, desc
    sorting.handleSort('name');
    expect(view.sort).toEqual({ column: 'name', direction: 'desc' });

    // Third click: unsorted — `null`, not a column-less direction.
    sorting.handleSort('name');
    expect(view.sort).toBeNull();
  });

  it('contract: clicking a different column resets to asc', () => {
    const view = fakeView({ sort: { column: 'name', direction: 'desc' } });
    const sorting = useSorting({} as TableState, view, () => []);

    sorting.handleSort('age');
    expect(view.sort).toEqual({ column: 'age', direction: 'asc' });
  });
});

describe('useGrouping', () => {
  it('contract: setGroupBy resets collapse state and page', () => {
    const state = {
      collapsedGroups: new Set(['Engineering']),
      allGroupsExpanded: false,
      groupOrder: []
    } as unknown as TableState;
    const view = fakeView({ page: 3 });

    const grouping = useGrouping(state, view, () => []);

    grouping.setGroupBy('department');
    expect(view.groupBy).toBe('department');
    expect(state.collapsedGroups.size).toBe(0);
    expect(state.allGroupsExpanded).toBe(true);
    expect(view.page).toBe(1);
  });

  it('contract: setGroupBy(null) clears grouping', () => {
    const state = {
      collapsedGroups: new Set<string>(),
      allGroupsExpanded: true,
      groupOrder: []
    } as unknown as TableState;
    const view = fakeView({ groupBy: 'department' });

    const grouping = useGrouping(state, view, () => []);

    grouping.setGroupBy(null);
    expect(view.groupBy).toBeNull();
  });

  it('contract: setGroupBy is inert while virtualized', () => {
    const state = {
      collapsedGroups: new Set<string>(),
      allGroupsExpanded: true,
      groupOrder: [],
      virtualized: true
    } as unknown as TableState;
    const view = fakeView({ page: 2 });

    const grouping = useGrouping(state, view, () => []);

    // Grouped virtualization is not implemented — letting the key through
    // would deactivate virtualization and render the full item set.
    grouping.setGroupBy('department');
    expect(view.groupBy).toBeNull();
    expect(view.page).toBe(2);
  });

  it('contract: clearing grouping stays allowed while virtualized', () => {
    // A key can already be in place (persistence/seed) when the mode is
    // switched on — the provider clears it through this same path.
    const state = {
      collapsedGroups: new Set<string>(),
      allGroupsExpanded: true,
      groupOrder: [],
      virtualized: true
    } as unknown as TableState;
    const view = fakeView({ groupBy: 'department' });

    const grouping = useGrouping(state, view, () => []);

    grouping.setGroupBy(null);
    expect(view.groupBy).toBeNull();
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

  it('search matches a function accessor', () => {
    const state = {
      mode: 'client',
      items,
      columns
    } as unknown as TableState;

    const filtering = useFiltering(state, fakeView({ search: 'bob' }));
    expect(filtering.filteredItems).toHaveLength(1);
    expect((filtering.filteredItems[0] as Row).id).toBe(2);
  });

  it('sort uses a function accessor', () => {
    const state = {
      mode: 'client',
      columns
    } as unknown as TableState;

    const view = fakeView({ sort: { column: 'userName', direction: 'asc' } });
    const sorting = useSorting(state, view, () => items);
    expect(sorting.sortedItems.map((r) => (r as Row).id)).toEqual([1, 2, 3]);
  });

  it('group buckets rows by a function-accessor value', () => {
    const state = {
      mode: 'client',
      columns,
      effectiveGroupBy: 'userName',
      collapsedGroups: new Set<string>(),
      allGroupsExpanded: true,
      groupOrder: []
    } as unknown as TableState;

    const grouping = useGrouping(state, fakeView({ groupBy: 'userName' }), () => items);
    expect(Object.keys(grouping.grouped).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('synthetic-only sort id leaves order untouched (no scrambling)', () => {
    const syntheticCols: Column<Row>[] = [{ id: 'actions', title: '' }];
    const state = {
      mode: 'client',
      columns: syntheticCols
    } as unknown as TableState;

    const view = fakeView({ sort: { column: 'actions', direction: 'asc' } });
    const sorting = useSorting(state, view, () => items);
    expect(sorting.sortedItems.map((r) => (r as Row).id)).toEqual([1, 2, 3]);
  });
});

describe('useFiltering', () => {
  it('contract: addFilter adds to activeFilters and resets page', () => {
    const state = { items: [], columns: [] } as unknown as TableState;
    const view = fakeView({ page: 3 });

    const filtering = useFiltering(state, view);

    filtering.addFilter({ column: 'name', operator: 'contains', value: 'Alice' });
    expect(view.filters).toHaveLength(1);
    expect(view.page).toBe(1);
  });

  it('contract: removeFilter removes by index', () => {
    const state = { items: [], columns: [] } as unknown as TableState;
    const view = fakeView({
      filters: [
        { column: 'name', operator: 'contains', value: 'Alice' },
        { column: 'age', operator: 'greaterThan', value: '25' }
      ]
    });

    const filtering = useFiltering(state, view);

    filtering.removeFilter(0);
    expect(view.filters).toHaveLength(1);
    expect(view.filters[0].column).toBe('age');
  });

  it('contract: clearAllFilters empties filters', () => {
    const state = { items: [], columns: [] } as unknown as TableState;
    const view = fakeView({
      filters: [{ column: 'name', operator: 'contains', value: 'Alice' }],
      page: 2
    });

    const filtering = useFiltering(state, view);

    filtering.clearAllFilters();
    expect(view.filters).toHaveLength(0);
    expect(view.page).toBe(1);
  });

  it('contract: hasFilterForColumn returns correct results', () => {
    const state = { items: [], columns: [] } as unknown as TableState;
    const view = fakeView({ filters: [{ column: 'name', operator: 'contains', value: 'Alice' }] });

    const filtering = useFiltering(state, view);

    expect(filtering.hasFilterForColumn('name')).toBe(true);
    expect(filtering.hasFilterForColumn('age')).toBe(false);
    expect(filtering.hasFilterForColumn('name', 'contains')).toBe(true);
    expect(filtering.hasFilterForColumn('name', 'equals')).toBe(false);
  });
});

// `greaterThan`/`lessThan` are offered by the SmartFilterBar as "after"/"before"
// for `dataType: 'date'` columns, with an `<input type="date">` that emits
// `YYYY-MM-DD`. Before the date path existed, `Number('2021-03-15')` was NaN and
// every such comparison was silently false. These tests pin both paths.
describe('useFiltering — greaterThan / lessThan', () => {
  type Row = { id: number; amount: number; iso: string; when: Date; label: string };

  const items: Row[] = [
    {
      id: 1,
      amount: 10,
      iso: '2021-03-14',
      when: new Date('2021-03-14T12:00:00Z'),
      label: 'alpha'
    },
    {
      id: 2,
      amount: 20,
      iso: '2021-03-15T09:00:00Z',
      when: new Date('2021-03-15T09:00:00Z'),
      label: 'beta'
    },
    {
      id: 3,
      amount: 30,
      iso: '2021-03-16',
      when: new Date('2021-03-16T00:00:00Z'),
      label: 'gamma'
    }
  ];

  const columns: Column<Row>[] = [
    { accessor: 'amount', title: 'Amount', dataType: 'number' },
    { accessor: 'iso', title: 'ISO', dataType: 'date' },
    { accessor: 'when', title: 'When', dataType: 'date' },
    { accessor: 'label', title: 'Label' }
  ];

  const filterIds = (activeFilters: Filter[]): number[] => {
    const state = {
      mode: 'client',
      items,
      columns
    } as unknown as TableState;

    return useFiltering(state, fakeView({ filters: activeFilters })).filteredItems.map(
      (r) => (r as Row).id
    );
  };

  it('numeric comparison is unchanged', () => {
    expect(filterIds([{ column: 'amount', operator: 'greaterThan', value: '15' }])).toEqual([2, 3]);
    expect(filterIds([{ column: 'amount', operator: 'lessThan', value: '30' }])).toEqual([1, 2]);
  });

  it('compares ISO date strings with after/before', () => {
    expect(filterIds([{ column: 'iso', operator: 'greaterThan', value: '2021-03-14' }])).toEqual([
      2, 3
    ]);
    expect(filterIds([{ column: 'iso', operator: 'lessThan', value: '2021-03-15' }])).toEqual([1]);
  });

  it('compares Date instances with after/before', () => {
    expect(filterIds([{ column: 'when', operator: 'greaterThan', value: '2021-03-14' }])).toEqual([
      2, 3
    ]);
    expect(filterIds([{ column: 'when', operator: 'lessThan', value: '2021-03-16' }])).toEqual([
      1, 2
    ]);
  });

  it('a bare filter date compares on UTC day boundaries, not on the instant', () => {
    // Item 2 sits at 09:00Z on 2021-03-15 — "after 2021-03-15" means the whole
    // day is excluded, "before 2021-03-15" excludes it as well.
    expect(filterIds([{ column: 'iso', operator: 'greaterThan', value: '2021-03-15' }])).toEqual([
      3
    ]);
    expect(filterIds([{ column: 'when', operator: 'greaterThan', value: '2021-03-15' }])).toEqual([
      3
    ]);
    expect(filterIds([{ column: 'iso', operator: 'lessThan', value: '2021-03-15' }])).toEqual([1]);
  });

  it('a filter value with a time of day compares instants strictly', () => {
    expect(
      filterIds([{ column: 'when', operator: 'greaterThan', value: '2021-03-15T08:00:00Z' }])
    ).toEqual([2, 3]);
    expect(
      filterIds([{ column: 'when', operator: 'greaterThan', value: '2021-03-15T10:00:00Z' }])
    ).toEqual([3]);
  });

  it('an unparseable filter value matches nothing', () => {
    expect(filterIds([{ column: 'iso', operator: 'greaterThan', value: 'yesterday' }])).toEqual([]);
    expect(filterIds([{ column: 'when', operator: 'lessThan', value: '2021-13-45' }])).toEqual([]);
    expect(filterIds([{ column: 'iso', operator: 'greaterThan', value: '15.03.2021' }])).toEqual(
      []
    );
  });

  // Changed 2026-07-25: an empty value used to mean "match nothing" here and
  // "> 0" on a numeric column (`Number('')` is 0), while the text operators let
  // everything through (`''.includes('')`). All three now agree that a filter
  // without a value is not an assertion.
  it('an empty filter value is inert on every column type', () => {
    expect(filterIds([{ column: 'iso', operator: 'greaterThan', value: '' }])).toEqual([1, 2, 3]);
    expect(filterIds([{ column: 'when', operator: 'lessThan', value: '   ' }])).toEqual([1, 2, 3]);
    // The numeric path is the one that used to silently filter: every amount
    // here is > 0, so the old behaviour was invisible until a row hit 0.
    expect(filterIds([{ column: 'amount', operator: 'greaterThan', value: '' }])).toEqual([
      1, 2, 3
    ]);
    expect(filterIds([{ column: 'label', operator: 'contains', value: '' }])).toEqual([1, 2, 3]);
  });

  it('non-date text stays a non-match instead of being date-parsed', () => {
    expect(filterIds([{ column: 'label', operator: 'greaterThan', value: 'alpha' }])).toEqual([]);
  });

  it('missing values match nothing', () => {
    const sparse = [{ id: 1 }, { id: 2, iso: '2021-03-16' }];
    const state = {
      mode: 'client',
      items: sparse,
      columns: [{ accessor: 'iso', title: 'ISO', dataType: 'date' }] as Column<TableItem>[],
      searchTerm: ''
    } as unknown as TableState;
    const view = fakeView({
      filters: [{ column: 'iso', operator: 'greaterThan', value: '2021-03-15' }]
    });

    expect(useFiltering(state, view).filteredItems.map((r) => (r as { id: number }).id)).toEqual([
      2
    ]);
  });

  // `equals` is what the filter menu labels "on date" for a `dataType: 'date'`
  // column. It used to compare lowercased strings, so it only matched a column
  // whose accessor returned the exact `YYYY-MM-DD` text.
  describe('equals on a date column', () => {
    it('matches a Date instance and a timestamped ISO string by day', () => {
      // `when` holds Date objects — String(date) is "Mon Mar 15 2021 …", which
      // could never equal "2021-03-15".
      expect(filterIds([{ column: 'when', operator: 'equals', value: '2021-03-15' }])).toEqual([2]);
      // `iso` row 2 is '2021-03-15T09:00:00Z' — a bare calendar filter value
      // matches the whole UTC day.
      expect(filterIds([{ column: 'iso', operator: 'equals', value: '2021-03-15' }])).toEqual([2]);
    });

    it('still matches a plain date-only string column', () => {
      expect(filterIds([{ column: 'iso', operator: 'equals', value: '2021-03-16' }])).toEqual([3]);
    });

    it('compares instants when the filter value carries a time', () => {
      expect(
        filterIds([{ column: 'when', operator: 'equals', value: '2021-03-15T09:00:00Z' }])
      ).toEqual([2]);
      expect(
        filterIds([{ column: 'when', operator: 'equals', value: '2021-03-15T10:00:00Z' }])
      ).toEqual([]);
    });

    it('leaves string columns on byte equality', () => {
      expect(filterIds([{ column: 'label', operator: 'equals', value: 'beta' }])).toEqual([2]);
      expect(filterIds([{ column: 'label', operator: 'equals', value: 'bet' }])).toEqual([]);
    });

    it('matches nothing for an unparseable date value', () => {
      expect(filterIds([{ column: 'when', operator: 'equals', value: '15.03.2021' }])).toEqual([]);
    });
  });
});

describe('useSummary', () => {
  it('contract: getFormattedSummaryValue formats by type', () => {
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

  it('contract: getFormattedSummaryValue uses custom formatter', () => {
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

  it('contract: addSummaryConfig auto-enables summary', () => {
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

  it('contract: removeSummaryConfig auto-disables when empty', () => {
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
  it('contract: initial focusedRowIndex is 0', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: moveFocus down increments index', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(1);

    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(2);
  });

  it('contract: moveFocus up decrements index', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.setFocusedRow(3);
    focus.moveFocus('up');
    expect(focus.focusedRowIndex).toBe(2);
  });

  it('contract: moveFocus respects boundaries', () => {
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

  it('contract: moveFocus first/last jumps to boundaries', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 10);

    focus.moveFocus('last');
    expect(focus.focusedRowIndex).toBe(9);

    focus.moveFocus('first');
    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: resetFocus returns to 0', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.setFocusedRow(4);
    expect(focus.focusedRowIndex).toBe(4);

    focus.resetFocus();
    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: isFocusedRow checks correctly', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 5);

    focus.setFocusedRow(2);
    expect(focus.isFocusedRow(0)).toBe(false);
    expect(focus.isFocusedRow(2)).toBe(true);
    expect(focus.isFocusedRow(4)).toBe(false);
  });

  it('contract: setFocusedRow clamps to valid range', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 3);

    focus.setFocusedRow(100);
    expect(focus.focusedRowIndex).toBe(2);

    focus.setFocusedRow(-5);
    expect(focus.focusedRowIndex).toBe(0);
  });

  it('contract: handles empty list gracefully', () => {
    const state = {} as unknown as TableState;
    const focus = useFocusManagement(state, () => 0);

    focus.moveFocus('down');
    expect(focus.focusedRowIndex).toBe(0);

    focus.moveFocus('last');
    expect(focus.focusedRowIndex).toBe(0);
  });
});

describe('useRemoteData', () => {
  // Since the v8 context cut the concern is only the managed fetch's SINK.
  // What the fetch sends is the view snapshot itself (#162), covered where
  // `createManagedFetch` is tested.
  function makeServerState() {
    return {
      items: [],
      serverTotal: 0,
      loading: false,
      error: null as string | null,
      mode: 'server' as const
    } as unknown as TableState;
  }

  it('contract: setServerResult updates items and totalItems', () => {
    const state = makeServerState();
    state.loading = true;
    const remote = useRemoteData(state);

    remote.setServerResult({
      items: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      total: 100
    });

    expect(state.items).toHaveLength(2);
    expect(state.serverTotal).toBe(100);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('contract: setServerError sets error and clears loading', () => {
    const state = makeServerState();
    state.loading = true;
    const remote = useRemoteData(state);

    remote.setServerError('Network error');

    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
  });

  it('contract: setServerLoading sets loading state', () => {
    const state = makeServerState();
    const remote = useRemoteData(state);

    remote.setServerLoading();
    expect(state.loading).toBe(true);
  });
});

describe('server mode: concern passthrough', () => {
  it('useFiltering passes through items in server mode', () => {
    const state = {
      mode: 'server',
      items: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      columns: [{ accessor: 'name', title: 'Name' }]
    } as unknown as TableState;
    // Both would normally filter everything out.
    const view = fakeView({
      search: 'xyz',
      filters: [{ column: 'name', operator: 'equals', value: 'Nobody' }]
    });

    const filtering = useFiltering(state, view);
    // In server mode, items pass through unchanged despite search/filter
    expect(filtering.filteredItems).toHaveLength(2);
  });

  it('useSorting passes through items in server mode', () => {
    const state = { mode: 'server' } as unknown as TableState;
    const view = fakeView({ sort: { column: 'name', direction: 'desc' } });

    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];

    const sorting = useSorting(state, view, () => items);
    // In server mode, items pass through unchanged (server sorted)
    expect(sorting.sortedItems).toBe(items); // Same reference = no copy/sort
  });

  it('usePagination uses serverTotal in server mode', () => {
    const state = {
      mode: 'server',
      serverTotal: 500,
      effectiveGroupBy: null
    } as unknown as TableState;
    const view = fakeView({ page: 3, pageSize: 25 });

    const items = [{ id: 1 }, { id: 2 }]; // Only current page's items
    const pagination = usePagination(
      state,
      view,
      () => items,
      () => items
    );

    expect(pagination.totalItems).toBe(500);
    expect(pagination.totalPages).toBe(20); // 500/25
    expect(pagination.paginatedItems).toBe(items); // Passthrough
  });

  it('effectivePage clamps a currentPage that outlived its range', () => {
    // The state reached by raising a rows-per-page control while on a later
    // page. Before the clamp `paginatedItems` sliced (80, 100) out of 100 rows
    // and rendered an empty body with the data right there.
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const state = { mode: 'client', effectiveGroupBy: null } as unknown as TableState;
    const view = fakeView({ page: 5, pageSize: 100 });

    const pagination = usePagination(
      state,
      view,
      () => items,
      () => items
    );

    expect(pagination.totalPages).toBe(1);
    expect(pagination.effectivePage).toBe(1);
    expect(pagination.paginatedItems).toHaveLength(100);
    // The raw value is left alone on purpose: it is the reader's intent, and
    // the pager, the paging keys and the focus reset all read `effectivePage`.
    expect(view.page).toBe(5);
  });

  it('effectivePage floors an out-of-range seeded page at 1', () => {
    // A page seed of 0 (or a negative) never had a guard of any kind —
    // `viewDefaults={{ page: 0 }}` today, `initialPage={0}` before v8.
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const state = { mode: 'client', effectiveGroupBy: null } as unknown as TableState;
    const view = fakeView({ page: 0, pageSize: 5 });

    const pagination = usePagination(
      state,
      view,
      () => items,
      () => items
    );

    expect(pagination.effectivePage).toBe(1);
    expect(pagination.paginatedItems.map((i) => (i as { id: number }).id)).toEqual([0, 1, 2, 3, 4]);
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

  it('contract: pushInsert adds item to pending', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    expect(live.counts.inserts).toBe(1);
    expect(live.hasPending).toBe(true);
  });

  it('contract: pushInsert deduplicates by id', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.pushInsert({ id: 4, name: 'Diana Updated' });
    expect(live.counts.inserts).toBe(1);
    expect(live.pendingInserts[0].name).toBe('Diana Updated');
  });

  it('contract: pushUpdate adds to pending updates', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushUpdate(1, { name: 'Alice Updated' });
    expect(live.counts.updates).toBe(1);
  });

  it('contract: pushUpdate merges changes for same id', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushUpdate(1, { name: 'Alice v2' });
    live.pushUpdate(1, { age: 31 });
    expect(live.counts.updates).toBe(1);
    expect(live.pendingUpdates[0].changes).toEqual({ name: 'Alice v2', age: 31 });
  });

  it('contract: pushUpdate for a pending insert folds into that insert', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana', age: 28 });
    live.pushUpdate(4, { age: 29 });

    // No separate update entry — applyUpdates runs before applyInserts, so it
    // would be dropped as orphaned and the change lost.
    expect(live.counts.updates).toBe(0);
    expect(live.counts.inserts).toBe(1);
    expect(live.pendingInserts[0]).toEqual({ id: 4, name: 'Diana', age: 29 });
  });

  it('contract: a folded update reaches state.items on apply', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana', age: 28 });
    live.pushUpdate(4, { age: 29, name: 'Diana R.' });
    live.applyAll();

    const inserted = state.items.find((item) => item.id === 4);
    expect(inserted).toMatchObject({ id: 4, name: 'Diana R.', age: 29 });
    expect(live.hasPending).toBe(false);
  });

  it('contract: pushUpdate for an existing row still buffers separately', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.pushUpdate(1, { name: 'Alice Updated' });

    expect(live.counts.inserts).toBe(1);
    expect(live.counts.updates).toBe(1);
    expect(live.pendingInserts[0].name).toBe('Diana');
  });

  it('contract: pushDelete adds to pending deletes', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushDelete(2);
    expect(live.counts.deletes).toBe(1);
    expect(live.isPendingDelete(2)).toBe(true);
  });

  it('contract: pushDelete of pending insert removes from both', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    expect(live.counts.inserts).toBe(1);

    live.pushDelete(4);
    // Should cancel each other out
    expect(live.counts.inserts).toBe(0);
    expect(live.counts.deletes).toBe(0);
  });

  it('contract: applyInserts merges into state.items', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushInsert({ id: 4, name: 'Diana' });
    live.applyInserts();

    expect(state.items).toHaveLength(4);
    expect(state.items[3].name).toBe('Diana');
    expect(live.counts.inserts).toBe(0);
  });

  it('contract: applyUpdates modifies existing items', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushUpdate(1, { name: 'Alice Updated', age: 31 });
    live.applyUpdates();

    expect(state.items[0].name).toBe('Alice Updated');
    expect(state.items[0].age).toBe(31);
    expect(live.counts.updates).toBe(0);
  });

  it('contract: applyDeletes removes items from state', () => {
    const state = makeLiveState();
    const live = useLiveUpdates(state);

    live.pushDelete(2);
    live.applyDeletes();

    expect(state.items).toHaveLength(2);
    expect(state.items.find((i) => i.id === 2)).toBeUndefined();
    expect(live.counts.deletes).toBe(0);
  });

  it('contract: applyDeletes cleans up selection', () => {
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

  it('contract: applyAll applies all pending changes', () => {
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

  it('contract: dismissAll clears all pending without applying', () => {
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

  it('contract: counts reflects all pending types', () => {
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

  it('contract: reorderColumn moves column forward', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(0, 2);

    expect(co.columnOrder).toEqual(['age', 'email', 'name', 'role']);
  });

  it('contract: reorderColumn moves column backward', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(3, 1);

    expect(co.columnOrder).toEqual(['name', 'role', 'age', 'email']);
  });

  it('contract: reorderColumn same index is no-op', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(1, 1);

    expect(co.columnOrder).toEqual(['name', 'age', 'email', 'role']);
  });

  it('contract: resetColumnOrder clears custom order', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    co.reorderColumn(0, 3);
    expect(co.columnOrder[0]).not.toBe('name');

    co.resetColumnOrder();
    expect(co.columnOrder).toEqual([]);
  });

  it('contract: getColumnIndex returns correct index', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.initOrder(columns as Column[]);
    expect(co.getColumnIndex('name')).toBe(0);
    expect(co.getColumnIndex('role')).toBe(3);
    expect(co.getColumnIndex('nonexistent')).toBe(-1);
  });

  it('contract: reorderColumn auto-initializes order if empty', () => {
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

  it('contract: selectItem adds id in multi mode', () => {
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.selectItem(1);
    expect(state.selectedIds.has(1)).toBe(true);

    sel.selectItem(2);
    expect(state.selectedIds.has(1)).toBe(true);
    expect(state.selectedIds.has(2)).toBe(true);
  });

  it('contract: selectItem replaces in single mode', () => {
    const state = makeState('single');
    const sel = useSelection(state, () => state.items);

    sel.selectItem(1);
    expect(state.selectedIds.has(1)).toBe(true);

    sel.selectItem(2);
    expect(state.selectedIds.has(1)).toBe(false);
    expect(state.selectedIds.has(2)).toBe(true);
    expect(state.selectedIds.size).toBe(1);
  });

  it('contract: selectItem is no-op in none mode', () => {
    const state = makeState('none');
    const sel = useSelection(state, () => state.items);

    sel.selectItem(1);
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: deselectItem removes id', () => {
    const state = makeState('multi');
    state.selectedIds = new Set([1, 2]);
    const sel = useSelection(state, () => state.items);

    sel.deselectItem(1);
    expect(state.selectedIds.has(1)).toBe(false);
    expect(state.selectedIds.has(2)).toBe(true);
  });

  it('contract: toggleItem toggles selection', () => {
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.toggleItem(1);
    expect(state.selectedIds.has(1)).toBe(true);

    sel.toggleItem(1);
    expect(state.selectedIds.has(1)).toBe(false);
  });

  it('contract: selectAll selects all filtered items', () => {
    const state = makeState('multi');
    const sel = useSelection(state, () => state.items);

    sel.selectAll();
    expect(state.selectedIds.size).toBe(3);
    expect(state.selectedIds.has(1)).toBe(true);
    expect(state.selectedIds.has(2)).toBe(true);
    expect(state.selectedIds.has(3)).toBe(true);
  });

  it('contract: selectAll is no-op in single mode', () => {
    const state = makeState('single');
    const sel = useSelection(state, () => state.items);

    sel.selectAll();
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: deselectAll clears all', () => {
    const state = makeState('multi');
    state.selectedIds = new Set([1, 2, 3]);
    const sel = useSelection(state, () => state.items);

    sel.deselectAll();
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: isSelected checks membership', () => {
    const state = makeState('multi');
    state.selectedIds = new Set([2]);
    const sel = useSelection(state, () => state.items);

    expect(sel.isSelected(1)).toBe(false);
    expect(sel.isSelected(2)).toBe(true);
    expect(sel.isSelected(3)).toBe(false);
  });

  it('contract: setSelectedIds replaces the set', () => {
    const state = makeState('multi');
    state.selectedIds = new Set([1]);
    const sel = useSelection(state, () => state.items);

    sel.setSelectedIds([2, 3]);
    expect(state.selectedIds.has(1)).toBe(false);
    expect(state.selectedIds.has(2)).toBe(true);
    expect(state.selectedIds.has(3)).toBe(true);
  });

  it('contract: setSelectedIds is a no-op for an identical id set', () => {
    const state = makeState('multi');
    // A controlled parent echoing the current selection back (selectedIds +
    // onSelectionChange round trip) must not re-mutate the set: in the real
    // store the set is a SvelteSet, so clear()+add() of identical ids bumps
    // the per-key sources and ping-pongs the controlled loop per flush.
    let mutations = 0;
    class CountingSet extends Set<string | number> {
      override clear() {
        mutations += 1;
        super.clear();
      }
      override add(value: string | number) {
        mutations += 1;
        return super.add(value);
      }
      override delete(value: string | number) {
        mutations += 1;
        return super.delete(value);
      }
    }
    state.selectedIds = new CountingSet([2, 3]);
    const sel = useSelection(state, () => state.items);

    mutations = 0;
    sel.setSelectedIds([3, 2]); // same ids, different order — still identical
    expect(mutations).toBe(0);

    // Duplicated incoming ids must not false-positive on matching
    // cardinality: ['3','3'] has length 2 like the current {2,3}, but it is
    // NOT the same selection — the set must be replaced (deduplicated).
    sel.setSelectedIds([3, 3]);
    expect(state.selectedIds.size).toBe(1);
    expect(state.selectedIds.has(3)).toBe(true);

    sel.setSelectedIds([1]); // genuinely different — replaces as before
    expect(mutations).toBeGreaterThan(0);
    expect(state.selectedIds.size).toBe(1);
    expect(state.selectedIds.has(1)).toBe(true);
  });

  it('contract: toggleAll selects all when none selected', () => {
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

  // The concern no longer writes into `state.columns`; it exposes `visibleColumns`
  // and the store binds `state.columns` to it (see createTableState). That is what
  // makes the visible set survive server rendering — a write from an effect never
  // reached the server at all (#10). These assertions therefore read the concern's
  // own view; `TableStore.columns.svelte.test.ts` covers the wiring to `state`.
  const visible = (cv: ReturnType<typeof useColumnVisibility>) =>
    cv.visibleColumns.map((c) => c.accessor);

  it('contract: hideColumn removes from the visible set', () => {
    const cv = useColumnVisibility();

    cv.setColumns(columns);
    cv.hideColumn('age');

    expect(visible(cv)).toEqual(['name', 'email']);
    expect(cv.hiddenColumnKeys.has('age')).toBe(true);
  });

  it('contract: showColumn restores a previously hidden column', () => {
    const cv = useColumnVisibility();

    cv.setColumns(columns);
    cv.hideColumn('age');
    cv.showColumn('age');

    expect(visible(cv)).toEqual(['name', 'age', 'email']);
    expect(cv.hiddenColumnKeys.has('age')).toBe(false);
  });

  it('contract: setHiddenIds seeds the hidden-set before setColumns', () => {
    const cv = useColumnVisibility();

    // Persisted snapshot lands first (hydrate phase).
    cv.setHiddenIds(['age', 'email']);
    expect(cv.hiddenColumnKeys.has('age')).toBe(true);
    expect(cv.hiddenColumnKeys.has('email')).toBe(true);

    // Then the consumer's columns prop reaches the store.
    cv.setColumns(columns);

    // The visible set must be filtered by the persisted hidden ids.
    expect(visible(cv)).toEqual(['name']);
  });

  it('contract: showAllColumns reveals persisted-hidden columns', () => {
    // Guards the enableColumnVisibility={false} recovery path: TableProvider
    // calls showAllColumns() when the feature is off so a column hidden in a
    // prior (persisted) session is never stranded without a restore UI.
    const cv = useColumnVisibility();

    cv.setHiddenIds(['age', 'email']);
    cv.setColumns(columns);
    expect(visible(cv)).toEqual(['name']);

    cv.showAllColumns();

    expect(visible(cv)).toEqual(['name', 'age', 'email']);
    expect(cv.hiddenColumnKeys.size).toBe(0);
  });

  it('contract: setHiddenIds with empty array clears the hidden-set', () => {
    const cv = useColumnVisibility();

    cv.setColumns(columns);
    cv.hideColumn('age');
    cv.setHiddenIds([]);

    expect(cv.hiddenColumnKeys.size).toBe(0);
  });

  it('contract: showAllColumns clears hidden-set and restores the visible set', () => {
    const cv = useColumnVisibility();

    cv.setColumns(columns);
    cv.hideColumn('age');
    cv.hideColumn('email');
    cv.showAllColumns();

    expect(visible(cv)).toEqual(['name', 'age', 'email']);
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

  it('contract: applyOrder seeds the persisted order', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.applyOrder(['role', 'name', 'email', 'age']);

    expect(co.columnOrder).toEqual(['role', 'name', 'email', 'age']);
    expect(co.orderedColumns.map((c) => c.accessor)).toEqual(['role', 'name', 'email', 'age']);
  });

  it('contract: applyOrder gracefully handles ids that no longer exist', () => {
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

  it('contract: applyOrder with empty array resets to natural order', () => {
    const state = { columns } as unknown as TableState;
    const co = useColumnOrder(state);

    co.applyOrder(['role', 'email']);
    co.applyOrder([]);

    expect(co.orderedColumns).toBe(state.columns);
  });
});

describe('usePrefs — surface contract', () => {
  // The prefs concern (the v8 successor of usePersistence, minus the view
  // axes) reads/writes through `createPersistentState` from
  // @urbicon-ui/blocks. That helper is a no-op in Node (where these tests
  // run — `typeof window === 'undefined'`), so we cannot assert round-tripped
  // values here; `TableStore.seed.persistence.svelte.test.ts` does, in jsdom.
  // What this block pins:
  //   1. without a config the concern is a pure no-op,
  //   2. with one, the full sync/clear surface is exposed,
  //   3. neither shape mutates `state` on construction — stored values wait
  //      for `applyPersistedState()` (the hydration boundary).

  function makeState(): TableState {
    return {
      summaryConfigs: [],
      showSummary: false,
      selectedIds: new Set<string | number>(),
      selectionControlled: false
    } as unknown as TableState;
  }

  it('contract: without config everything is a no-op and nothing is hydrated', () => {
    const state = makeState();

    const prefs = usePrefs(state);

    // Calling any sync method should not throw.
    prefs.syncSummaryConfigs();
    prefs.syncHiddenColumns(['age']);
    prefs.syncColumnOrder(['name', 'age']);
    prefs.syncSelection();
    prefs.applyPersistedState();

    // Nothing stored, nothing hydrated.
    expect(prefs.storedHiddenColumnIds).toBeNull();
    expect(prefs.storedColumnOrder).toBeNull();
    expect(prefs.hydratedSummaryConfigs).toBe(false);
    expect(prefs.hydratedSelection).toBe(false);
  });

  it('contract: with config exposes the sync and clear surface', () => {
    const state = makeState();

    const prefs = usePrefs(state, { storage: 'test-table' });

    expect(typeof prefs.syncSummaryConfigs).toBe('function');
    expect(typeof prefs.syncHiddenColumns).toBe('function');
    expect(typeof prefs.syncColumnOrder).toBe('function');
    expect(typeof prefs.syncSelection).toBe('function');
    expect(typeof prefs.clearPersistedSummaryConfigs).toBe('function');
    expect(typeof prefs.clearPersistedHiddenColumns).toBe('function');
    expect(typeof prefs.clearPersistedColumnOrder).toBe('function');
    expect(typeof prefs.clearPersistedSelection).toBe('function');
  });

  it('contract: construction does not mutate state — hydration is a deferred step', () => {
    const state = makeState();

    usePrefs(state, { storage: 'test-table', persistSelection: true });

    expect(state.summaryConfigs).toEqual([]);
    expect(state.showSummary).toBe(false);
    expect(state.selectedIds.size).toBe(0);
  });

  it('contract: selection persistence is opt-in and never throws either way', () => {
    const state = makeState();
    state.selectedIds.add('row-1');

    // Default (no persistSelection flag): syncSelection is a harmless no-op —
    // the persistent store is never created, so the shared set is left alone.
    const off = usePrefs(state, { storage: 'sel-off' });
    expect(() => off.syncSelection()).not.toThrow();

    // Opt-in: syncSelection engages without throwing. Round-tripping needs a
    // DOM — see the block comment above.
    const on = usePrefs(state, { storage: 'sel-on', persistSelection: true });
    expect(() => on.syncSelection()).not.toThrow();
    expect(typeof on.clearPersistedSelection).toBe('function');

    // Controlled selection suppresses the write (prop is the source of truth) —
    // must still not throw.
    state.selectionControlled = true;
    expect(() => on.syncSelection()).not.toThrow();
  });

  it('contract: the object storage form is accepted alongside the string shorthand', () => {
    const state = makeState();
    const prefs = usePrefs(state, {
      storage: { key: 'test-table', kind: 'sessionStorage', debounceMs: 100 }
    });
    expect(() => prefs.syncSummaryConfigs()).not.toThrow();
  });

  it('contract: clearAllPersistentData covers every axis without throwing', () => {
    const state = makeState();

    const prefs = usePrefs(state, { storage: 'test-table' });
    expect(() => prefs.clearAllPersistentData()).not.toThrow();
    expect(() => prefs.forceSavePersistentData()).not.toThrow();
  });
});
