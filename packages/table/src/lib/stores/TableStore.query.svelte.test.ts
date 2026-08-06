import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Column, Filter, TableItem } from '$lib';
import { createTableView } from '$lib/view/view.svelte';
import { createTableState } from './TableStore.svelte';

/**
 * The view object as the store's single view-state surface (#152, v8).
 *
 * View state kept only in `localStorage` is invisible to the server, so since
 * #10 made the server render real rows a persisted sort produced one order on
 * the server and another on the client. In v8 the same state lives in the
 * consumer-constructed view object: a binding applies a URL's values through
 * `applyExternal` *before* the store is built, the store's six state axes are
 * pass-throughs onto the view — so the linked view resolves during SSR exactly
 * as in the browser, with no `query` prop and no per-axis ownership flags.
 *
 * Reading outside an effect IS the SSR situation. Every assertion here would
 * have been unreachable on the server while these axes were plain `$state`
 * written by persistence at construction.
 */

// Node env, no component context: TableView construction warns there (the
// module-scope-view guard) and the virtualized-grouping gate DEV-warns too.
// Both correct in production, noise here.
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

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

/** A view the way the URL binding leaves it at init: values applied as `external`. */
function linkedView(partial: Parameters<ReturnType<typeof createTableView>['applyExternal']>[0]) {
  const view = createTableView();
  view.applyExternal(partial, 'external');
  return view;
}

describe('view — externally applied axes resolve without a tracking context', () => {
  it('sorts from the linked view, on the server path', () => {
    const store = createTableState(
      linkedView({ sort: { column: 'name', direction: 'asc' } }),
      undefined,
      { source: () => ITEMS, columns: () => COLUMNS }
    );

    expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);
  });

  it('searches from the linked view', () => {
    const store = createTableState(linkedView({ search: 'ada' }), undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    expect(names(store.paginatedItems)).toEqual(['Ada']);
  });

  it('pages from the linked view', () => {
    const store = createTableState(linkedView({ page: 2, pageSize: 2 }), undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    expect(names(store.paginatedItems)).toEqual(['Barbara']);
  });

  it('filters from the linked view', () => {
    // `contains: 'a'` would match all three rows in input order, so the
    // assertion below would hold with no filtering at all. The filter has to
    // exclude something to measure anything.
    const store = createTableState(
      linkedView({ filters: [{ column: 'name', operator: 'contains', value: 'ra' }] as Filter[] }),
      undefined,
      { source: () => ITEMS, columns: () => COLUMNS }
    );

    expect(store.state.activeFilters).toHaveLength(1);
    expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara']);
  });

  it('follows a later application — the back button, not a remount', () => {
    // SvelteKit does not remount the page component when only the query
    // string changes; the URL binding calls `applyExternal` on the SAME view.
    const view = linkedView({ sort: { column: 'name', direction: 'asc' } });
    const store = createTableState(view, undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });
    expect(names(store.paginatedItems)).toEqual(['Ada', 'Barbara', 'Grace']);

    // `amount desc` would be Ada/Barbara/Grace — the same visible order as
    // name-asc, so it could not fail. Ascending moves every row.
    view.applyExternal({ sort: { column: 'amount', direction: 'asc' } }, 'external');
    expect(names(store.paginatedItems)).toEqual(['Grace', 'Barbara', 'Ada']);
  });

  it('an absent axis in a partial application leaves that axis alone', () => {
    // Per-axis application: a URL that only names a page must not silently
    // clear a sort the view's defaults supplied.
    const view = createTableView({ defaults: { sort: { column: 'name', direction: 'asc' } } });
    view.applyExternal({ page: 2 }, 'external');
    const store = createTableState(view, undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    expect(store.state.currentPage).toBe(2);
    expect(store.state.sortColumn).toBe('name');
  });

  it('an explicitly applied "unsorted" beats the defaults — no seed slips past it', () => {
    // `sort: null` is a value, not a sentinel: `?sort=` in a URL means "no
    // sort", which is a real state the reader chose. Treating it as "nothing
    // supplied" would let the defaults sort a view the reader cleared.
    const view = createTableView({ defaults: { sort: { column: 'amount', direction: 'desc' } } });
    view.applyExternal({ sort: null }, 'external');
    const store = createTableState(view, undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    expect(store.state.sortColumn).toBe('');
    expect(names(store.paginatedItems)).toEqual(['Ada', 'Grace', 'Barbara']);
  });
});

describe('view — the six state axes are pass-throughs onto the view', () => {
  // The v8 equivalence contract: writing through `state` or through `view`
  // is the same write (`user` origin), and both read the same signal. A
  // sabotage that decouples one axis — a stray local `$state` shadowing the
  // view — turns exactly one of these red.
  it('state writes land on the view, view writes land on the state', () => {
    const view = createTableView();
    const store = createTableState(view, undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });
    expect(store.view).toBe(view);

    store.state.searchTerm = 'gr';
    expect(view.search).toBe('gr');
    view.search = '';
    expect(store.state.searchTerm).toBe('');

    store.state.activeFilters = [{ column: 'name', operator: 'contains', value: 'a' }] as Filter[];
    expect(view.filters).toHaveLength(1);

    store.state.currentPage = 3;
    expect(view.page).toBe(3);
    view.page = 1;
    expect(store.state.currentPage).toBe(1);

    store.state.itemsPerPage = 25;
    expect(view.pageSize).toBe(25);

    store.state.sortColumn = 'name';
    expect(view.sort).toEqual({ column: 'name', direction: 'asc' });
    store.state.sortDirection = 'desc';
    expect(view.sort).toEqual({ column: 'name', direction: 'desc' });
    view.sort = null;
    expect(store.state.sortColumn).toBe('');

    store.state.groupByKey = 'name';
    expect(view.groupBy).toBe('name');
    view.groupBy = null;
    expect(store.state.groupByKey).toBeNull();
  });

  it('clearing the sort column clears the whole sort', () => {
    const store = createTableState(
      createTableView({ defaults: { sort: { column: 'name', direction: 'desc' } } }),
      undefined,
      { source: () => ITEMS, columns: () => COLUMNS }
    );

    store.state.sortColumn = '';
    expect(store.view.sort).toBeNull();
    expect(store.state.sortDirection).toBe('asc');
  });

  it('a direction write on an unsorted view is a no-op', () => {
    // Deliberate v8 delta: an unsorted view has no direction (the serializers
    // normalize it away the same way), so `sortDirection = 'desc'` without an
    // active sort changes nothing instead of storing a dangling direction.
    const store = createTableState(undefined, undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    store.state.sortDirection = 'desc';
    expect(store.view.sort).toBeNull();
    expect(store.state.sortColumn).toBe('');
    expect(store.state.sortDirection).toBe('asc');

    // With a sort active, the same write applies.
    store.state.sortColumn = 'name';
    store.state.sortDirection = 'desc';
    expect(store.view.sort).toEqual({ column: 'name', direction: 'desc' });
  });
});

describe('view — grouping keeps its gate', () => {
  it('a grouping key from the view is refused on a virtualized table', () => {
    // Grouped virtualization does not exist: a key that slips through
    // deactivates virtualization and renders the FULL item set. The read-side
    // gate on `state.groupByKey` holds during SSR too — a `?group=…` deep
    // link on a virtualized table renders ungrouped on the server. (The
    // runtime *discard* — cleaning the URL via a `system` write — is
    // `TableProvider`'s half, not the store's.)
    const store = createTableState(linkedView({ groupBy: 'name' }), undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS,
      virtualized: () => true
    });

    expect(store.state.groupByKey).toBeNull();
    expect(store.grouped).toHaveProperty('ungrouped');
  });

  it('and accepted when the table is not virtualized', () => {
    const store = createTableState(linkedView({ groupBy: 'name' }), undefined, {
      source: () => ITEMS,
      columns: () => COLUMNS
    });

    expect(store.state.groupByKey).toBe('name');
  });
});
