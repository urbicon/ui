// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Column, Filter } from '$lib/types/tableTypes';
import { bindViewToStorage } from '$lib/view/storage-binding.svelte';
import { createTableView, type TableView, type TableViewDefaults } from '$lib/view/view.svelte';
import { createTableState, type SummaryConfig } from './TableStore.svelte.js';

/**
 * Persistence against construction-time defaults, in the v8 split:
 *
 * - The six **view axes** persist through `bindViewToStorage(view, …)` — one
 *   JSON object per table under `urbicon_table_view_<key>_v1`, applied once
 *   after hydration, written (debounced) only when the LAST change of an axis
 *   was the reader's own (`user` origin). Two deliberate deltas against the
 *   store-owned v7 persistence, both pinned below: defaults/seeds are never
 *   synced back into storage (only what the reader changes is written), and
 *   `pageSize` IS persisted while `page` is not.
 *
 * - The **prefs axes** (summaries, hidden columns, column order, opt-in
 *   selection) persist through `TablePrefsConfig` on the old per-axis keys
 *   (`urbicon_table_summary_configs_<id>_v1`, …). Stored values are read at
 *   construction and applied via `applyPersistedState()` — the post-hydration
 *   step `TableProvider` performs in an `$effect` — while `prefs.defaults`
 *   apply at construction (deterministic on both sides of hydration, so a
 *   default-hidden column is hidden in the server HTML too).
 *
 * "Persistence supplied it" still means *an entry exists*, not *the value is
 * non-empty*: a stored empty value (`sort: null`, `[]`) is the user having
 * cleared that axis and beats the default. Only an absent — or corrupt —
 * entry lets the default apply.
 *
 * This file opts into jsdom (unlike the rest of the node suite) because the
 * prefs round trip needs a working `window.localStorage` — the blocks
 * `createPersistentState` helper is a no-op without a DOM. Node ≥22 ships its
 * own global `localStorage` stub that shadows jsdom's, so a functional
 * in-memory Storage is installed on `window` per test. The storage binding
 * takes its storage as an *option*, so the view half injects a double
 * directly. Both halves create `$effect`s, so construction is wrapped in
 * `$effect.root`.
 */

const VIEW_KEY = (key: string) => `urbicon_table_view_${key}_v1`;
const SELECTION_KEY = (tableId: string) => `urbicon_table_selection_${tableId}_v1`;
const SUMMARY_KEY = (tableId: string) => `urbicon_table_summary_configs_${tableId}_v1`;
const HIDDEN_KEY = (tableId: string) => `urbicon_table_hidden_columns_${tableId}_v1`;
const ORDER_KEY = (tableId: string) => `urbicon_table_column_order_${tableId}_v1`;
const SORT_KEY = (tableId: string) => `urbicon_table_sort_${tableId}_v1`;
const FILTERS_KEY = (tableId: string) => `urbicon_table_filters_${tableId}_v1`;
const GROUP_KEY = (tableId: string) => `urbicon_table_group_by_${tableId}_v1`;

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'age', title: 'Age' },
  { accessor: 'email', title: 'Email' }
] as Column[];

const ids = (columns: Column[]) => columns.map((c) => c.accessor);

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

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// View axes: bindViewToStorage
// ─────────────────────────────────────────────────────────────────────────────

describe('view axes: bindViewToStorage vs the view defaults', () => {
  // The 500 ms write debounce runs on fake timers; `session` advances past it
  // BEFORE tearing the root down, because the destroy teardown deliberately
  // drops a still-pending write (no side effects after death).
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const stored = (key: string) =>
    JSON.parse(window.localStorage.getItem(VIEW_KEY(key)) ?? 'null') as Record<
      string,
      unknown
    > | null;

  /**
   * One browser session: a fresh view over `defaults`, bound to
   * `window.localStorage` under `key`. `fn` runs after the apply-once effect
   * (= after hydration); writes it triggers land in storage before teardown.
   */
  function session(key: string, defaults: TableViewDefaults, fn: (view: TableView) => void) {
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults });
      bindViewToStorage(view, { key, storage: window.localStorage });
      flushSync(); // the hydration boundary: storage applies here, not earlier
      fn(view);
      flushSync();
    });
    vi.advanceTimersByTime(600);
    cleanup();
  }

  it('a stored sort wins over the view defaults — after hydration, not before it', () => {
    window.localStorage.setItem(
      VIEW_KEY('t1'),
      JSON.stringify({ sort: { column: 'amount', direction: 'asc' } })
    );

    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { sort: { column: 'name', direction: 'desc' } } });
      bindViewToStorage(view, { key: 't1', storage: window.localStorage });
      const store = createTableState(view, undefined, {
        source: () => ({
          processing: 'client' as const,
          items: [
            { id: 1, name: 'Ada', amount: 300 },
            { id: 2, name: 'Grace', amount: 100 }
          ]
        }),
        columns: () => COLUMNS
      });

      // What the server renders, and therefore what the client's first render
      // has to match: the defaults, nothing from storage.
      expect(view.sort).toEqual({ column: 'name', direction: 'desc' });
      expect(store.paginatedItems.map((r) => r.name)).toEqual(['Grace', 'Ada']);

      flushSync(); // hydration

      expect(view.sort).toEqual({ column: 'amount', direction: 'asc' });
      expect(store.paginatedItems.map((r) => r.name)).toEqual(['Grace', 'Ada']);
      expect(store.view.sort?.column).toBe('amount');
    });
    cleanup();
  });

  it('a stored "unsorted" (sort: null) beats the defaults — cleared stays cleared', () => {
    window.localStorage.setItem(VIEW_KEY('t2'), JSON.stringify({ sort: null }));

    session('t2', { sort: { column: 'age', direction: 'desc' } }, (view) => {
      expect(view.sort).toBeNull();
    });
  });

  it('a corrupt entry is treated as absent — the defaults apply', () => {
    window.localStorage.setItem(VIEW_KEY('t3'), '{not json');

    session('t3', { sort: { column: 'age', direction: 'desc' } }, (view) => {
      expect(view.sort).toEqual({ column: 'age', direction: 'desc' });
    });
  });

  it('a wrongly-shaped axis value is skipped, the others still apply', () => {
    window.localStorage.setItem(
      VIEW_KEY('t4'),
      JSON.stringify({ sort: 'name', search: 'ada', pageSize: 'lots' })
    );

    session('t4', { sort: { column: 'age', direction: 'desc' } }, (view) => {
      // Shape validation is per axis: the string where a sort object belongs
      // reads as "nothing stored" for that axis, not for the whole entry.
      expect(view.sort).toEqual({ column: 'age', direction: 'desc' });
      expect(view.search).toBe('ada');
      expect(view.pageSize).toBe(10);
    });
  });

  it('drops malformed filter elements instead of hydrating them into the pipeline', () => {
    window.localStorage.setItem(
      VIEW_KEY('t5'),
      JSON.stringify({
        filters: [{ column: 'name', operator: 'contains', value: 'a' }, 'junk', null, 42, {}]
      })
    );

    session('t5', {}, (view) => {
      expect(view.filters).toEqual([{ column: 'name', operator: 'contains', value: 'a' }]);
    });
  });

  it('defaults are NOT synced back to storage — only the reader writes', () => {
    // Deliberate v8 delta (the seed-resync delta): the old store wrote an
    // applied seed to storage "like a user action". Now an axis nobody touched
    // stays absent — so after a deploy with changed defaults, the new default
    // greets returning readers who never touched the axis.
    session('t6', { sort: { column: 'age', direction: 'desc' }, pageSize: 25 }, () => {});

    expect(window.localStorage.getItem(VIEW_KEY('t6'))).toBeNull();
  });

  it('a reader change is written — debounced — and restores over the same defaults', () => {
    const cleanup = $effect.root(() => {
      const view = createTableView({ defaults: { sort: { column: 'age', direction: 'desc' } } });
      bindViewToStorage(view, { key: 't7', storage: window.localStorage });
      flushSync();

      view.sort = { column: 'name', direction: 'asc' }; // the reader clicks a header
      flushSync();

      // Debounced: nothing lands synchronously…
      expect(window.localStorage.getItem(VIEW_KEY('t7'))).toBeNull();
      vi.advanceTimersByTime(600);
      // …and the write carries only the changed axis.
      expect(stored('t7')).toEqual({ sort: { column: 'name', direction: 'asc' } });
    });
    cleanup();

    // Session 2: the stored sort wins over the unchanged defaults.
    session('t7', { sort: { column: 'age', direction: 'desc' } }, (view) => {
      expect(view.sort).toEqual({ column: 'name', direction: 'asc' });
    });
  });

  it('clearing the sort survives a reload instead of re-seeding (end to end)', () => {
    // Session 1: the reader clears the default sort. "No sort" is a value, and
    // the write path must store it even though nothing was stored before —
    // the old dedup-baseline blind spot, reformulated: writes key off the
    // reader's origin, not off a value-vs-baseline diff.
    session('t8', { sort: { column: 'age', direction: 'desc' } }, (view) => {
      view.sort = null;
    });
    expect(stored('t8')).toEqual({ sort: null });

    // Session 2: same defaults — the cleared sort wins.
    session('t8', { sort: { column: 'age', direction: 'desc' } }, (view) => {
      expect(view.sort).toBeNull();
    });
  });

  it('clearing every filter survives a reload instead of re-seeding (end to end)', () => {
    const seedFilters: Filter[] = [{ column: 'name', operator: 'contains', value: 'ali' }];

    session('t9', { filters: seedFilters }, (view) => {
      expect(view.filters).toEqual(seedFilters);
      view.filters = [];
    });
    expect(stored('t9')).toEqual({ filters: [] });

    session('t9', { filters: seedFilters }, (view) => {
      expect(view.filters).toEqual([]);
    });
  });

  it("pageSize is persisted — yesterday's page size is still set", () => {
    // Deliberate delta against v7, where no pagination value was persisted at
    // all: pageSize is squarely the storage binding's promise.
    session('t10', {}, (view) => {
      view.pageSize = 50;
    });
    expect(stored('t10')).toEqual({ pageSize: 50 });

    session('t10', {}, (view) => {
      expect(view.pageSize).toBe(50);
    });
  });

  it('page is NOT persisted by default — page 1 on navigation is intentional UX', () => {
    session('t11', {}, (view) => {
      view.page = 3;
    });

    // `page` is not among the default axes, so its change never even dirties
    // the binding: no entry is created at all.
    expect(window.localStorage.getItem(VIEW_KEY('t11'))).toBeNull();
  });

  it("an external application is never written — someone else's link stores nothing", () => {
    session('t12', {}, (view) => {
      view.applyExternal({ search: 'from a shared link' }, 'external');
      expect(view.search).toBe('from a shared link');
    });

    expect(window.localStorage.getItem(VIEW_KEY('t12'))).toBeNull();
  });

  it('the search term round-trips like every other axis', () => {
    session('t13', {}, (view) => {
      view.search = 'typed by the reader';
    });
    expect(stored('t13')).toEqual({ search: 'typed by the reader' });

    session('t13', {}, (view) => {
      expect(view.search).toBe('typed by the reader');
    });
  });

  it('groupBy: a stored key wins over the defaults, and ungrouping sticks', () => {
    window.localStorage.setItem(VIEW_KEY('t14'), JSON.stringify({ groupBy: 'name' }));

    session('t14', { groupBy: 'department' }, (view) => {
      expect(view.groupBy).toBe('name');
      view.groupBy = null; // the reader ungroups
    });
    expect(stored('t14')).toEqual({ groupBy: null });

    session('t14', { groupBy: 'department' }, (view) => {
      expect(view.groupBy).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Prefs axes: TablePrefsConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construct a store the way `TableProvider` does: inside an effect root, and
 * then apply what storage supplied.
 *
 * The store no longer writes stored values into state during construction,
 * because storage exists only in the browser and applying it there put the
 * client's first render out of step with the server's HTML. Hydration is an
 * explicit post-mount step, so a test that wants the restored preferences has
 * to take it — exactly like the provider's `$effect` does.
 */
function withRoot<T extends { applyPersistedState: () => void }>(fn: () => T): T {
  let result!: T;
  const cleanup = $effect.root(() => {
    result = fn();
    // Typed rather than optional-called: an optional call would turn this whole
    // helper into a silent no-op the day the method is renamed, and every test
    // below would keep passing while measuring construction alone.
    result.applyPersistedState();
  });
  cleanup();
  return result;
}

describe('prefs: summaries vs prefs.defaults.summaries', () => {
  const seedSummaries: SummaryConfig[] = [{ column: 'age', type: 'sum' }];

  it('persisted summary configs win over the defaults', () => {
    const persisted: SummaryConfig[] = [{ column: 'salary', type: 'avg' }];
    window.localStorage.setItem(SUMMARY_KEY('t11'), JSON.stringify(persisted));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't11', defaults: { summaries: seedSummaries } })
    );

    expect(ts.state.summaryConfigs).toEqual(persisted);
    expect(ts.state.showSummary).toBe(true);
  });

  it('a persisted empty summary set beats the defaults and keeps the row hidden', () => {
    window.localStorage.setItem(SUMMARY_KEY('t13'), JSON.stringify([]));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't13', defaults: { summaries: seedSummaries } })
    );

    expect(ts.state.summaryConfigs).toEqual([]);
    expect(ts.state.showSummary).toBe(false);
  });

  it('a corrupt summary entry is treated as absent — the defaults apply', () => {
    window.localStorage.setItem(SUMMARY_KEY('t14'), '[[');

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't14', defaults: { summaries: seedSummaries } })
    );

    expect(ts.state.summaryConfigs).toEqual(seedSummaries);
    expect(ts.state.showSummary).toBe(true);
  });

  it('removing every summary survives a reload instead of re-seeding (end to end)', () => {
    const persisted: SummaryConfig[] = [{ column: 'salary', type: 'avg' }];
    window.localStorage.setItem(SUMMARY_KEY('t15'), JSON.stringify(persisted));

    const first = withRoot(() =>
      createTableState(undefined, { storage: 't15', defaults: { summaries: seedSummaries } })
    );
    expect(first.state.summaryConfigs).toEqual(persisted);
    first.removeSummaryConfig('salary');
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SUMMARY_KEY('t15')) ?? 'null')).toEqual([]);

    const second = withRoot(() =>
      createTableState(undefined, { storage: 't15', defaults: { summaries: seedSummaries } })
    );
    expect(second.state.summaryConfigs).toEqual([]);
    expect(second.state.showSummary).toBe(false);
  });

  it('an in-place summary edit reaches storage', () => {
    // `addSummaryConfig` mutates the array in place for an existing column, so
    // syncing the live reference back would be no signal change at all — the
    // edit would never be written. The syncs pass snapshots for that reason.
    const ts = withRoot(() => createTableState(undefined, { storage: 'fresh3' }));
    ts.addSummaryConfig({ column: 'age', type: 'sum' });
    ts.forceSavePersistentData();
    ts.addSummaryConfig({ column: 'age', type: 'avg' });
    ts.forceSavePersistentData();

    expect(JSON.parse(window.localStorage.getItem(SUMMARY_KEY('fresh3')) ?? 'null')).toEqual([
      { column: 'age', type: 'avg' }
    ]);
  });
});

describe('prefs: selection vs the selection seed', () => {
  it('a persisted selection (persistSelection: true) wins over the seed', () => {
    window.localStorage.setItem(SELECTION_KEY('t6'), JSON.stringify([5]));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't6', persistSelection: true }, undefined, {
        selectedIds: [1, 2]
      })
    );

    expect([...ts.state.selectedIds]).toEqual([5]);
  });

  it('without persistSelection stale storage is ignored and the seed applies', () => {
    window.localStorage.setItem(SELECTION_KEY('t7'), JSON.stringify([5]));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't7' }, undefined, { selectedIds: [1, 2] })
    );

    expect([...ts.state.selectedIds]).toEqual([1, 2]);
  });

  it('a persisted empty selection beats the seed — deselecting stays deselected', () => {
    window.localStorage.setItem(SELECTION_KEY('t8b'), JSON.stringify([]));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't8b', persistSelection: true }, undefined, {
        selectedIds: [1, 2]
      })
    );

    expect([...ts.state.selectedIds]).toEqual([]);
  });

  it('a corrupt selection entry is treated as absent — the seed applies', () => {
    window.localStorage.setItem(SELECTION_KEY('t8c'), 'nope');

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't8c', persistSelection: true }, undefined, {
        selectedIds: [1, 2]
      })
    );

    expect([...ts.state.selectedIds]).toEqual([1, 2]);
  });

  it('drops malformed row-id elements instead of hydrating them', () => {
    window.localStorage.setItem(SELECTION_KEY('t8e'), JSON.stringify([5, {}, null, 'a', [7]]));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't8e', persistSelection: true })
    );

    expect([...ts.state.selectedIds]).toEqual([5, 'a']);
  });

  it('a controlled selection never reaches storage — the persisted value survives', () => {
    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't8', persistSelection: true }, undefined, {
        selectedIds: [1]
      })
    );
    // The seeded selection is written once the user is considered to own it —
    // here forced through a real selection action.
    ts.state.selectionMode = 'multi';
    ts.setSelectedIds([1]);
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

  it('deselecting everything survives a reload instead of re-seeding (end to end)', () => {
    window.localStorage.setItem(SELECTION_KEY('t8d'), JSON.stringify([5]));

    const first = withRoot(() =>
      createTableState(undefined, { storage: 't8d', persistSelection: true }, undefined, {
        selectedIds: [1, 2]
      })
    );
    expect([...first.state.selectedIds]).toEqual([5]);
    first.setSelectedIds([]);
    first.forceSavePersistentData();
    expect(JSON.parse(window.localStorage.getItem(SELECTION_KEY('t8d')) ?? 'null')).toEqual([]);

    const second = withRoot(() =>
      createTableState(undefined, { storage: 't8d', persistSelection: true }, undefined, {
        selectedIds: [1, 2]
      })
    );
    expect([...second.state.selectedIds]).toEqual([]);
  });
});

describe('prefs: column visibility and order vs prefs.defaults', () => {
  it('default-hidden columns hide at construction, a stored set replaces them after hydration', () => {
    window.localStorage.setItem(HIDDEN_KEY('h1'), JSON.stringify(['email']));

    const cleanup = $effect.root(() => {
      const ts = createTableState(
        undefined,
        { storage: 'h1', defaults: { hiddenColumns: ['age'] } },
        { columns: () => COLUMNS }
      );
      // Construction (= the server HTML): the deterministic default applies…
      expect(ids(ts.state.columns)).toEqual(['name', 'email']);

      ts.applyPersistedState();
      // …and the stored value replaces it after hydration.
      expect(ids(ts.state.columns)).toEqual(['name', 'age']);
    });
    cleanup();
  });

  it('a stored EMPTY hidden set beats the default — un-hiding stays un-hidden', () => {
    window.localStorage.setItem(HIDDEN_KEY('h2'), JSON.stringify([]));

    const ts = withRoot(() =>
      createTableState(
        undefined,
        { storage: 'h2', defaults: { hiddenColumns: ['age'] } },
        { columns: () => COLUMNS }
      )
    );

    expect(ids(ts.state.columns)).toEqual(['name', 'age', 'email']);
  });

  it('a stored column order wins over the default order', () => {
    window.localStorage.setItem(ORDER_KEY('o1'), JSON.stringify(['age', 'email', 'name']));

    const ts = withRoot(() =>
      createTableState(
        undefined,
        { storage: 'o1', defaults: { columnOrder: ['email', 'name', 'age'] } },
        { columns: () => COLUMNS }
      )
    );

    expect(ts.orderedColumns.map((c) => c.accessor)).toEqual(['age', 'email', 'name']);
  });
});

describe('storage hygiene: only reader actions create entries', () => {
  it('a table nobody touched leaves every key absent — including seeded defaults', () => {
    // The v8 sharpening of the old rule: not only untouched axes stay absent,
    // the prefs *defaults* are no longer synced into storage either. Writing
    // them would make "an entry exists" meaningless — an axis nobody ever set
    // would then look exactly like a cleared one, and a deploy with new
    // defaults could never reach returning readers.
    const ts = withRoot(() =>
      createTableState(
        undefined,
        {
          storage: 't16',
          persistSelection: true,
          defaults: { summaries: [{ column: 'age', type: 'sum' }], hiddenColumns: ['age'] }
        },
        { columns: () => COLUMNS }
      )
    );
    expect(ts.state.summaryConfigs).toHaveLength(1);
    ts.forceSavePersistentData();

    for (const keyOf of [SUMMARY_KEY, HIDDEN_KEY, ORDER_KEY, SELECTION_KEY]) {
      expect(window.localStorage.getItem(keyOf('t16'))).toBe(null);
    }
  });

  it('a reader action writes its axis, the untouched axes stay absent', () => {
    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't17' }, { columns: () => COLUMNS })
    );
    ts.hideColumn('age');
    ts.forceSavePersistentData();

    expect(JSON.parse(window.localStorage.getItem(HIDDEN_KEY('t17')) ?? 'null')).toEqual(['age']);
    expect(window.localStorage.getItem(SUMMARY_KEY('t17'))).toBe(null);
    expect(window.localStorage.getItem(ORDER_KEY('t17'))).toBe(null);
  });

  it('the dead v7 view-axis keys are no longer read', () => {
    // Sort/filters/groupBy/search moved to the view object; their old per-axis
    // entries must not leak back into a v8 table through the prefs channel.
    window.localStorage.setItem(
      SORT_KEY('t19'),
      JSON.stringify({ column: 'age', direction: 'desc' })
    );
    window.localStorage.setItem(
      FILTERS_KEY('t19'),
      JSON.stringify([{ column: 'name', operator: 'contains', value: 'a' }])
    );
    window.localStorage.setItem(GROUP_KEY('t19'), JSON.stringify('name'));

    const ts = withRoot(() =>
      createTableState(undefined, { storage: 't19' }, { columns: () => COLUMNS })
    );

    expect(ts.view.sort).toBeNull();
    expect(ts.view.filters).toEqual([]);
    expect(ts.state.effectiveGroupBy).toBeNull();
  });

  it('clearAllPersistentData removes the entries for good', () => {
    window.localStorage.setItem(
      SUMMARY_KEY('t18'),
      JSON.stringify([{ column: 'age', type: 'sum' }])
    );

    const ts = withRoot(() => createTableState(undefined, { storage: 't18' }));
    ts.clearAllPersistentData();
    // Neither the reset itself nor the auto-save it triggers may re-create it.
    ts.forceSavePersistentData();

    expect(window.localStorage.getItem(SUMMARY_KEY('t18'))).toBe(null);
  });
});
