// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { observeView } from '$lib/view/observe.svelte';
import { createTableView, type TableViewSnapshot } from '$lib/view/view.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * Node ≥ 25 ships a broken global `localStorage` stub that shadows jsdom's
 * Storage under vitest, so a test needing real storage semantics installs its
 * own — same reason and same shape as `TableStore.seed.persistence.svelte.test.ts`.
 */
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

/**
 * The mounted table — the counterpart to `Table.ssr.test.ts`.
 *
 * Until 2026-08 this package had no render environment at all: 254 tests, every one of
 * them node-env store/util/variant logic, nothing that ever put a table in a DOM (#150).
 * That is why #10 (SSR ingestion) and #14 (virtualized body in a second `<table>`) both
 * say "would land with no coverage on the axis it changes".
 *
 * These assertions are deliberately about the rendering contract rather than interaction
 * detail: that the rows arrive, that the header is a real `<th>` set, and — the pairing
 * with the SSR suite — that the client tree is correct *today*, which is what makes the
 * SSR failures a server-only defect rather than a broken table.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 },
  { id: 3, name: 'Radia', amount: 300 }
];

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(TableHarness, { target, props: { items: ROWS, ...props } }) as Record<
    string,
    unknown
  >;
  flushSync();
  return target;
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
});

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
});

describe('Table — mounted', () => {
  it('renders a row per item', () => {
    const el = mountTable();
    const bodyRows = el.querySelectorAll('tbody tr');

    expect(bodyRows.length).toBe(3);
    expect(el.textContent).toContain('Ada');
    expect(el.textContent).toContain('Radia');
  });

  it('renders the columns as header cells', () => {
    mountTable();
    const headers = screen.getAllByRole('columnheader');
    const labels = headers.map((h) => h.textContent?.trim());

    expect(labels.some((l) => l?.includes('Name'))).toBe(true);
    expect(labels.some((l) => l?.includes('Amount'))).toBe(true);
  });

  it('exposes the table with its accessible name', () => {
    mountTable();
    expect(screen.getByRole('table', { name: 'Test table' })).toBeTruthy();
  });

  it('shows the empty state for an empty item list', () => {
    const el = mountTable({ items: [], noDataText: 'Nothing here' });
    expect(el.textContent).toContain('Nothing here');
  });

  it('paginates to viewDefaults.pageSize', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Person ${i}`,
      amount: i
    }));
    // 5, deliberately NOT the view's own default of 10 — with 10 this held
    // even when the prop never reached the store.
    const el = mountTable({ items: many, viewDefaults: { pageSize: 5 } });

    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    expect(el.textContent).toContain('Person 0');
    expect(el.textContent).not.toContain('Person 5');
  });

  it('a later items prop reaches the rendered rows', () => {
    const props = $state({ items: ROWS });
    target = document.createElement('div');
    document.body.appendChild(target);
    comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
    flushSync();
    expect(target.querySelectorAll('tbody tr').length).toBe(3);

    props.items = [...ROWS, { id: 4, name: 'Barbara', amount: 400 }];
    flushSync();
    expect(target.querySelectorAll('tbody tr').length).toBe(4);
    expect(target.textContent).toContain('Barbara');
  });
});

describe('Table — the view object, mounted', () => {
  // The gap #152 names, in its v8 shape: a client-mode table's view changes
  // used to be observable only through the server-mode query emission, so a
  // URL sync had nothing to listen to. Now the view object is the surface —
  // `observeView` replaces `onQueryChange`, and a binding applies deep links
  // through `applyExternal` before the table mounts.
  //
  // `observeView` fires synchronously once, then debounced (default 300 ms) —
  // so the change assertions await real time, like the emission tests did.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('observeView emits the initial snapshot once, synchronously', async () => {
    const view = createTableView();
    const seen: TableViewSnapshot[] = [];
    mountTable({ view });

    const cleanup = $effect.root(() => {
      observeView(view, (snapshot) => seen.push(snapshot));
    });
    flushSync();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ page: 1, sort: null, search: '', groupBy: null });
    await tick();
    expect(seen).toHaveLength(1);
    cleanup();
  });

  it('a change made through the table reaches the observer', async () => {
    // The whole loop: the table's own interaction path (setSearchTerm, i.e.
    // what the SmartFilterBar calls) writes into the view, and an observer on
    // the view sees it — no `onQueryChange` prop involved.
    const view = createTableView();
    const seen: TableViewSnapshot[] = [];
    let ctx: TableContext | undefined;
    mountTable({ view, onReady: (c: TableContext) => (ctx = c) });

    const cleanup = $effect.root(() => {
      observeView(view, (snapshot) => seen.push(snapshot));
    });
    flushSync();
    expect(seen).toHaveLength(1);

    ctx?.setSearchTerm('ada');
    flushSync();
    // Past the default 300 ms debounce.
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toMatchObject({ search: 'ada' });
    cleanup();
  });

  it('keeps the page a deep link asked for across mount', () => {
    // The client half of an SSR/client agreement. `setSearchTerm` used to
    // reset the page unconditionally, so `?page=2&q=…` rendered page 2 on the
    // server and snapped to page 1 the moment the browser took over. The
    // view arrives with the link applied; mounting must not reset it.
    const view = createTableView();
    view.applyExternal({ page: 2, pageSize: 1 }, 'external');
    view.markInitApplied(['page', 'pageSize']);

    const el = mountTable({ view });
    const body = el.querySelector('tbody');

    expect(body?.textContent).toContain('Grace');
    expect(body?.textContent).not.toContain('Ada');
  });

  it('drops the collapse set when a navigation regroups by another column', () => {
    // `collapsedGroups` holds group *names*. Regrouping through
    // `setGroupByKey` clears them; regrouping through a URL binding's
    // `applyExternal` never touches that setter, so the names of the previous
    // grouping survived — and one that happens to match collapses a group
    // nobody collapsed. The provider watches the value for that reason.
    const view = createTableView({ defaults: { groupBy: 'name' } });
    let ctx: TableContext | undefined;
    mountTable({ view, onReady: (c: TableContext) => (ctx = c) });

    ctx?.toggleGroup('Ada');
    flushSync();
    expect(ctx?.state.collapsedGroups.has('Ada')).toBe(true);

    view.applyExternal({ groupBy: 'amount' }, 'external');
    flushSync();
    expect(ctx?.state.collapsedGroups.size).toBe(0);
  });

  it('applies the stored column preference — after hydration, not before it', () => {
    // #152 part 2, the client half of `Table.ssr.test.ts`'s "renders every
    // column". The two are one statement: the server has no localStorage, so it
    // renders every column; the client must therefore not have *fewer* columns
    // in the render that hydrates that markup.
    //
    // Measured before the change: with `['amount']` stored, `mount()` produced a
    // single `<th>` — the second header never existed in the DOM, not even
    // before `flushSync`. Now the preference arrives with the user effects,
    // which `mount()` does NOT flush (hence the `flushSync` below) but which
    // still run before the browser paints. So a client-rendered app sees no
    // flash and an SSR one sees exactly one change.
    window.localStorage.setItem(
      'urbicon_table_hidden_columns_prefs_v1',
      JSON.stringify(['amount'])
    );

    const host = document.createElement('div');
    document.body.appendChild(host);
    const instance = mount(TableHarness, {
      target: host,
      props: { items: ROWS, prefs: { storage: 'prefs' } }
    });
    // Sampled inside the same synchronous block `mount()` returns from, before
    // any effect has been flushed.
    const duringMount = [...host.querySelectorAll('th')].map((h) => h.textContent ?? '');
    flushSync();
    const after = [...host.querySelectorAll('th')].map((h) => h.textContent ?? '');

    expect(duringMount.some((h) => h.includes('Amount'))).toBe(true);
    expect(after.some((h) => h.includes('Amount'))).toBe(false);

    unmount(instance);
    host.remove();
  });

  it('gives the virtualized header, body and summary the same column tracks', () => {
    // #14 / the open half of #150. The virtualized layout renders three
    // independent `<table>` elements, so each computes its own column tracks.
    // With `table-fixed` those come from the FIRST ROW — the `<th>` row in the
    // header table, a `<td>` row in the body table — and `TableHead` writes
    // `width`/`min-width` inline on `<th>` while `TableRow` writes nothing on
    // `<td>`. So an explicit column width sized the header and not the body.
    //
    // jsdom has no layout engine, so this asserts the tracks are *declared*
    // identically, not that they measure identically. The geometric half needs
    // a browser and belongs in the VR suite.
    const el = mountTable({
      items: Array.from({ length: 40 }, (_, i) => ({ id: i, name: `P${i}`, amount: i })),
      virtualized: true,
      columns: [
        { accessor: 'name', title: 'Name', width: '18rem', minWidth: '10rem' },
        { accessor: 'amount', title: 'Amount' }
      ],
      prefs: { defaults: { summaries: [{ column: 'amount', type: 'sum' }] } }
    });

    const tables = [...el.querySelectorAll('table')];
    const groups = tables.map((table) =>
      [...table.querySelectorAll('colgroup > col')].map((col) => col.getAttribute('style') ?? '')
    );

    // Every table in the virtualized layout carries tracks…
    expect(tables.length).toBeGreaterThanOrEqual(2);
    expect(groups.every((g) => g.length > 0)).toBe(true);
    // …and the explicit width reaches them.
    expect(groups[0].join(' ')).toContain('18rem');

    // Deliberately NOT asserted: that the four groups equal each other. They
    // are four renders of one snippet reading one derived, so they cannot
    // differ — an assertion guaranteed by construction measures nothing.
    //
    // What can differ, and is the actual failure mode of #14, is the tracks
    // against the cells they size. Compared against the header, which is the
    // one row jsdom renders here (the virtualizer needs a measured viewport and
    // produces none, so the body has no rows to compare).
    const headerCells = [...el.querySelectorAll('thead th')];
    expect(headerCells).toHaveLength(groups[0].length);
    // Column order too, not just the count: the header and the tracks must walk
    // the same list. `TableHead` and `columnTracks` used to disagree whenever a
    // stored column order met `enableColumnReorder={false}`.
    const headerIds = headerCells
      .map((th) => th.getAttribute('data-testid'))
      .filter((id): id is string => !!id?.startsWith('column-header-'))
      .map((id) => id.replace('column-header-', ''));
    expect(headerIds).toEqual(['name', 'amount']);
  });

  it('follows a stored column order in header, body and tracks alike', () => {
    // The narrow case where the three used to disagree. `TableRow` and
    // `SummaryRow` always iterate `orderedColumns`, and a stored order is
    // restored whether or not reordering is currently enabled — but the header
    // and the column tracks read it only `enableColumnReorder ? … :
    // state.columns`. So with a stored order and the flag off, the header
    // rendered the declaration order over a body in the persisted one, and the
    // tracks sized the wrong cells.
    window.localStorage.setItem(
      'urbicon_table_column_order_ord_v1',
      JSON.stringify(['amount', 'name'])
    );

    const el = mountTable({ prefs: { storage: 'ord' } });
    flushSync();

    const headerIds = [...el.querySelectorAll('thead th')]
      .map((th) => th.getAttribute('data-testid'))
      .filter((id): id is string => !!id?.startsWith('column-header-'))
      .map((id) => id.replace('column-header-', ''));
    // The body's own order, read off the first row's cell values.
    const firstRow = [...(el.querySelector('tbody tr')?.children ?? [])].map((td) =>
      (td.textContent ?? '').trim()
    );

    expect(headerIds).toEqual(['amount', 'name']);
    // Ada's amount is 100 and her name is 'Ada' — amount first proves the body
    // followed the same order rather than the declaration one.
    expect(firstRow[0]).toBe('100');
    expect(firstRow[1]).toBe('Ada');

    unmount(comp as Record<string, unknown>);
    comp = undefined;

    // And the virtualized tracks with it. A `<col>` has no identity, so the
    // order is read off the one column that carries a width: declared second,
    // it has to end up in slot two only if the tracks ignored the stored order.
    const virt = mountTable({
      virtualized: true,
      prefs: { storage: 'ord' },
      columns: [
        { accessor: 'name', title: 'Name', width: '18rem' },
        { accessor: 'amount', title: 'Amount' }
      ]
    });
    flushSync();
    // One colgroup per table in this layout — the header's is enough, and the
    // sibling test already pins that every table carries the same one.
    const cols = [...(virt.querySelector('colgroup')?.children ?? [])].map(
      (col) => col.getAttribute('style') ?? ''
    );

    expect(cols).toHaveLength(2);
    expect(cols[0]).toBe('');
    expect(cols[1]).toContain('18rem');
  });

  it('a managed source fetches once and renders the result', async () => {
    // The v8 replacement for "never fetches in client mode, even with a
    // queryFn present": a client source WITH a query function is no longer a
    // representable state — the `TableSource` union makes the old ambiguity
    // impossible. What remains testable is the managed flow itself: the first
    // fetch is immediate, and the result reaches the rendered rows through
    // `setServerResult`.
    let fetches = 0;
    const el = mountTable({
      items: [],
      source: {
        query: async () => {
          fetches += 1;
          return { items: [{ id: 1, name: 'Fetched', amount: 1 }], totalItems: 1 };
        }
      }
    });

    // First fetch is scheduled with delay 0; the result lands a microtask
    // after that macrotask.
    await new Promise((resolve) => setTimeout(resolve, 10));
    flushSync();

    expect(fetches).toBe(1);
    expect(el.textContent).toContain('Fetched');
  });
});
