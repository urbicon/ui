// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Column, Filter, TableItem } from '$lib';
import { createTableState } from './TableStore.svelte';

/**
 * Controlled view state — the `query` prop (#152).
 *
 * View state kept only in `localStorage` is invisible to the server, so since
 * #10 made the server render real rows a persisted sort produces one order on
 * the server and another on the client. Putting the same state in the URL and
 * handing it in as a prop removes the divergence by construction: the value is
 * a derived, so it resolves during SSR exactly as it does in the browser.
 *
 * The precedence these tests pin is **URL > localStorage > `initial*` seed**,
 * per axis, by field presence — the rule `searchControlled` already applied to
 * `searchTerm`, generalised.
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

const SORT_KEY = (id: string) => `urbicon_table_sort_${id}_v1`;

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage(),
    configurable: true
  });
});

describe('query — the controlled axes resolve without a tracking context', () => {
  // Reading outside an effect IS the SSR situation. Every assertion here would
  // have been unreachable on the server while these axes were plain `$state`
  // written by persistence at construction.
  it('sorts from the query, on the server path', () => {
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      query: () => ({ sortColumn: 'name', sortDirection: 'asc' })
    });

    expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);
  });

  it('searches from the query', () => {
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      query: () => ({ searchTerm: 'ada' })
    });

    expect(names(store.paginatedItems)).toEqual(['Ada']);
  });

  it('pages from the query', () => {
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      query: () => ({ page: 2, itemsPerPage: 2 })
    });

    expect(names(store.paginatedItems)).toEqual(['Barbara']);
  });

  it('filters from the query', () => {
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      // `contains: 'a'` would match all three rows in input order, so the
      // assertion below would hold with no filtering at all. The filter has to
      // exclude something to measure anything.
      query: () => ({
        activeFilters: [{ column: 'name', operator: 'contains', value: 'ra' }] as Filter[]
      })
    });

    expect(store.state.activeFilters).toHaveLength(1);
    expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara']);
  });

  it('follows the query when it changes — the back button, not a remount', () => {
    let view = $state<{ sortColumn?: string }>({ sortColumn: 'name' });
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      query: () => view
    });
    expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);

    view = { sortColumn: 'amount' };
    expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara', 'Ada']);
  });

  it('an absent field leaves its axis alone', () => {
    // Per-field ownership: a query that only carries a page must not silently
    // clear a sort the seed supplied.
    const store = createTableState(
      undefined,
      { sort: { column: 'name', direction: 'asc' } },
      { items: () => ITEMS, columns: () => COLUMNS, query: () => ({ page: 1 }) }
    );

    expect(store.state.sortColumn).toBe('name');
  });
});

describe('query — precedence over storage and seed', () => {
  it('outranks a persisted sort, and does not overwrite it in storage', () => {
    window.localStorage.setItem(
      SORT_KEY('t-url'),
      JSON.stringify({ column: 'amount', direction: 'desc' })
    );

    const cleanup = $effect.root(() => {
      const store = createTableState({ tableId: 't-url' }, undefined, {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => ({ sortColumn: 'name', sortDirection: 'asc' })
      });

      expect(store.state.sortColumn).toBe('name');
      expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);
    });
    cleanup();

    // The stored value survives untouched. Writing the controlled value over it
    // would resurface as a surprise the moment the table stopped being
    // controlled — the same reasoning `syncSearch` already applied to a
    // controlled `searchTerm`.
    expect(JSON.parse(window.localStorage.getItem(SORT_KEY('t-url')) ?? 'null')).toEqual({
      column: 'amount',
      direction: 'desc'
    });
  });

  it('outranks an initialSort seed', () => {
    const store = createTableState(
      undefined,
      { sort: { column: 'amount', direction: 'desc' } },
      {
        items: () => ITEMS,
        columns: () => COLUMNS,
        query: () => ({ sortColumn: 'name', sortDirection: 'asc' })
      }
    );

    expect(store.state.sortColumn).toBe('name');
  });

  it('an explicitly empty query axis stays empty — no seed slips past it', () => {
    // The case the `hydrated*` flag has to cover: `?sort=` elided from the URL
    // means "no sort", which is a real state. Reading it as "nothing supplied"
    // would let the seed apply and silently sort a view the reader cleared.
    const store = createTableState(
      undefined,
      { sort: { column: 'amount', direction: 'desc' } },
      { items: () => ITEMS, columns: () => COLUMNS, query: () => ({ sortColumn: '' }) }
    );

    expect(store.state.sortColumn).toBe('');
    expect(names(store.paginatedItems)).toEqual(['Ada', 'Grace', 'Barbara']);
  });
});

describe('query — grouping keeps its gate', () => {
  it('a grouping key from the query is refused on a virtualized table', () => {
    // `setGroupByKey` has gated every imperative path into grouping since
    // grouped virtualization does not exist: a key that slips through
    // deactivates virtualization and renders the FULL item set. A URL is one
    // more path, and the most dangerous one — nobody had to click anything.
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      virtualized: () => true,
      query: () => ({ groupByKey: 'name' })
    });

    expect(store.state.groupByKey).toBeNull();
  });

  it('and accepted when the table is not virtualized', () => {
    const store = createTableState(undefined, undefined, {
      items: () => ITEMS,
      columns: () => COLUMNS,
      query: () => ({ groupByKey: 'name' })
    });

    expect(store.state.groupByKey).toBe('name');
  });
});
