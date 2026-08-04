// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import TableHarness from './__fixtures__/TableHarness.svelte';

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

  it('paginates to itemsPerPage', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Person ${i}`,
      amount: i
    }));
    const el = mountTable({ items: many, itemsPerPage: 10 });

    expect(el.querySelectorAll('tbody tr').length).toBe(10);
    expect(el.textContent).toContain('Person 0');
    expect(el.textContent).not.toContain('Person 10');
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

describe('Table — query emission in client mode', () => {
  // The gap #152 names: `query` and `queryKey` were always computed regardless
  // of mode, but only the server branch emitted them, so a client-mode table had
  // nothing for a URL sync to listen to. Without an emission there is no way for
  // the view state to reach the URL, and through the URL the server.
  //
  // The emission is debounced through a `setTimeout`, with delay 0 for the first
  // one — so a macrotask tick is what these await, not a `flushSync`.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('emits the initial query without a server mode', async () => {
    const seen: Array<Record<string, unknown>> = [];
    mountTable({ onQueryChange: (q: Record<string, unknown>) => seen.push(q) });
    await tick();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ page: 1, sortColumn: '', searchTerm: '', groupByKey: null });
  });

  it('emits again when the view state changes', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const props = $state({
      items: ROWS,
      searchTerm: '',
      onQueryChange: (q: Record<string, unknown>) => seen.push(q)
    });
    target = document.createElement('div');
    document.body.appendChild(target);
    comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
    flushSync();
    await tick();
    expect(seen).toHaveLength(1);

    props.searchTerm = 'ada';
    flushSync();
    // Past the default 300 ms debounce.
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toMatchObject({ searchTerm: 'ada' });
  });

  it('keeps the page the URL asked for when a controlled searchTerm is also present', () => {
    // The client half of an SSR/client agreement. `TableProvider` applies the
    // controlled `searchTerm` prop in a mount effect, and `setSearchTerm` used
    // to reset the page unconditionally — so `?page=2&q=…` rendered page 2 on
    // the server and snapped to page 1 the moment the browser took over. Which
    // is the exact divergence the `query` prop exists to remove (#152), arriving
    // through a different door.
    const el = mountTable({ query: { page: 2, itemsPerPage: 1 }, searchTerm: '' });
    const body = el.querySelector('tbody');

    expect(body?.textContent).toContain('Grace');
    expect(body?.textContent).not.toContain('Ada');
  });

  it('drops the collapse set when the URL regroups by another column', () => {
    // `collapsedGroups` holds group *names*. Regrouping through `setGroupByKey`
    // clears them; regrouping through the controlled `query` prop never touches
    // that setter, so the names of the previous grouping survived — and one
    // that happens to match collapses a group nobody collapsed.
    let ctx:
      | { state: { collapsedGroups: Set<string> }; toggleGroup: (n: string) => void }
      | undefined;
    const props = $state({
      items: ROWS,
      query: { groupByKey: 'name' } as Record<string, unknown>,
      onReady: (c: unknown) => {
        ctx = c as typeof ctx;
      }
    });
    target = document.createElement('div');
    document.body.appendChild(target);
    comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
    flushSync();

    ctx?.toggleGroup('Ada');
    flushSync();
    expect(ctx?.state.collapsedGroups.has('Ada')).toBe(true);

    props.query = { groupByKey: 'amount' };
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
    // before `flushSync`. Now the preference arrives with the effects, which is
    // still inside `mount()` and therefore before the browser paints: a
    // client-only app sees no flash, and an SSR one sees exactly one change.
    window.localStorage.setItem(
      'urbicon_table_hidden_columns_prefs_v1',
      JSON.stringify(['amount'])
    );

    const host = document.createElement('div');
    document.body.appendChild(host);
    const instance = mount(TableHarness, {
      target: host,
      props: { items: ROWS, persistenceConfig: { tableId: 'prefs' } }
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

  it('never fetches in client mode, even with a queryFn present', async () => {
    // `queryFn` is a server-mode contract. Emitting in client mode must not
    // quietly start calling it — that would fetch over data the consumer owns.
    let fetches = 0;
    const seen: unknown[] = [];
    mountTable({
      queryFn: async () => {
        fetches++;
        return { items: [], totalItems: 0 };
      },
      onQueryChange: (q: unknown) => seen.push(q)
    });
    await tick();

    expect(fetches).toBe(0);
    expect(seen).toHaveLength(1);
  });
});
