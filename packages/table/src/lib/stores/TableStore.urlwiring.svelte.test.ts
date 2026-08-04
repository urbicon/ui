// @vitest-environment jsdom
import {
  searchParamsToTableQuery,
  searchParamsToTableViewState,
  type TableQueryViewState
} from '@urbicon-ui/sveltekit-utils/table-query';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Column, TableItem } from '$lib';
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
  searchParamsToTableViewState(new URLSearchParams(search)) as TableViewState;

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
        query: () => ({ sortDirection: 'desc' }) as TableViewState
      });
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
      query: () => v as TableViewState
    });
    expect(store.state.searchTerm).toBe('a');
    expect(store.state.itemsPerPage).toBe(2);
    expect(store.state.groupByKey).toBe('name');
  });
});
