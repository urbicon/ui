// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { observeView } from '$lib/view/observe.svelte';
import { createTableView, type TableViewSnapshot } from '$lib/view/view.svelte';
import type { InternalTableContext } from '../stores/TableStore.svelte';
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

/**
 * Stub a layout property jsdom does not compute, and hand back the undo.
 *
 * The prototype is looked up rather than assumed, because assuming it is how
 * the previous version of the virtualization test leaked: it captured
 * `clientHeight` from `HTMLElement.prototype`, where jsdom does not define it
 * (it is on `Element.prototype`), so the captured descriptor was `undefined`,
 * the guarded restore never ran, and every element in the worker reported a
 * height of 400 for the rest of the file. `offsetHeight`, meanwhile, really is
 * on `HTMLElement.prototype` — the two differ, which is exactly why neither
 * should be written down here.
 */
function stubLayoutProp(
  prop: 'clientHeight' | 'offsetHeight',
  value: number | ((el: HTMLElement) => number)
): () => void {
  let proto: object | null = HTMLElement.prototype;
  while (proto && !Object.getOwnPropertyDescriptor(proto, prop)) {
    proto = Object.getPrototypeOf(proto);
  }
  if (!proto) throw new Error(`jsdom defines no \`${prop}\` to stub.`);

  const owner = proto;
  const original = Object.getOwnPropertyDescriptor(owner, prop);
  if (!original) throw new Error(`jsdom defines no \`${prop}\` to stub.`);

  const read = typeof value === 'function' ? value : () => value;
  Object.defineProperty(owner, prop, {
    configurable: true,
    get(this: HTMLElement) {
      return read(this);
    }
  });
  return () => Object.defineProperty(owner, prop, original);
}

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;

function mountTable(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  // The object is handed over as-is rather than spread into a fresh one:
  // spreading a `$state` props object copies the values out of the proxy, so a
  // test that mounts and then assigns (`props.items = …`) would be writing to
  // something the component no longer reads. Defaulting in place keeps both
  // call styles on this one helper.
  if (!('items' in props)) props.items = ROWS;
  comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
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
    const props = $state<Record<string, unknown>>({ items: ROWS });
    const el = mountTable(props);
    expect(el.querySelectorAll('tbody tr').length).toBe(3);

    props.items = [...ROWS, { id: 4, name: 'Barbara', amount: 400 }];
    flushSync();
    expect(el.querySelectorAll('tbody tr').length).toBe(4);
    expect(el.textContent).toContain('Barbara');
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
    // The whole loop: the table's own interaction path (setSearch, i.e.
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

    ctx?.setSearch('ada');
    flushSync();
    // Past the default 300 ms debounce.
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toMatchObject({ search: 'ada' });
    cleanup();
  });

  it('keeps the page a deep link asked for across mount', () => {
    // The client half of an SSR/client agreement. `setSearch` used to
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
    // `setGroupBy` clears them; regrouping through a URL binding's
    // `applyExternal` never touches that setter, so the names of the previous
    // grouping survived — and one that happens to match collapses a group
    // nobody collapsed. The provider watches the value for that reason.
    const view = createTableView({ defaults: { groupBy: 'name' } });
    // The group-collapse toggle is in-tree surface (the group header's own
    // control), so this test reads the context the way the tree does — wide.
    let ctx: InternalTableContext | undefined;
    mountTable({ view, onReady: (c: TableContext) => (ctx = c as InternalTableContext) });

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
        processing: 'server' as const,
        query: async () => {
          fetches += 1;
          return { items: [{ id: 1, name: 'Fetched', amount: 1 }], total: 1 };
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

  // The banner's counts are a sentence, and a sentence is only ever right in
  // the rendered output: written as three `{#if}` blocks with a comma between
  // them it read "2 new , 1 updated", because the whitespace the source needs
  // to stay readable lands in front of the comma. Asserted on textContent with
  // its whitespace collapsed the way a reader sees it — the defect is invisible
  // to any assertion that normalises more than the browser does.
  it('joins the live-update counts without a space before the comma', async () => {
    let ctx: TableContext | undefined;
    const el = mountTable({
      enableLiveUpdates: true,
      onReady: (c: TableContext) => (ctx = c)
    });

    ctx?.pushInsert({ id: 4, name: 'Karen', amount: 400 });
    ctx?.pushInsert({ id: 5, name: 'Barbara', amount: 500 });
    ctx?.pushUpdate(1, { amount: 150 });
    flushSync();

    const banner = el.querySelector('[data-testid="live-update-banner"]');
    expect(banner).toBeTruthy();
    const text = (banner?.textContent ?? '').replace(/\s+/g, ' ').trim();

    expect(text).toContain('2');
    expect(text).not.toMatch(/\s+,/);
  });

  // The header follows its column's `align`, like the body cells below it.
  // `tableHeaderVariants` has carried the axis since v1; `TableHead` never
  // passed it, so a right-aligned numeric column had its title over the left
  // edge of its own numbers. `scope="col"` is asserted here too: HTML infers it
  // for a single header row, and the docs claimed it for years, but nothing in
  // the package emitted it.
  // `scope="col"` only. A header does NOT follow its column's alignment — the
  // axis that claimed to was removed rather than left in place doing nothing;
  // see the note on `tableHeaderVariants`. This test used to assert alignment
  // classes too, and passed through several shapes of "the class is emitted
  // somewhere" while the header sat over the wrong edge of its own numbers,
  // which is the reason the claim is gone rather than weakened.
  //
  // `scope` is worth its own line: HTML infers it for a single header row, and
  // the docs claimed it for years, but nothing in the package emitted it.
  it('marks every header cell as a column header', () => {
    const el = mountTable({
      columns: [
        { accessor: 'name', title: 'Name' },
        { accessor: 'amount', title: 'Amount', align: 'right' }
      ]
    });

    const headers = [...el.querySelectorAll('thead th')];
    expect(headers.length).toBeGreaterThan(0);
    expect(headers.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
  });

  // Keyboard column reorder lives on the `<th>`, but only a *focusable* child
  // ever sends it a key event. That child's tab stop used to follow
  // `sortable` alone, so Shift+Arrow reached sortable columns and nothing else
  // — status and action columns, the ones a reader most wants to move, could
  // be dragged with a mouse and not moved at all from the keyboard.
  it('gives every header a tab stop when columns can be reordered', () => {
    const columns = [
      { accessor: 'name', title: 'Name', sortable: true },
      { accessor: 'amount', title: 'Amount', sortable: false }
    ];

    const withReorder = mountTable({ columns, enableColumnReorder: true });
    const reorderStops = [...withReorder.querySelectorAll('thead th [tabindex="0"]')];
    expect(reorderStops.length).toBe(2);

    // Reachable is not the same as usable. Each stop has to say what it can do:
    // the column title is its accessible name, and the shortcut is the part
    // nothing in the markup could imply. Counting stops alone would have gone
    // green over a stop that announces a name and no capability.
    for (const stop of reorderStops) {
      expect(stop.getAttribute('aria-keyshortcuts')).toBe('Shift+ArrowLeft Shift+ArrowRight');
      expect(stop.textContent?.trim()).not.toBe('');
    }

    unmount(comp as Record<string, unknown>);
    target?.remove();

    // Without the feature an unsortable header stays out of the tab order:
    // a tab stop that does nothing is its own defect.
    const plain = mountTable({ columns });
    const plainStops = [...plain.querySelectorAll('thead th [tabindex="0"]')];
    expect(plainStops.length).toBe(1);
    // …and the sortable one left over advertises no shortcut it does not have.
    expect(plainStops[0]?.getAttribute('aria-keyshortcuts')).toBeNull();
  });

  // The virtualized window is offset on the table, never on the rows. This is
  // a structural assertion because the symptom is a layout one and jsdom has no
  // layout: `position: absolute` on a `<tr>` blockifies it, and a blockified
  // row leaves the table's column tracks — measured in a browser on a
  // four-column table with no explicit widths, header 213/213/213/213 against
  // body 61/101/84/33. Keeping the rows unpositioned is what keeps them
  // `table-row`, so this pins the mechanism rather than the pixels.
  it('offsets the virtualized window on the table, not on its rows', () => {
    // jsdom reports every element as zero-height, and the virtualizer renders
    // the rows that fit in the viewport — without a height it renders none and
    // the assertions below would pass over an empty list.
    const restoreViewport = stubLayoutProp('clientHeight', 400);
    try {
      const el = mountTable({ virtualized: true, virtualHeight: '400px' });

      const rows = [...el.querySelectorAll('tbody tr')];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.getAttribute('style') ?? '').not.toContain('position: absolute');
      }

      const bodyTable = [...el.querySelectorAll('table')].find((t) => !t.querySelector('thead'));
      expect(bodyTable?.getAttribute('style') ?? '').toContain('translateY');
    } finally {
      restoreViewport();
    }
  });

  // A `cardsBelow` the variant config has no classes for used to render BOTH
  // layouts, one under the other: `tv()` skips an unrecognised variant value,
  // which leaves the two halves of the switch empty, and empty complements hide
  // nothing. The union type rules it out at a typed call site and nowhere else
  // — plain JavaScript, a config object and a CMS field all reach this prop.
  it('falls back to a known step when handed one it has no classes for', () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));

    try {
      const el = mountTable({ cardsBelow: '40rem' });

      const desktop = el.querySelector('[data-table-layout="desktop"]');
      const mobile = el.querySelector('[data-table-layout="mobile"]');
      expect(desktop).not.toBeNull();
      expect(mobile).not.toBeNull();

      // Both roots carry a container-hidden rule, which is what makes them
      // complements: each hides on the other's side of the step. Neither
      // carrying one is the failure — that is the state where both render.
      const hidden = [desktop, mobile].filter((root) =>
        /@(max|min)-\[[^\]]+\]:hidden/.test(root?.className ?? '')
      );
      expect(hidden).toHaveLength(2);

      // The fallback is only defensible because it is loud. Without this the
      // whole `console.warn` block could be deleted and the suite stay green.
      expect(warnings.some((line) => line.includes('40rem') && line.includes('48rem'))).toBe(true);
    } finally {
      console.warn = realWarn;
    }
  });

  // `fit="viewport"` + `virtualized` is refused — the virtualizer keeps its own
  // bounded scroll. The refusal is the only gate and it does not write the prop
  // away, but `data-fit` publishes the RESOLVED mode, so the documented
  // `[data-fit='viewport']` page rule silently never matches. The warning is
  // what makes that findable (#298); without it both the DOM and the console
  // look exactly like a table that was never asked for `viewport`.
  it('warns loudly when fit="viewport" is refused because the table is virtualized', () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));

    try {
      const el = mountTable({ fit: 'viewport', virtualized: true, virtualHeight: '400px' });

      expect(el.querySelector('[data-table-container]')?.getAttribute('data-fit')).toBe('content');
      expect(
        warnings.some((line) => line.includes('fit="viewport"') && line.includes('virtualized'))
      ).toBe(true);
      // The warning has to name what the DOM will say, because that attribute
      // is the hook the consumer was told to style against.
      expect(warnings.some((line) => line.includes('data-fit'))).toBe(true);
    } finally {
      console.warn = realWarn;
    }
  });

  // Negative control for the above: the same mount without the refused
  // combination must stay quiet, or the assertion there proves nothing.
  it('stays quiet and reports data-fit="viewport" when the combination is allowed', () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));

    try {
      const el = mountTable({ fit: 'viewport' });

      expect(el.querySelector('[data-table-container]')?.getAttribute('data-fit')).toBe('viewport');
      expect(warnings).toEqual([]);
    } finally {
      console.warn = realWarn;
    }
  });

  // The stride the window is offset by has to be the height a row actually
  // renders at. It cannot be asserted in pixels here — jsdom lays nothing out,
  // which is precisely why the assumed height and the rendered one could
  // disagree by 16px per row for as long as they did. So this pins the wiring
  // instead: change what a row measures, and the scroll spacer has to follow.
  it('sizes the scroll spacer from the measured row height, not from a constant', () => {
    const restoreViewport = stubLayoutProp('clientHeight', 400);
    const restoreRow = stubLayoutProp('offsetHeight', 20);
    try {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Row ${i}`,
        amount: i
      }));
      const el = mountTable({ items, virtualized: true, virtualHeight: '400px' });

      const scroller = el.querySelector<HTMLElement>('[data-testid="virtual-scroll-container"]');
      const spacer = scroller?.firstElementChild as HTMLElement | null;

      // 1000 rows measuring 20px each. The derived starting height (`h-10`, so
      // 40px) would have produced 40 000px — the measurement has to win.
      expect(spacer?.style.height).toBe('20000px');
    } finally {
      restoreRow();
      restoreViewport();
    }
  });

  // An empty virtualized table renders the EmptyState in a `<tr>` of its own,
  // and that row is several times the height of a data row. Measuring whatever
  // `tbody tr` happens to match would latch onto it and — with no dependency on
  // the row count and a container whose height is pinned by `virtualHeight` —
  // never look again: the spacer would stay `count * emptyStateHeight` and
  // scrolling would stride five rows for every one.
  it('does not take its row height from the empty state', () => {
    const restoreViewport = stubLayoutProp('clientHeight', 400);
    // A data row and the empty state have to measure differently, or the test
    // cannot tell which one the measurement read.
    //
    // 30, deliberately NOT 40: `ROW_HEIGHTS.md` is 40, so a data row stubbed at
    // 40 makes "measured a data row" and "never measured anything and fell back"
    // produce the same spacer. With that value the re-measure dependency was
    // unpinned — deleting it from TableDesktop left this green.
    const restoreRow = stubLayoutProp('offsetHeight', (el) =>
      el.hasAttribute('data-row-index') ? 30 : 200
    );
    try {
      const props = $state<Record<string, unknown>>({
        items: [],
        virtualized: true,
        virtualHeight: '400px'
      });
      const el = mountTable(props);

      // Rows arrive after the empty state has been on screen.
      props.items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `R${i}`, amount: i }));
      flushSync();

      const scroller = el.querySelector<HTMLElement>('[data-testid="virtual-scroll-container"]');
      const spacer = scroller?.firstElementChild as HTMLElement | null;

      // 100 data rows at 30px. Latched onto the 200px empty-state row it reads
      // 20000px; never re-measured at all it reads 4000px, the `ROW_HEIGHTS.md`
      // fallback. Only a fresh measurement of a data row gives 3000px.
      expect(spacer?.style.height).toBe('3000px');
      expect(el.querySelectorAll('tbody tr[data-row-index]').length).toBeGreaterThan(0);
    } finally {
      restoreRow();
      restoreViewport();
    }
  });
});
