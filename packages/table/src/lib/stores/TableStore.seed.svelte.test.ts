import { describe, expect, it } from 'vitest';
import type { Column, Filter } from '$lib/types/tableTypes';
import { createTableState, type SummaryConfig } from './TableStore.svelte.js';

/**
 * Seed contract for the uncontrolled `initial*` view-state props
 * (`initialSort` / `initialFilters` / `initialSelectedIds` / `initialGroupBy`
 * / `initialSummaryConfigs`), applied via `createTableState`'s `seed`
 * parameter. Semantics are uniform across the family: seed-once at
 * construction, a persisted value wins (covered in
 * `TableStore.seed.persistence.svelte.test.ts`, which needs a DOM for real
 * storage), a controlled prop wins (the Provider drops the selection seed
 * when `selectedIds` is set and the groupBy seed when `groupByKey` is set;
 * the store-level convergence is covered below).
 *
 * These tests run in the default node environment — the seed lands before
 * the first render and before the first server-mode query emission, so the
 * synchronous post-construction reads here observe exactly what the header
 * indicator and the first emitted `query` observe.
 */

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

describe('createTableState seed: initialSort', () => {
  it('seeds sort state at construction — indicator source and first query contain it', () => {
    const ts = createTableState(undefined, { sort: { column: 'age', direction: 'desc' } });

    // `state.sortColumn`/`state.sortDirection` are what TableHead's active
    // indicator and SortMenu read.
    expect(ts.state.sortColumn).toBe('age');
    expect(ts.state.sortDirection).toBe('desc');

    // `query` is what the server-mode lifecycle emits — the whole point of
    // the seed for URL sync: the first emission must CONTAIN the seeded sort
    // instead of wiping the URL params.
    expect(ts.query.sortColumn).toBe('age');
    expect(ts.query.sortDirection).toBe('desc');
  });

  it('sorts client-mode items by the seeded sort', () => {
    const ts = createTableState(undefined, { sort: { column: 'age', direction: 'desc' } });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.sortedItems.map((i) => i.id)).toEqual([3, 1, 2]);
  });

  it('is seed-once — users can still change and clear the sort', () => {
    const ts = createTableState(undefined, { sort: { column: 'age', direction: 'desc' } });

    // handleSort on the seeded column at `desc` cycles to "no sort".
    ts.handleSort('age');
    expect(ts.state.sortColumn).toBe('');
    expect(ts.query.sortColumn).toBe('');

    // Re-sorting by another column works normally; the seed never re-asserts.
    ts.handleSort('name');
    expect(ts.state.sortColumn).toBe('name');
    expect(ts.state.sortDirection).toBe('asc');
  });

  it('treats an empty seed column as "no seed"', () => {
    const ts = createTableState(undefined, { sort: { column: '', direction: 'desc' } });
    expect(ts.state.sortColumn).toBe('');
    expect(ts.state.sortDirection).toBe('asc');
  });
});

describe('createTableState seed: initialFilters', () => {
  const seedFilters: Filter[] = [{ column: 'department', operator: 'equals', value: 'design' }];

  it('seeds filters at construction — chips source and first query contain them', () => {
    const ts = createTableState(undefined, { filters: seedFilters });

    expect(ts.state.activeFilters).toEqual(seedFilters);
    expect(ts.query.activeFilters).toEqual(seedFilters);
  });

  it('does not alias the consumer array', () => {
    const consumerArray: Filter[] = [{ column: 'name', operator: 'contains', value: 'a' }];
    const ts = createTableState(undefined, { filters: consumerArray });

    ts.addFilter({ column: 'age', operator: 'greaterThan', value: '20' });
    expect(consumerArray).toHaveLength(1);
  });

  it('filters client-mode items by the seeded filters', () => {
    const ts = createTableState(undefined, { filters: seedFilters });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.filteredItems.map((i) => i.id)).toEqual([2]);
  });

  it('is seed-once — users can still clear the seeded filters', () => {
    const ts = createTableState(undefined, { filters: seedFilters });

    ts.clearAllFilters();
    expect(ts.state.activeFilters).toEqual([]);
    expect(ts.query.activeFilters).toEqual([]);
  });
});

describe('createTableState seed: initialSelectedIds', () => {
  it('seeds the selection at construction', () => {
    const ts = createTableState(undefined, { selectedIds: [1, 3] });
    ts.state.selectionMode = 'multi';
    ts.setColumns(columns);
    ts.setItems(items);

    expect([...ts.state.selectedIds]).toEqual([1, 3]);
    expect(ts.selectedItems.map((i) => i.id)).toEqual([1, 3]);
    expect(ts.isSelected(1)).toBe(true);
    expect(ts.isSelected(2)).toBe(false);
  });

  it('is seed-once — users can still clear the seeded selection', () => {
    const ts = createTableState(undefined, { selectedIds: [1, 3] });
    ts.state.selectionMode = 'multi';

    ts.deselectAll();
    expect(ts.state.selectedIds.size).toBe(0);

    ts.selectItem(2);
    expect([...ts.state.selectedIds]).toEqual([2]);
  });

  it('a controlled apply replaces the seed (controlled wins)', () => {
    // TableProvider drops the seed entirely when the controlled `selectedIds`
    // prop is present; even without that gate the store converges — the
    // controlled effect applies the prop after construction:
    const ts = createTableState(undefined, { selectedIds: [1, 3] });
    ts.state.selectionControlled = true;
    ts.setSelectedIds([2]);

    expect([...ts.state.selectedIds]).toEqual([2]);
  });
});

describe('createTableState seed: initialGroupBy', () => {
  it('seeds the grouping key at construction and groups client-mode items', () => {
    const ts = createTableState(undefined, { groupBy: 'department' });
    ts.setColumns(columns);
    ts.setItems(items);

    expect(ts.state.groupByKey).toBe('department');
    expect(Object.keys(ts.grouped).sort()).toEqual(['Design', 'Engineering']);
    expect(ts.grouped.Engineering.map((i) => i.id)).toEqual([1, 3]);
    expect(ts.grouped.Design.map((i) => i.id)).toEqual([2]);
  });

  it('is seed-once — users can still change and clear the grouping', () => {
    const ts = createTableState(undefined, { groupBy: 'department' });

    // Clearing to ungrouped sticks — there is no effect that re-asserts the seed.
    ts.setGroupByKey(null);
    expect(ts.state.groupByKey).toBeNull();

    // Grouping by another column works normally; the seed never re-applies.
    ts.setGroupByKey('age');
    expect(ts.state.groupByKey).toBe('age');
  });

  it('treats a nullish/empty seed as "no seed"', () => {
    expect(createTableState(undefined, { groupBy: null }).state.groupByKey).toBeNull();
    expect(createTableState(undefined, { groupBy: '' }).state.groupByKey).toBeNull();
  });
});

describe('createTableState seed: initialSummaryConfigs', () => {
  const seedSummaries: SummaryConfig[] = [{ column: 'age', type: 'sum' }];

  it('seeds summary configs at construction and reveals the summary row', () => {
    const ts = createTableState(undefined, { summaryConfigs: seedSummaries });

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
    const ts = createTableState(undefined, { summaryConfigs: seedSummaries });

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
    const ts = createTableState(undefined, { summaryConfigs: consumerArray });

    ts.addSummaryConfig({ column: 'age', type: 'avg' });
    expect(consumerArray).toEqual([{ column: 'age', type: 'sum' }]);
    expect(ts.state.summaryConfigs).toEqual([{ column: 'age', type: 'avg' }]);
  });

  it('treats an empty seed array as "no seed"', () => {
    const ts = createTableState(undefined, { summaryConfigs: [] });
    expect(ts.state.summaryConfigs).toEqual([]);
    expect(ts.state.showSummary).toBe(false);
  });
});

describe('createTableState seed: absent seeds are inert', () => {
  it('no seed argument leaves every axis at its default', () => {
    const ts = createTableState();
    expect(ts.state.sortColumn).toBe('');
    expect(ts.state.activeFilters).toEqual([]);
    expect(ts.state.selectedIds.size).toBe(0);
    expect(ts.state.groupByKey).toBeNull();
    expect(ts.state.summaryConfigs).toEqual([]);
  });

  it('empty seed arrays leave every axis at its default', () => {
    const ts = createTableState(undefined, {
      filters: [],
      selectedIds: [],
      summaryConfigs: []
    });
    expect(ts.state.activeFilters).toEqual([]);
    expect(ts.state.selectedIds.size).toBe(0);
    expect(ts.state.summaryConfigs).toEqual([]);
  });
});
