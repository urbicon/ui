// @vitest-environment jsdom
import {
  searchParamsToTableQuery,
  searchParamsToTableViewState,
  type TableQueryViewState
} from '@urbicon-ui/sveltekit-utils/table-query';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Column, Filter, TableItem } from '$lib';
import type { TableViewState } from './TableStore.svelte';
import { createTableState } from './TableStore.svelte';

/**
 * The two halves of the URL wiring, connected — the test this feature shipped
 * without.
 *
 * `TableStore.query.svelte.test.ts` feeds the store hand-written partial
 * objects (`{ sortColumn: 'name' }`), and every one of them behaves. The
 * shipped producer does not produce that shape: `searchParamsToTableQuery`
 * fills **every** field from the resolved defaults, so on a URL with no
 * parameters at all it still answers `{page:1, itemsPerPage:10, sortColumn:'',
 * sortDirection:'asc', searchTerm:'', activeFilters:[], groupByKey:null}`.
 * Handed to `query`, that claims all seven axes: `persistenceConfig`,
 * `initialSort`, `initialFilters` and `initialGroupBy` switch themselves off,
 * silently, on every URL.
 *
 * That was the documented wiring. The fix is `searchParamsToTableViewState`,
 * which emits a key only for a param the URL carries — so the tests below are
 * the ones that keep the producer and the consumer talking about the same
 * thing. The type-level half lives in `types/tableQuery.parity.test.ts`.
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

/** The parsed URL, as the table receives it. */
const view = (search: string): TableViewState =>
  searchParamsToTableViewState(new URLSearchParams(search));

function memoryStorage(): Storage {
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
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
});

describe('the parsed URL, handed to `query`', () => {
  it('claims nothing when the URL says nothing', () => {
    // The regression this file exists for. `searchParamsToTableQuery` answers
    // all seven fields here, which is why it must not be what reaches `query`.
    expect(Object.keys(view(''))).toEqual([]);
    expect(Object.keys(searchParamsToTableQuery(new URLSearchParams()))).toHaveLength(7);
  });

  it('leaves the `initial*` seeds working on a clean URL', () => {
    const store = createTableState(
      undefined,
      {
        sort: { column: 'amount', direction: 'desc' },
        filters: [],
        groupBy: null
      },
      { items: () => ITEMS, columns: () => COLUMNS, query: () => view('') }
    );

    expect(store.state.sortColumn).toBe('amount');
    expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);
  });

  it('leaves persistence working on a clean URL', () => {
    window.localStorage.setItem(
      'urbicon_table_sort_t-clean_v1',
      JSON.stringify({ column: 'name', direction: 'asc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 't-clean' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => view('')
      });
      // The post-hydration step `TableProvider` performs in an `$effect`.
      // Storage is a client-only layer since #152, so nothing it holds reaches
      // state until this runs — which is what keeps the client's first render
      // in step with the server's HTML.
      store.applyPersistedState();
      expect(store.state.sortColumn).toBe('name');
      expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);
    });
    cleanup();
  });

  it('takes over only the axis the URL names, and leaves the seed on the others', () => {
    const store = createTableState(
      undefined,
      { sort: { column: 'amount', direction: 'desc' } },
      { items: () => ITEMS, columns: () => COLUMNS, query: () => view('?q=a&page=2') }
    );

    // Search and page come from the URL…
    expect(store.state.searchTerm).toBe('a');
    expect(store.state.currentPage).toBe(2);
    // …the sort still comes from the seed, because `?sort` is absent.
    expect(store.state.sortColumn).toBe('amount');
  });

  it('outranks a stored sort once the URL carries one', () => {
    window.localStorage.setItem(
      'urbicon_table_sort_t-url_v1',
      JSON.stringify({ column: 'amount', direction: 'desc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 't-url' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => view('?sort=name')
      });
      // Without the drain this measured the `query` derived alone and would
      // hold with persistence removed entirely — precedence needs both halves
      // present before it means anything.
      store.applyPersistedState();
      expect(store.state.sortColumn).toBe('name');
      expect(store.state.sortDirection).toBe('asc');
    });
    cleanup();

    // …without copying itself over the stored value.
    expect(
      JSON.parse(window.localStorage.getItem('urbicon_table_sort_t-url_v1') ?? 'null')
    ).toEqual({ column: 'amount', direction: 'desc' });
  });

  it('does not let a stored direction overwrite a controlled one', () => {
    // `sortColumn` and `sortDirection` are one axis across two fields. Keyed on
    // `sortColumn` alone, hydration wrote BOTH slots and flipped a controlled
    // `desc` back to the stored `asc`. Not reachable through the URL parser
    // (which emits the pair or neither) but reachable through the prop, whose
    // type allows it.
    window.localStorage.setItem(
      'urbicon_table_sort_t-dir_v1',
      JSON.stringify({ column: 'amount', direction: 'asc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 't-dir' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => ({ sortDirection: 'desc' as const })
      });
      // The drain is what makes this a test of `ownsSort()`: since hydration
      // became a deferred step, skipping it left the stored value on a queue
      // nobody read, and the assertion passed for the wrong reason.
      store.applyPersistedState();
      expect(store.state.sortDirection).toBe('desc');
    });
    cleanup();
  });

  it('re-reads the URL, so the back button returns the seeded view', () => {
    // What a captured `initialQuery` could never do: SvelteKit does not remount
    // the page component when only the query string changes, so a value parsed
    // once never sees the navigation.
    let search = $state('?sort=name');
    const store = createTableState(
      undefined,
      { sort: { column: 'amount', direction: 'desc' } },
      { items: () => ITEMS, columns: () => COLUMNS, query: () => view(search) }
    );
    expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);

    search = '';
    // `?sort` gone → the axis is uncontrolled again and the store's own value
    // stands. It is not sorted by name any more, which is the observable half.
    expect(store.state.sortColumn).toBe('');
  });

  it('parses a shared link into every axis at once', () => {
    const v: TableQueryViewState = searchParamsToTableViewState(
      new URLSearchParams('?q=a&page=1&size=2&sort=amount&dir=desc&group=name')
    );

    expect(v).toEqual({
      searchTerm: 'a',
      page: 1,
      itemsPerPage: 2,
      sortColumn: 'amount',
      sortDirection: 'desc',
      groupByKey: 'name'
    });

    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      query: () => v
    });
    expect(store.state.searchTerm).toBe('a');
    expect(store.state.itemsPerPage).toBe(2);
    expect(store.state.groupByKey).toBe('name');
  });
});

describe('persistence is a client-only layer', () => {
  // The rule the store follows since #152: storage is read at construction but
  // only *applied* after hydration, because it does not exist on the server.
  // Without that, a stored sort reordered the rows in the client's very first
  // render — measured against `Table.ssr.test.ts`, which renders Ada/Grace.

  it('does not reorder the first render, and does after hydration', () => {
    window.localStorage.setItem(
      'urbicon_table_sort_late_v1',
      JSON.stringify({ column: 'amount', direction: 'asc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 'late' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS
      });
      // What the server renders, and therefore what the client's first render
      // has to match: input order, nothing from storage.
      expect(store.state.sortColumn).toBe('');
      expect(names(store.paginatedItems)).toEqual(['Ada', 'Grace', 'Barbara']);

      store.applyPersistedState();

      expect(store.state.sortColumn).toBe('amount');
      expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara', 'Ada']);
    });
    cleanup();
  });

  it('still lets a stored empty axis beat the seed', () => {
    // Deferring the *application* must not defer the decision: the `hydrated*`
    // flags are still computed at construction, so a seed cannot fill an axis
    // that storage will supply as empty. Without that the seed would sort at
    // construction and storage would overwrite it a moment later — visible, and
    // for one frame simply wrong.
    window.localStorage.setItem(
      'urbicon_table_sort_cleared_v1',
      JSON.stringify({ column: '', direction: 'asc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState(
        { tableId: 'cleared' },
        { sort: { column: 'amount', direction: 'desc' } },
        { items: () => ITEMS, columns: () => COLUMNS }
      );
      expect(store.state.sortColumn).toBe('');
      store.applyPersistedState();
      expect(store.state.sortColumn).toBe('');
    });
    cleanup();
  });
});

describe('persistControlled — keeping a URL-controlled axis across a bare visit', () => {
  const FILTER_KEY = 'urbicon_table_filters_pc_v1';
  const aFilter = [{ column: 'name', operator: 'contains', value: 'ad' }] as Filter[];

  it('stores nothing even while the URL still lags behind the click', async () => {
    // The case a per-field ownership test cannot reach. `owns()` reads the live
    // URL, but the URL is written by a debounced `onQueryChange` and an async
    // `goto` — so at the instant a click runs `setSort`, a bare URL still says
    // "this axis is not controlled". Asking then let the FIRST change through
    // and blocked every later one: storage kept `amount`, the sort the reader
    // went on to abandon, and a later bare visit restored it.
    //
    // Everything here is deliberately synchronous around the setter, because
    // that is exactly the window the defect lived in.
    let urlSort = $state<string | undefined>(undefined);
    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 'lag' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: (): TableViewState => (urlSort ? { sortColumn: urlSort, sortDirection: 'asc' } : {})
      });
      store.applyPersistedState();
      store.setSort('amount', 'asc'); // click — the URL is still bare
      urlSort = 'amount'; // …and only now catches up
      store.setSort('name', 'asc'); // second click, now "controlled"
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    cleanup();

    expect(window.localStorage.getItem('urbicon_table_sort_lag_v1')).toBeNull();
  });

  it('stores nothing by default, so a bare visit restores nothing', async () => {
    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 'pc' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => ({ activeFilters: [] })
      });
      store.applyPersistedState();
      store.addFilter(aFilter[0]);
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    cleanup();

    expect(window.localStorage.getItem(FILTER_KEY)).toBeNull();
  });

  it('stores what the reader filtered, and hands it back on a bare visit', async () => {
    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 'pc', persistControlled: true }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => ({ activeFilters: [] })
      });
      store.applyPersistedState();
      store.addFilter(aFilter[0]);
    });
    // Past the 500 ms write debounce.
    await new Promise((resolve) => setTimeout(resolve, 700));
    cleanup();

    expect(JSON.parse(window.localStorage.getItem(FILTER_KEY) ?? 'null')).toEqual(aFilter);

    // Second visit, same page, no query params at all.
    const cleanup2 = $effect.root(() => {
      const store = createTableState({ tableId: 'pc', persistControlled: true }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => view('')
      });
      store.applyPersistedState();
      expect(store.state.activeFilters).toHaveLength(1);
      expect(names(store.paginatedItems)).toEqual(['Ada']);
    });
    cleanup2();
  });

  it('does not write when the reader only followed a link', async () => {
    // The reason unlocking the write is safe: storage is fed from the action
    // wrappers, never from a controlled value resolving. Someone else's filter
    // arriving through the URL must not become this reader's stored default.
    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 'pc', persistControlled: true }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => ({ activeFilters: aFilter })
      });
      store.applyPersistedState();
      expect(store.state.activeFilters).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    cleanup();

    expect(window.localStorage.getItem(FILTER_KEY)).toBeNull();
  });

  it('leaves the reading order alone — the link still wins over storage', async () => {
    window.localStorage.setItem(
      'urbicon_table_sort_pc2_v1',
      JSON.stringify({ column: 'amount', direction: 'desc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 'pc2', persistControlled: true }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => view('?sort=name')
      });
      store.applyPersistedState();
      expect(store.state.sortColumn).toBe('name');
    });
    cleanup();
  });
});
