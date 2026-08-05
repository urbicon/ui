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

// Deleted here: "renders every column, because storage does not exist here".
// It ran in the node env, never wrote a key, and `getStorage()` returns null
// without a `window` — so "both headers present" held for every conceivable
// implementation, including the one it was added to guard against. The
// measurement that carries #152 part 2 lives on the client side, in
// `Table.render.svelte.test.ts` ("applies the stored column preference — after
// hydration, not before it"), which is where the two renders can differ.
