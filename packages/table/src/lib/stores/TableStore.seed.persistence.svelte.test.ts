// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Filter } from '$lib/types/tableTypes';
import { createTableState, type SummaryConfig } from './TableStore.svelte.js';

/**
 * Precedence of the `initial*` seeds against `persistenceConfig`: persistence
 * hydrates the shared state in the store constructor *before* the seed is
 * applied, and each seed axis only fills an axis persistence did not supply —
 * so a persisted value always wins (same contract as `initialGroupBy` /
 * `initialSummaryConfigs` document). When persistence has nothing stored, the
 * seed applies and is synced back to storage like a user action would be.
 *
 * "Persistence supplied it" means *an entry exists*, not *the value is
 * non-empty*: a stored empty value (`{ column: '' }`, `[]`, `null`) is the
 * user having cleared that axis and beats the seed too. Only an absent — or
 * corrupt — entry lets the seed apply.
 *
 * This file opts into jsdom (unlike the rest of the node suite) because the
 * round trip needs a working `window.localStorage` — the blocks
 * `createPersistentState` helper is a no-op without a DOM. Node ≥22 ships its
 * own global `localStorage` (a non-functional stub without
 * `--localstorage-file`) that shadows jsdom's, so a functional in-memory
 * Storage is installed on `window` per test; the implementation resolves
 * `window.localStorage` at store construction, not at import, and therefore
 * uses it. Constructing a store *with* a persistenceConfig creates `$effect`s
 * inside `createPersistentState`, so construction is wrapped in
 * `$effect.root`.
 */

const SORT_KEY = (tableId: string) => `urbicon_table_sort_${tableId}_v1`;
const FILTERS_KEY = (tableId: string) => `urbicon_table_filters_${tableId}_v1`;
const SELECTION_KEY = (tableId: string) => `urbicon_table_selection_${tableId}_v1`;
const GROUP_KEY = (tableId: string) => `urbicon_table_group_by_${tableId}_v1`;
const SUMMARY_KEY = (tableId: string) => `urbicon_table_summary_configs_${tableId}_v1`;

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value))
  };
}

function withRoot<T>(fn: () => T): T {
  let result!: T;
  const cleanup = $effect.root(() => {
    result = fn();
  });
  cleanup();
  return result;
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true
  });
});

describe('seed precedence vs persistence: sort', () => {
  it('a persisted sort wins over initialSort', () => {
    window.localStorage.setItem(
      SORT_KEY('t1'),
      JSON.stringify({ column: 'name', direction: 'asc' })
    );

    const ts = withRoot(() =>
      createTableState({ tableId: 't1' }, { sort: { column: 'age', direction: 'desc' } })
    );

    expect(ts.state.sortColumn).toBe('name');
    expect(ts.state.sortDirection).toBe('asc');
  });

  it('with nothing persisted the seed applies and is synced to storage', () => {
    const ts = withRoot(() =>
      createTableState({ tableId: 't2' }, { sort: { column: 'age', direction: 'desc' } })
    );

    expect(ts.state.sortColumn).toBe('age');
    expect(ts.state.sortDirection).toBe('desc');

    // Like a user sort, the seeded sort reaches storage (debounced normally;
    // forced here) — so the next visit restores the same view.
    ts.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SORT_KEY('t2')) ?? 'null')).toEqual({
      column: 'age',
      direction: 'desc'
    });
  });

  it('a persisted "no sort" (empty column) beats the seed — cleared stays cleared', () => {
    window.localStorage.setItem(SORT_KEY('t3'), JSON.stringify({ column: '', direction: 'asc' }));

    const ts = withRoot(() =>
      createTableState({ tableId: 't3' }, { sort: { column: 'age', direction: 'desc' } })
    );

    expect(ts.state.sortColumn).toBe('');
  });

  it('a corrupt sort entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(SORT_KEY('t3b'), '{not json');

    const ts = withRoot(() =>
      createTableState({ tableId: 't3b' }, { sort: { column: 'age', direction: 'desc' } })
    );

    expect(ts.state.sortColumn).toBe('age');
  });

  it('a wrongly-shaped sort entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(SORT_KEY('t3c'), JSON.stringify('name'));

    const ts = withRoot(() =>
      createTableState({ tableId: 't3c' }, { sort: { column: 'age', direction: 'desc' } })
    );

    expect(ts.state.sortColumn).toBe('age');
  });

  it('clearing the sort survives a reload instead of re-seeding (end to end)', () => {
    window.localStorage.setItem(
      SORT_KEY('t3d'),
      JSON.stringify({ column: 'name', direction: 'asc' })
    );

    // Session 1: the persisted sort wins, the user then clicks the header
    // twice (asc → desc → none) to clear it. The cleared state reaches storage.
    const first = withRoot(() =>
      createTableState({ tableId: 't3d' }, { sort: { column: 'age', direction: 'desc' } })
    );
    expect(first.state.sortColumn).toBe('name');
    first.handleSort('name');
    first.handleSort('name');
    expect(first.state.sortColumn).toBe('');
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SORT_KEY('t3d')) ?? 'null')).toEqual({
      column: '',
      direction: 'asc'
    });

    // Session 2: same table, same seed — the cleared sort wins.
    const second = withRoot(() =>
      createTableState({ tableId: 't3d' }, { sort: { column: 'age', direction: 'desc' } })
    );
    expect(second.state.sortColumn).toBe('');
  });
});

describe('seed precedence vs persistence: filters', () => {
  const seedFilters: Filter[] = [{ column: 'department', operator: 'equals', value: 'design' }];

  it('persisted filters win over initialFilters', () => {
    const persisted: Filter[] = [{ column: 'name', operator: 'contains', value: 'ali' }];
    window.localStorage.setItem(FILTERS_KEY('t4'), JSON.stringify(persisted));

    const ts = withRoot(() => createTableState({ tableId: 't4' }, { filters: seedFilters }));

    expect(ts.state.activeFilters).toEqual(persisted);
  });

  it('with nothing persisted the seed applies and is synced to storage', () => {
    const ts = withRoot(() => createTableState({ tableId: 't5' }, { filters: seedFilters }));

    expect(ts.state.activeFilters).toEqual(seedFilters);

    ts.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(FILTERS_KEY('t5')) ?? 'null')).toEqual(
      seedFilters
    );
  });

  it('a persisted empty filter set beats the seed — cleared stays cleared', () => {
    window.localStorage.setItem(FILTERS_KEY('t5b'), JSON.stringify([]));

    const ts = withRoot(() => createTableState({ tableId: 't5b' }, { filters: seedFilters }));

    expect(ts.state.activeFilters).toEqual([]);
  });

  it('a corrupt filter entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(FILTERS_KEY('t5c'), '[{');

    const ts = withRoot(() => createTableState({ tableId: 't5c' }, { filters: seedFilters }));

    expect(ts.state.activeFilters).toEqual(seedFilters);
  });

  it('clearing every filter survives a reload instead of re-seeding (end to end)', () => {
    const persisted: Filter[] = [{ column: 'name', operator: 'contains', value: 'ali' }];
    window.localStorage.setItem(FILTERS_KEY('t5d'), JSON.stringify(persisted));

    const first = withRoot(() => createTableState({ tableId: 't5d' }, { filters: seedFilters }));
    expect(first.state.activeFilters).toEqual(persisted);
    first.clearAllFilters();
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(FILTERS_KEY('t5d')) ?? 'null')).toEqual([]);

    const second = withRoot(() => createTableState({ tableId: 't5d' }, { filters: seedFilters }));
    expect(second.state.activeFilters).toEqual([]);
  });
});

describe('seed precedence vs persistence: selection', () => {
  it('a persisted selection (persistSelection: true) wins over initialSelectedIds', () => {
    window.localStorage.setItem(SELECTION_KEY('t6'), JSON.stringify([5]));

    const ts = withRoot(() =>
      createTableState({ tableId: 't6', persistSelection: true }, { selectedIds: [1, 2] })
    );

    expect([...ts.state.selectedIds]).toEqual([5]);
  });

  it('without persistSelection stale storage is ignored and the seed applies', () => {
    window.localStorage.setItem(SELECTION_KEY('t7'), JSON.stringify([5]));

    const ts = withRoot(() => createTableState({ tableId: 't7' }, { selectedIds: [1, 2] }));

    expect([...ts.state.selectedIds]).toEqual([1, 2]);
  });

  it('a controlled selection never reaches storage — the persisted seed survives', () => {
    const ts = withRoot(() =>
      createTableState({ tableId: 't8', persistSelection: true }, { selectedIds: [1] })
    );
    ts.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SELECTION_KEY('t8')) ?? 'null')).toEqual([1]);

    // Switch to controlled (as TableProvider does when `selectedIds` is set):
    // syncSelection skips writes, so storage keeps the previous value.
    ts.state.selectionControlled = true;
    ts.setSelectedIds([9]);
    ts.forceSavePersistentData();

    expect([...ts.state.selectedIds]).toEqual([9]);
    expect(JSON.parse(window.localStorage.getItem(SELECTION_KEY('t8')) ?? 'null')).toEqual([1]);
  });

  it('a persisted empty selection beats the seed — deselecting stays deselected', () => {
    window.localStorage.setItem(SELECTION_KEY('t8b'), JSON.stringify([]));

    const ts = withRoot(() =>
      createTableState({ tableId: 't8b', persistSelection: true }, { selectedIds: [1, 2] })
    );

    expect([...ts.state.selectedIds]).toEqual([]);
  });

  it('a corrupt selection entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(SELECTION_KEY('t8c'), 'nope');

    const ts = withRoot(() =>
      createTableState({ tableId: 't8c', persistSelection: true }, { selectedIds: [1, 2] })
    );

    expect([...ts.state.selectedIds]).toEqual([1, 2]);
  });

  it('deselecting everything survives a reload instead of re-seeding (end to end)', () => {
    window.localStorage.setItem(SELECTION_KEY('t8d'), JSON.stringify([5]));

    const first = withRoot(() =>
      createTableState({ tableId: 't8d', persistSelection: true }, { selectedIds: [1, 2] })
    );
    expect([...first.state.selectedIds]).toEqual([5]);
    first.setSelectedIds([]);
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SELECTION_KEY('t8d')) ?? 'null')).toEqual([]);

    const second = withRoot(() =>
      createTableState({ tableId: 't8d', persistSelection: true }, { selectedIds: [1, 2] })
    );
    expect([...second.state.selectedIds]).toEqual([]);
  });
});

describe('seed precedence vs persistence: groupBy', () => {
  it('a persisted grouping key wins over initialGroupBy', () => {
    window.localStorage.setItem(GROUP_KEY('t9'), JSON.stringify('name'));

    const ts = withRoot(() => createTableState({ tableId: 't9' }, { groupBy: 'department' }));

    expect(ts.state.groupByKey).toBe('name');
  });

  it('with nothing persisted the seed applies and is synced to storage', () => {
    const ts = withRoot(() => createTableState({ tableId: 't10' }, { groupBy: 'department' }));

    expect(ts.state.groupByKey).toBe('department');

    ts.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(GROUP_KEY('t10')) ?? 'null')).toBe('department');
  });

  it('a persisted "no grouping" (null) beats the seed — ungrouping stays ungrouped', () => {
    window.localStorage.setItem(GROUP_KEY('t10b'), JSON.stringify(null));

    const ts = withRoot(() => createTableState({ tableId: 't10b' }, { groupBy: 'department' }));

    expect(ts.state.groupByKey).toBe(null);
  });

  it('a corrupt grouping entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(GROUP_KEY('t10c'), '{');

    const ts = withRoot(() => createTableState({ tableId: 't10c' }, { groupBy: 'department' }));

    expect(ts.state.groupByKey).toBe('department');
  });

  it('ungrouping survives a reload instead of re-seeding (end to end)', () => {
    window.localStorage.setItem(GROUP_KEY('t10d'), JSON.stringify('name'));

    const first = withRoot(() => createTableState({ tableId: 't10d' }, { groupBy: 'department' }));
    expect(first.state.groupByKey).toBe('name');
    first.setGroupByKey(null);
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(GROUP_KEY('t10d')) ?? 'null')).toBe(null);

    const second = withRoot(() => createTableState({ tableId: 't10d' }, { groupBy: 'department' }));
    expect(second.state.groupByKey).toBe(null);
  });
});

describe('seed precedence vs persistence: summaryConfigs', () => {
  const seedSummaries: SummaryConfig[] = [{ column: 'age', type: 'sum' }];

  it('persisted summary configs win over initialSummaryConfigs', () => {
    const persisted: SummaryConfig[] = [{ column: 'salary', type: 'avg' }];
    window.localStorage.setItem(SUMMARY_KEY('t11'), JSON.stringify(persisted));

    const ts = withRoot(() =>
      createTableState({ tableId: 't11' }, { summaryConfigs: seedSummaries })
    );

    expect(ts.state.summaryConfigs).toEqual(persisted);
    expect(ts.state.showSummary).toBe(true);
  });

  it('with nothing persisted the seed applies, reveals the row, and is synced', () => {
    const ts = withRoot(() =>
      createTableState({ tableId: 't12' }, { summaryConfigs: seedSummaries })
    );

    expect(ts.state.summaryConfigs).toEqual(seedSummaries);
    expect(ts.state.showSummary).toBe(true);

    ts.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SUMMARY_KEY('t12')) ?? 'null')).toEqual(
      seedSummaries
    );
  });

  it('a persisted empty summary set beats the seed and keeps the row hidden', () => {
    window.localStorage.setItem(SUMMARY_KEY('t13'), JSON.stringify([]));

    const ts = withRoot(() =>
      createTableState({ tableId: 't13' }, { summaryConfigs: seedSummaries })
    );

    expect(ts.state.summaryConfigs).toEqual([]);
    expect(ts.state.showSummary).toBe(false);
  });

  it('a corrupt summary entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(SUMMARY_KEY('t14'), '[[');

    const ts = withRoot(() =>
      createTableState({ tableId: 't14' }, { summaryConfigs: seedSummaries })
    );

    expect(ts.state.summaryConfigs).toEqual(seedSummaries);
    expect(ts.state.showSummary).toBe(true);
  });

  it('removing every summary survives a reload instead of re-seeding (end to end)', () => {
    const persisted: SummaryConfig[] = [{ column: 'salary', type: 'avg' }];
    window.localStorage.setItem(SUMMARY_KEY('t15'), JSON.stringify(persisted));

    const first = withRoot(() =>
      createTableState({ tableId: 't15' }, { summaryConfigs: seedSummaries })
    );
    expect(first.state.summaryConfigs).toEqual(persisted);
    first.removeSummaryConfig('salary');
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SUMMARY_KEY('t15')) ?? 'null')).toEqual([]);

    const second = withRoot(() =>
      createTableState({ tableId: 't15' }, { summaryConfigs: seedSummaries })
    );
    expect(second.state.summaryConfigs).toEqual([]);
    expect(second.state.showSummary).toBe(false);
  });
});

describe('storage hygiene: an untouched axis creates no entry', () => {
  it('a table nobody touched leaves every key absent', () => {
    const ts = withRoot(() => createTableState({ tableId: 't16', persistSelection: true }));
    // Writing the untouched defaults would make "an entry exists" meaningless:
    // an axis nobody ever set would then look exactly like a cleared one.
    ts.forceSavePersistentData();

    for (const keyOf of [SORT_KEY, FILTERS_KEY, SELECTION_KEY, GROUP_KEY, SUMMARY_KEY]) {
      expect(window.localStorage.getItem(keyOf('t16'))).toBe(null);
    }
  });

  it('a seeded axis is written, the untouched axes stay absent', () => {
    const ts = withRoot(() =>
      createTableState({ tableId: 't17' }, { sort: { column: 'age', direction: 'desc' } })
    );
    ts.forceSavePersistentData();

    expect(JSON.parse(window.localStorage.getItem(SORT_KEY('t17')) ?? 'null')).toEqual({
      column: 'age',
      direction: 'desc'
    });
    expect(window.localStorage.getItem(FILTERS_KEY('t17'))).toBe(null);
    expect(window.localStorage.getItem(GROUP_KEY('t17'))).toBe(null);
  });

  it('clearAllPersistentData removes the entries for good', () => {
    window.localStorage.setItem(
      SORT_KEY('t18'),
      JSON.stringify({ column: 'name', direction: 'asc' })
    );

    const ts = withRoot(() => createTableState({ tableId: 't18' }));
    ts.clearAllPersistentData();
    // Neither the reset itself nor the auto-save it triggers may re-create it.
    ts.forceSavePersistentData();

    expect(window.localStorage.getItem(SORT_KEY('t18'))).toBe(null);
  });
});
