import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Column, Filter } from '$lib/types/tableTypes';
import { createTableView, type TableViewDefaults } from '$lib/view/view.svelte';
import { createTableState, type SummaryConfig } from './TableStore.svelte.js';

/**
 * Seed contract for the construction-time defaults, in the v8 vocabulary:
 * the six view axes seed through `createTableView({ defaults })` (what used
 * to be `initialSort` / `initialFilters` / `initialGroupBy` / `initialPage` /
 * `itemsPerPage` / a search seed), summaries seed through
 * `prefs.defaults.summaries`, and the selection through `createTableState`'s
 * fourth argument. Semantics are uniform across the family: seed-once at
 * construction, a persisted value wins (covered in
 * `TableStore.seed.persistence.svelte.test.ts`, which needs a DOM for real
 * storage), a controlled `selectedIds` prop wins over the selection seed.
 *
 * These tests run in the default node environment — the seed lands before
 * the first render and before the first server-mode query emission, so the
 * synchronous post-construction reads here observe exactly what the header
 * indicator and the first emitted `query` observe.
 */

// Node env, no component context: TableView construction warns there. Correct
// in production (a module-scope view is cross-request state), noise here.
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

const columns: Column[] = [
  { accessor: 'name', title: 'Name', sortable: true },
  { accessor: 'age', title: 'Age', sortable: true },
  { accessor: 'department', title: 'Department' }
];

const items = [
  { id: 1, name: 'Alice', age: 30, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, department: 'Design' },
  { id: 3, name: 'Charlie', age: 35, department: 'Engineering' }
];

/** Store over a view with the given defaults — the v8 spelling of `initial*`. */
const seeded = (defaults: TableViewDefaults) => createTableState(createTableView({ defaults }));

describe('view defaults: sort', () => {
  it('seeds sort state at construction — indicator source and first query contain it', () => {
    const ts = seeded({ sort: { column: 'age', direction: 'desc' } });

    // `state.sortColumn`/`state.sortDirection` are what TableHead's active
    // indicator and SortMenu read.
    expect(ts.state.sortColumn).toBe('age');
    expect(ts.state.sortDirection).toBe('desc');

    // The snapshot — what the managed fetch hands `source.query`, and what
    // `observeView` consumers see (the context's `query` getter left with the
    // v8 cut). The first emission must CONTAIN the seeded sort instead of
    // wiping it.
    expect(ts.view.snapshot().sort).toEqual({ column: 'age', direction: 'desc' });
  });

  it('sorts client-mode items by the seeded sort', () => {
    const ts = seeded({ sort: { column: 'age', direction: 'desc' } });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.sortedItems.map((i) => i.id)).toEqual([3, 1, 2]);
  });

  it('is seed-once — users can still change and clear the sort', () => {
    const ts = seeded({ sort: { column: 'age', direction: 'desc' } });

    // handleSort on the seeded column at `desc` cycles to "no sort".
    ts.handleSort('age');
    expect(ts.state.sortColumn).toBe('');
    expect(ts.view.snapshot().sort?.column ?? '').toBe('');
    expect(ts.view.sort).toBeNull();

    // Re-sorting by another column works normally; the seed never re-asserts.
    ts.handleSort('name');
    expect(ts.state.sortColumn).toBe('name');
    expect(ts.state.sortDirection).toBe('asc');
  });

  it('treats `sort: null` as "unsorted" — a value, not a missing seed', () => {
    const ts = seeded({ sort: null });
    expect(ts.state.sortColumn).toBe('');
    expect(ts.state.sortDirection).toBe('asc');
    expect(ts.view.defaults.sort).toBeNull();
  });
});

describe('view defaults: filters', () => {
  const seedFilters: Filter[] = [{ column: 'department', operator: 'equals', value: 'design' }];

  it('seeds filters at construction — chips source and first query contain them', () => {
    const ts = seeded({ filters: seedFilters });

    expect(ts.state.activeFilters).toEqual(seedFilters);
    expect(ts.view.snapshot().filters).toEqual(seedFilters);
  });

  it('does not alias the consumer array', () => {
    const consumerArray: Filter[] = [{ column: 'name', operator: 'contains', value: 'a' }];
    const ts = seeded({ filters: consumerArray });

    ts.addFilter({ column: 'age', operator: 'greaterThan', value: '20' });
    expect(consumerArray).toHaveLength(1);
  });

  it('filters client-mode items by the seeded filters', () => {
    const ts = seeded({ filters: seedFilters });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.filteredItems.map((i) => i.id)).toEqual([2]);
  });

  it('is seed-once — users can still clear the seeded filters', () => {
    const ts = seeded({ filters: seedFilters });

    ts.clearAllFilters();
    expect(ts.state.activeFilters).toEqual([]);
    expect(ts.view.snapshot().filters).toEqual([]);
  });
});

describe('view defaults: page and pageSize', () => {
  // The former `initialPage`/`itemsPerPage` props. Values deliberately differ
  // from the view's own defaults (1 and 10) — asserting the default would
  // hold with the wiring cut.
  it('seeds the page and the page size at construction', () => {
    const ts = seeded({ page: 2, pageSize: 2 });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.state.currentPage).toBe(2);
    expect(ts.state.itemsPerPage).toBe(2);
    expect(ts.paginatedItems.map((i) => i.id)).toEqual([3]);
  });

  it('is seed-once — paging away sticks', () => {
    const ts = seeded({ page: 2, pageSize: 2 });
    ts.setColumns(columns);
    ts.setItems(items);

    ts.goToPage(1);
    expect(ts.state.currentPage).toBe(1);
  });
});

describe('view defaults: search', () => {
  it('seeds the search term and narrows client-mode items', () => {
    const ts = seeded({ search: 'ali' });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.state.searchTerm).toBe('ali');
    expect(ts.view.snapshot().search).toBe('ali');
    expect(ts.filteredItems.map((i) => i.id)).toEqual([1]);
  });

  it('is seed-once — clearing the search sticks', () => {
    const ts = seeded({ search: 'ali' });
    ts.setSearchTerm('');
    expect(ts.state.searchTerm).toBe('');
  });
});

describe('selection seed (createTableState 4th argument)', () => {
  it('seeds the selection at construction', () => {
    const ts = createTableState(undefined, undefined, undefined, { selectedIds: [1, 3] });
    ts.state.selectionMode = 'multi';
    ts.setColumns(columns);
    ts.setItems(items);

    expect([...ts.state.selectedIds]).toEqual([1, 3]);
    expect(ts.selectedItems.map((i) => i.id)).toEqual([1, 3]);
    expect(ts.isSelected(1)).toBe(true);
    expect(ts.isSelected(2)).toBe(false);
  });

  it('is seed-once — users can still clear the seeded selection', () => {
    const ts = createTableState(undefined, undefined, undefined, { selectedIds: [1, 3] });
    ts.state.selectionMode = 'multi';

    ts.deselectAll();
    expect(ts.state.selectedIds.size).toBe(0);

    ts.selectItem(2);
    expect([...ts.state.selectedIds]).toEqual([2]);
  });

  it('a controlled apply replaces the seed (controlled wins)', () => {
    // TableProvider seeds construction with the controlled `selectedIds`
    // itself (SSR-visible); even when the two disagree the store converges —
    // the controlled effect re-applies the prop after construction:
    const ts = createTableState(undefined, undefined, undefined, { selectedIds: [1, 3] });
    ts.state.selectionControlled = true;
    ts.setSelectedIds([2]);

    expect([...ts.state.selectedIds]).toEqual([2]);
  });
});

describe('view defaults: groupBy', () => {
  it('seeds the grouping key at construction and groups client-mode items', () => {
    const ts = seeded({ groupBy: 'department' });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.state.groupByKey).toBe('department');
    expect(Object.keys(ts.grouped).sort()).toEqual(['Design', 'Engineering']);
    expect(ts.grouped.Engineering.map((i) => i.id)).toEqual([1, 3]);
    expect(ts.grouped.Design.map((i) => i.id)).toEqual([2]);
  });

  it('records the declared key for the grouping menu, for good', () => {
    // Grouping accepts any item field, not only ones with a column — the menu
    // reads the *declaration*, so the option survives even after ungrouping
    // (the Select-without-option defect).
    const ts = seeded({ groupBy: 'department' });
    expect(ts.state.declaredGroupByKey).toBe('department');

    ts.setGroupByKey(null);
    expect(ts.state.declaredGroupByKey).toBe('department');
  });

  it('is seed-once — users can still change and clear the grouping', () => {
    const ts = seeded({ groupBy: 'department' });

    // Clearing to ungrouped sticks — there is no effect that re-asserts the seed.
    ts.setGroupByKey(null);
    expect(ts.state.groupByKey).toBeNull();

    // Grouping by another column works normally; the seed never re-applies.
    ts.setGroupByKey('age');
    expect(ts.state.groupByKey).toBe('age');
  });

  it('treats a nullish/empty seed as "no grouping"', () => {
    expect(seeded({ groupBy: null }).state.groupByKey).toBeNull();

    // `''` is a degenerate input the type admits; it must not group anything
    // and must not become a menu declaration.
    const empty = seeded({ groupBy: '' });
    empty.setColumns(columns);
    empty.setItems(items);
    expect(empty.grouped).toHaveProperty('ungrouped');
    expect(empty.state.declaredGroupByKey).toBeNull();
  });
});

describe('prefs defaults: summaries', () => {
  const seedSummaries: SummaryConfig[] = [{ column: 'age', type: 'sum' }];

  it('seeds summary configs at construction and reveals the summary row', () => {
    const ts = createTableState(undefined, { defaults: { summaries: seedSummaries } });

    expect(ts.state.summaryConfigs).toEqual(seedSummaries);
    // setSummaryConfigs sets showSummary from the config count, so a non-empty
    // seed turns the summary row on (matching a persisted hydration).
    expect(ts.state.showSummary).toBe(true);
  });

  it('is seed-once — clearing the last summary at runtime does not re-seed', () => {
    // The pre-migration Provider `$effect` guarded on the reactive
    // `state.summaryConfigs.length === 0`, so removing the last config re-ran
    // it and re-seeded — a user could never fully clear summaries while the
    // prop was set. Seeding in the constructor makes the clear stick.
    const ts = createTableState(undefined, { defaults: { summaries: seedSummaries } });

    ts.removeSummaryConfig('age');
    expect(ts.state.summaryConfigs).toEqual([]);
    expect(ts.state.showSummary).toBe(false);

    // A fresh config added afterwards is the user's, not the seed re-applied.
    ts.addSummaryConfig({ column: 'age', type: 'avg' });
    expect(ts.state.summaryConfigs).toEqual([{ column: 'age', type: 'avg' }]);
  });

  it('does not alias the consumer array', () => {
    // The seed copies, so updating an *already-seeded* column — which
    // `addSummaryConfig` handles by replacing the array slot in place — must
    // not reach back into the consumer's array. (Adding a *new* column takes
    // the reassignment branch and would leave the source intact either way, so
    // it wouldn't guard the copy.)
    const consumerArray: SummaryConfig[] = [{ column: 'age', type: 'sum' }];
    const ts = createTableState(undefined, { defaults: { summaries: consumerArray } });

    ts.addSummaryConfig({ column: 'age', type: 'avg' });
    expect(consumerArray).toEqual([{ column: 'age', type: 'sum' }]);
    expect(ts.state.summaryConfigs).toEqual([{ column: 'age', type: 'avg' }]);
  });

  it('treats an empty seed array as "no seed"', () => {
    const ts = createTableState(undefined, { defaults: { summaries: [] } });
    expect(ts.state.summaryConfigs).toEqual([]);
    expect(ts.state.showSummary).toBe(false);
  });
});

describe('absent seeds are inert', () => {
  it('no arguments leave every axis at its default', () => {
    const ts = createTableState();
    expect(ts.state.sortColumn).toBe('');
    expect(ts.state.activeFilters).toEqual([]);
    expect(ts.state.currentPage).toBe(1);
    expect(ts.state.itemsPerPage).toBe(10);
    expect(ts.state.searchTerm).toBe('');
    expect(ts.state.selectedIds.size).toBe(0);
    expect(ts.state.groupByKey).toBeNull();
    expect(ts.state.summaryConfigs).toEqual([]);
  });

  it('empty seed arrays leave every axis at its default', () => {
    const ts = createTableState(
      createTableView({ defaults: { filters: [] } }),
      { defaults: { summaries: [] } },
      undefined,
      { selectedIds: [] }
    );
    expect(ts.state.activeFilters).toEqual([]);
    expect(ts.state.selectedIds.size).toBe(0);
    expect(ts.state.summaryConfigs).toEqual([]);
  });
});
