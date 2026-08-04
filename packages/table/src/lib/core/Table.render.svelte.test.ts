// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TableHarness from './__fixtures__/TableHarness.svelte';

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
