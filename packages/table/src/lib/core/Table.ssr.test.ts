import { render } from 'svelte/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTableView, type TableViewSnapshot } from '$lib/view/view.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * What the server actually renders — the half #10 is about.
 *
 * `TableProvider` used to mirror every prop into its store inside an `$effect`, and
 * effects do not run during SSR. So `state.items` stayed `[]` on the server and the
 * prerendered HTML carried an EmptyState instead of the rows: on the docs site that
 * made 81 API pages affirmatively state the component had no props.
 *
 * These assertions are the verification the issue asks for, at unit scale. They fail
 * on effect-based ingestion and pass on derived-based ingestion, which is the whole
 * point of having them — see the sibling `Table.render.svelte.test.ts` for the mounted
 * side.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 },
  { id: 3, name: 'Radia', amount: 300 }
];

const bodyOf = (props: Record<string, unknown>) => render(TableHarness, { props }).body;

describe('Table — server render', () => {
  it('carries the item rows, not an empty state', () => {
    const body = bodyOf({ items: ROWS });

    expect(body).toContain('Ada');
    expect(body).toContain('Grace');
    expect(body).toContain('Radia');
  });

  it('renders one <tr> per item on top of the header row', () => {
    const body = bodyOf({ items: ROWS });
    const rows = body.match(/<tr\b/g)?.length ?? 0;

    // 1 header + 3 items. The pre-#10 output was 2 (header + EmptyState).
    expect(rows).toBeGreaterThanOrEqual(4);
  });

  it('renders the column headers', () => {
    const body = bodyOf({ items: ROWS });

    expect(body).toContain('Name');
    expect(body).toContain('Amount');
  });

  it('an empty item list still renders the empty state', () => {
    const body = bodyOf({ items: [], noDataText: 'Nothing here' });

    expect(body).toContain('Nothing here');
  });

  it('honours viewDefaults.pageSize on the server, so page one is not the whole set', () => {
    // Positive control (red seen): `resolveViewProp` dropping its
    // `viewDefaults` argument → 3 tests red (this one, the mounted twin in
    // Table.render.svelte.test.ts, and the unit case in view.svelte.test.ts).
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Person ${i}`,
      amount: i
    }));
    // 7, deliberately NOT the view's own default of 10 — with 10 the
    // assertion below held even when the prop never reached the store.
    const body = bodyOf({ items: many, viewDefaults: { pageSize: 7 } });

    expect(body).toContain('Person 0');
    expect(body).toContain('Person 6');
    // Page two must not be in the first paint — the default has to reach the
    // view during SSR for the slice to happen at all.
    expect(body).not.toContain('Person 7');
  });
});

describe('Table — server render of a shared link', () => {
  // The acceptance criterion #152 states: an SSR consumer with a filter in the
  // URL must receive *filtered* rows in the server-rendered HTML. Same
  // measurement as the suite above, but with a non-default view — which is
  // exactly what localStorage could never deliver, because the server cannot
  // see it. Since v8 the URL binding applies the parsed params to the view
  // object *before* the table renders (`applyExternal`, `external` origin) —
  // `linkedView` below is that init step, minus SvelteKit. The client-side
  // half of this wiring (binding matrix, deep-link precedence) lives in
  // `stores/TableStore.viewwiring.svelte.test.ts`; it cannot live here
  // because a `svelte/server` render needs the node environment, where
  // `$effect.root` does not run.
  //
  // Positive control (red seen): `applyExternal` cut to a no-op → 8 tests
  // red — all four cases below, the virtualized-grouping control, and three
  // in view.ssr.test.ts. The link's application path IS the measurement.

  // Constructing a view outside a component warns on the server (module-scope
  // views are cross-request state) — correct in production, noise here.
  beforeAll(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const linkedView = (partial: Partial<TableViewSnapshot>) => {
    const view = createTableView();
    view.applyExternal(partial, 'external');
    return view;
  };

  it('sorts on the server', () => {
    // Sorted against the INPUT order, which is already Ada/Grace/Radia — so the
    // only assertion worth writing is one where the sort moves a row. A check
    // that all three names appear passes without any sorting at all.
    const byAmount = bodyOf({
      items: ROWS,
      view: linkedView({ sort: { column: 'amount', direction: 'desc' } })
    });
    expect(byAmount.indexOf('Radia')).toBeLessThan(byAmount.indexOf('Ada'));
    // No ascending counterpart: `amount asc` is the input order, so it would
    // pass with no sorting at all — a second assertion that cannot fail is not
    // twice the coverage.
  });

  it('searches on the server', () => {
    const body = bodyOf({ items: ROWS, view: linkedView({ search: 'grace' }) });

    expect(body).toContain('Grace');
    expect(body).not.toContain('Ada');
    expect(body).not.toContain('Radia');
  });

  it('pages on the server', () => {
    const body = bodyOf({ items: ROWS, view: linkedView({ page: 2, pageSize: 1 }) });

    expect(body).toContain('Grace');
    expect(body).not.toContain('Ada');
  });

  it('filters on the server', () => {
    const body = bodyOf({
      items: ROWS,
      view: linkedView({ filters: [{ column: 'name', operator: 'equals', value: 'Radia' }] })
    });

    expect(body).toContain('Radia');
    expect(body).not.toContain('Grace');
  });
});

describe('Table — server render of a virtualized table with a grouped link', () => {
  // The url-state docs page says the server render is included; this makes
  // that claim true for the awkward corner: a `?group=…` deep link onto a
  // virtualized table renders UNGROUPED on the server — grouped
  // virtualization is not implemented, the provider discards the grouping at
  // construction (which runs during SSR) and the store's `groupByKey` read
  // gate holds on the server too.
  //
  // Red seen: with the construction discard and the read gate both sabotaged
  // away, the virtualized server render carried the `grouped-item-`
  // group-header rows.
  beforeAll(() => {
    // The construction discard warns in DEV — expected here, not noise worth
    // printing 2× per run. Same containment as the shared-link describe.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const groupedView = () => {
    const view = createTableView();
    view.applyExternal({ groupBy: 'name' }, 'external');
    return view;
  };

  it('renders ungrouped on the server, while the un-virtualized control groups', () => {
    // Control first, same test: the same link on a plain table renders group
    // headers — so the absence below cannot be "grouping never rendered".
    const plain = bodyOf({ items: ROWS, view: groupedView() });
    expect(plain).toContain('grouped-item-');

    const virtualized = bodyOf({ items: ROWS, view: groupedView(), virtualized: true });
    expect(virtualized).not.toContain('grouped-item-');
  });
});

describe('Table — server render of a controlled selection', () => {
  // The last category-A gap of the SSR/CSR audit, closed: the controlled
  // `selectedIds` prop used to reach the selection only through the runtime
  // effect, which does not run during SSR — measured: `selectedIds={[2]}`
  // rendered unselected server HTML while `initialSelectedIds={[2]}`
  // rendered it selected. The controlled prop now seeds construction too,
  // so both halves below agree. Red seen: the first test failed
  // (aria-selected="false" on row 2) before the seed change.
  const rowTag = (body: string, id: number) =>
    body.match(new RegExp(`<tr[^>]*data-testid="table-row-${id}"[^>]*>`))?.[0] ?? '';

  it('a controlled selectedIds reaches the server HTML', () => {
    const body = bodyOf({ items: ROWS, selectionMode: 'multi', selectedIds: [2] });
    expect(rowTag(body, 2)).toContain('aria-selected="true"');
    expect(rowTag(body, 1)).toContain('aria-selected="false"');
  });

  it('initialSelectedIds reaches the server HTML (the seed half, unchanged)', () => {
    const body = bodyOf({ items: ROWS, selectionMode: 'multi', initialSelectedIds: [3] });
    expect(rowTag(body, 3)).toContain('aria-selected="true"');
    expect(rowTag(body, 1)).toContain('aria-selected="false"');
  });
});

describe('Table — server render of a managed server source', () => {
  // Effects never run during SSR, so the fetch cannot even start here — the
  // construction-time seed is ALL a prerendered reader gets. A managed source
  // will fetch, unavoidably, so "loading" is the honest server HTML; this
  // table used to ship "No data available" to every reader until hydration
  // plus a macrotask.
  it('ships the loading state, never the empty state', () => {
    const body = bodyOf({
      items: undefined,
      source: { processing: 'server', query: async () => ({ items: [], total: 0 }) }
    });

    expect(body).toContain('data-testid="loading-state"');
    expect(body).not.toContain('data-testid="empty-state"');
  });

  it('positive control: a manual server source reporting loading renders the same state', () => {
    const body = bodyOf({
      items: undefined,
      source: { processing: 'server', items: [], total: 0, loading: true }
    });

    expect(body).toContain('data-testid="loading-state"');
  });

  it('a manual server source without `loading` renders the empty state, never loading', () => {
    // The loading seed is the MANAGED arm's: it will fetch, unavoidably. The
    // manual arm's consumer owns the fetch and said nothing about loading —
    // an empty result is an empty result.
    const body = bodyOf({
      items: undefined,
      source: { processing: 'server', items: [], total: 0 }
    });

    expect(body).toContain('data-testid="empty-state"');
    expect(body).not.toContain('data-testid="loading-state"');
  });
});

// Deleted here: "renders every column, because storage does not exist here".
// It ran in the node env, never wrote a key, and `getStorage()` returns null
// without a `window` — so "both headers present" held for every conceivable
// implementation, including the one it was added to guard against. The
// measurement that carries #152 part 2 lives on the client side, in
// `Table.render.svelte.test.ts` ("applies the stored column preference — after
// hydration, not before it"), which is where the two renders can differ.
