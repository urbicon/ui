// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Column, TableItem } from '$lib';
import { bindViewToStorage } from '$lib/view/storage-binding.svelte';
import {
  createTableView,
  type TableView,
  type TableViewSnapshot,
  type ViewAxis
} from '$lib/view/view.svelte';
import { createTableState } from './TableStore.svelte';

/**
 * The view wiring, connected — what replaced the v7 `query`-prop model.
 *
 * In v7 a URL binding handed the parsed query into the store through a
 * controlled prop, and per-axis ownership flags (`persistControlled`,
 * `hydrated*`) arbitrated URL vs storage vs seed. In v8 the view object IS
 * the single surface: the URL binding applies its values through
 * `applyExternal` + `markInitApplied` before the store is built, the storage
 * binding decorates the same object, and precedence falls out of two facts —
 * an init-applied axis is claimed (URL > storage), and an axis is written to
 * storage only when its LAST change was the reader's own (`user` origin).
 *
 * This suite covers the store-level half: a deep-linked view resolves
 * synchronously, and the binding matrix (no binding / storage only /
 * init-claim + storage). The `svelte/server` render of a deep-linked view
 * lives in `core/Table.ssr.test.ts` — the server build has no working
 * `$effect.root`, and the browser build (which this jsdom file resolves)
 * cannot server-render, so the two halves cannot share a file. The real URL
 * binding (goto, back button, SvelteKit wiring) is
 * `@urbicon-ui/sveltekit-utils`' to test, not this package's.
 */

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount' }
] as Column[];

const ITEMS = [
  { id: 1, name: 'Ada', amount: 300 },
  { id: 2, name: 'Grace', amount: 100 },
  { id: 3, name: 'Barbara', amount: 200 }
] as TableItem[];

const names = (rows: TableItem[]) => rows.map((r) => r.name);

/**
 * What the URL binding does at init, synchronously, before the table exists:
 * apply the axes the URL names and record that it did.
 */
function deepLink(partial: Partial<TableViewSnapshot>): TableView {
  const view = createTableView();
  view.applyExternal(partial, 'external');
  view.markInitApplied(Object.keys(partial) as ViewAxis[]);
  return view;
}

describe('a deep-linked view renders synchronously', () => {
  it('the store shows the linked sort with no effect having run', () => {
    const store = createTableState(
      deepLink({ sort: { column: 'amount', direction: 'asc' } }),
      undefined,
      { source: () => ITEMS, columns: () => COLUMNS }
    );

    // No flush, no root, no tracking context — read the way the first
    // (hydrating) render reads.
    expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara', 'Ada']);
  });

  it('every axis of a shared link lands at once', () => {
    const store = createTableState(
      deepLink({
        search: 'a',
        page: 1,
        pageSize: 2,
        sort: { column: 'amount', direction: 'desc' },
        groupBy: 'name'
      }),
      undefined,
      { source: () => ITEMS, columns: () => COLUMNS }
    );

    expect(store.state.searchTerm).toBe('a');
    expect(store.state.itemsPerPage).toBe(2);
    expect(store.state.sortColumn).toBe('amount');
    expect(store.state.sortDirection).toBe('desc');
    expect(store.state.groupByKey).toBe('name');
  });
});

describe('the binding matrix', () => {
  // The v7 matrix was query-wired × persistControlled; the v8 one is which
  // bindings decorate the view. Fake timers drive the storage binding's
  // 500 ms write debounce; writes are flushed BEFORE the root is torn down,
  // because the destroy teardown deliberately drops pending writes.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const memoryStore = () => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value)
    };
  };
  const KEY = 'urbicon_table_view_matrix_v1';

  it('no binding: the view is memory-only, nothing persists anywhere', () => {
    const storage = memoryStore();
    const view = createTableView();
    const store = createTableState(view, undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    store.setSort('amount', 'asc');
    store.setSearchTerm('a');
    vi.advanceTimersByTime(1000);

    expect(view.sort).toEqual({ column: 'amount', direction: 'asc' });
    expect(storage.map.size).toBe(0);
  });

  it("storage binding only: the reader's change is stored and a bare visit restores it", () => {
    const storage = memoryStore();

    // Visit 1: the reader sorts through the table.
    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'matrix', storage });
      const store = createTableState(view, undefined, {
        source: () => ITEMS,
        columns: () => COLUMNS
      });
      flushSync();

      store.setSort('amount', 'asc'); // a click, i.e. a `user` write
      flushSync();
      vi.advanceTimersByTime(600);
    });
    cleanup();

    expect(JSON.parse(storage.getItem(KEY) ?? 'null')).toEqual({
      sort: { column: 'amount', direction: 'asc' }
    });

    // Visit 2: no URL, same table — yesterday's view is still there.
    const cleanup2 = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'matrix', storage });
      const store = createTableState(view, undefined, {
        source: () => ITEMS,
        columns: () => COLUMNS
      });
      flushSync();

      expect(store.state.sortColumn).toBe('amount');
      expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara', 'Ada']);
    });
    cleanup2();
  });

  it('init claim + storage: the link wins over storage, and stores nothing', () => {
    const storage = memoryStore();
    storage.setItem(KEY, JSON.stringify({ sort: { column: 'amount', direction: 'desc' } }));

    const cleanup = $effect.root(() => {
      // What the URL binding does at init — before the storage binding's
      // apply effect ever runs.
      const view = deepLink({ sort: { column: 'name', direction: 'asc' } });
      bindViewToStorage(view, { key: 'matrix', storage });
      const store = createTableState(view, undefined, {
        source: () => ITEMS,
        columns: () => COLUMNS
      });
      flushSync(); // hydration: storage must keep off the init-applied axis

      expect(store.state.sortColumn).toBe('name');
      expect(store.state.sortDirection).toBe('asc');
      vi.advanceTimersByTime(1000);
    });
    cleanup();

    // Someone else's link stores nothing: the entry still holds the OLD
    // stored sort, not the URL's.
    expect(JSON.parse(storage.getItem(KEY) ?? 'null')).toEqual({
      sort: { column: 'amount', direction: 'desc' }
    });
  });

  it('storage still fills the axes the link did not name', () => {
    const storage = memoryStore();
    storage.setItem(
      KEY,
      JSON.stringify({ search: 'bar', sort: { column: 'amount', direction: 'desc' } })
    );

    const cleanup = $effect.root(() => {
      const view = deepLink({ sort: { column: 'name', direction: 'asc' } });
      bindViewToStorage(view, { key: 'matrix', storage });
      flushSync();

      // The init-applied sort is claimed by the link; the unclaimed search
      // hydrates from storage — deep-link precedence is per axis.
      expect(view.sort).toEqual({ column: 'name', direction: 'asc' });
      expect(view.search).toBe('bar');
    });
    cleanup();
  });

  it('back to a bare URL: the default wins over the stored value, and nothing is stored', () => {
    // The two storage rules, composed the way a reader actually meets them:
    // a stored search applies once after hydration; the back button then
    // lands on the bare URL, whose runtime rule is "absence on a bound axis
    // applies the default" (an `external` application of the full defaults —
    // exactly what the URL binding does on a foreign landing, projected the
    // same way `deepLink` projects its init). The default must win — storage
    // never applies again after init — and the back navigation must not be
    // stored as if the reader had cleared the search.
    //
    // Red seen: with the write effect's origin gate widened to also store
    // `external` applications, the stored entry was overwritten with the
    // default ('' instead of 'stored') — the second assertion failed.
    const storage = memoryStore();
    storage.setItem(KEY, JSON.stringify({ search: 'stored' }));

    const cleanup = $effect.root(() => {
      const view = createTableView();
      bindViewToStorage(view, { key: 'matrix', storage });
      flushSync(); // hydration: the stored search applies (no init claim)
      expect(view.search).toBe('stored');

      // The back button lands on the bare URL.
      view.applyExternal({ ...view.defaults }, 'external');
      flushSync();
      expect(view.search).toBe(''); // the default, not the storage value
      vi.advanceTimersByTime(1000); // let any (wrong) storage write fire
      expect(view.search).toBe(''); // and storage did not re-apply either
    });
    cleanup();

    // The back navigation wrote nothing: the entry still holds the reader's
    // own last change.
    expect(JSON.parse(storage.getItem(KEY) ?? 'null')).toEqual({ search: 'stored' });
  });

  it('after init, a reader change on a link-claimed axis is stored again', () => {
    // `markInitApplied` records a historical fact, not a permanent claim on
    // writes: once the reader re-sorts by hand, that IS their change and the
    // storage binding stores it.
    const storage = memoryStore();

    const cleanup = $effect.root(() => {
      const view = deepLink({ sort: { column: 'name', direction: 'asc' } });
      bindViewToStorage(view, { key: 'matrix', storage });
      const store = createTableState(view, undefined, {
        source: () => ITEMS,
        columns: () => COLUMNS
      });
      flushSync();

      store.setSort('amount', 'asc');
      flushSync();
      vi.advanceTimersByTime(600);
    });
    cleanup();

    expect(JSON.parse(storage.getItem(KEY) ?? 'null')).toEqual({
      sort: { column: 'amount', direction: 'asc' }
    });
  });
});
