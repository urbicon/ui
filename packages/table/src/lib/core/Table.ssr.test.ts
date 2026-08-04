import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
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

  it('honours itemsPerPage on the server, so page one is not the whole set', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Person ${i}`,
      amount: i
    }));
    const body = bodyOf({ items: many, itemsPerPage: 10 });

    expect(body).toContain('Person 0');
    expect(body).toContain('Person 9');
    // Page two must not be in the first paint — the prop has to reach the store
    // during SSR for the slice to happen at all.
    expect(body).not.toContain('Person 10');
  });
});
