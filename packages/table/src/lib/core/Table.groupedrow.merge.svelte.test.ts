// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { InternalTableContext } from '$lib/stores/TableStore.svelte';
import { createTableView } from '$lib/view/view.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * Grouped rows render through TableRow (#232). GroupedRow used to carry a
 * full second copy of the row markup, and the copies had drifted in eight
 * measured places: live-update ring, roving focus on click-selection,
 * aria-expanded, the expand label toggle, the id attribute, gridcell/colindex
 * wiring, page-local aria-rowindex in server mode — and the structural-column
 * order itself (selection first, against the head's group-first order, so
 * every checkbox sat under the group header column). Each pin here is one
 * divergence, asserted on the shared renderer; the ungrouped controls prove
 * the behaviour is the flat rows', not a new third one.
 */

const ITEMS = [
  { id: 1, dept: 'A', name: 'Ada', amount: 1 },
  { id: 2, dept: 'A', name: 'Alan', amount: 2 },
  { id: 3, dept: 'B', name: 'Grace', amount: 3 },
  { id: 4, dept: 'B', name: 'Barbara', amount: 4 }
];
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount' }
];

let target: HTMLElement | undefined;
let comp: Record<string, unknown> | undefined;
let ctx: InternalTableContext | undefined;

function mountTable(extraProps: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  const props: Record<string, unknown> = {
    items: ITEMS,
    columns: COLUMNS,
    onReady: (c: TableContext) => (ctx = c as InternalTableContext),
    ...extraProps
  };
  comp = mount(TableHarness, { target, props }) as Record<string, unknown>;
  flushSync();
  return target;
}

function mountGrouped(extraProps: Record<string, unknown> = {}) {
  return mountTable({
    view: createTableView({ defaults: { groupBy: 'dept' } }),
    ...extraProps
  });
}

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = undefined;
  target = undefined;
  ctx = undefined;
});

describe('grouped rows render through TableRow (#232)', () => {
  it('a live update rings the grouped row it applied to', () => {
    const el = mountGrouped();

    ctx?.pushUpdate(3, { name: 'Grace II' });
    ctx?.applyAllUpdates();
    flushSync();

    const row = el.querySelector('[data-testid="grouped-item-3"]');
    expect(row).toBeTruthy();
    expect(row?.className).toContain('ring-success/30');
  });

  it('click-selection hands the roving tab stop to the clicked grouped row', () => {
    const el = mountGrouped({ selectionMode: 'multi', rowClickSelects: true });

    el.querySelector<HTMLElement>('tr[data-row-index="2"]')?.click();
    flushSync();

    expect(el.querySelector('tr[data-row-index="2"]')?.getAttribute('tabindex')).toBe('0');
    expect(el.querySelector('tr[data-row-index="0"]')?.getAttribute('tabindex')).toBe('-1');
  });

  it('a grouped expandable row carries aria-expanded and toggles it', () => {
    const detail = createRawSnippet(() => ({ render: () => '<div>detail</div>' }));
    const el = mountGrouped({ expandable: true, expandedRowContent: detail });

    const row = () => el.querySelector('[data-testid="grouped-item-1"]');
    expect(row()?.getAttribute('aria-expanded')).toBe('false');

    el.querySelector<HTMLButtonElement>('[data-testid="expand-button-1"]')?.click();
    flushSync();
    expect(row()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('the expand label toggles between show and hide', () => {
    const detail = createRawSnippet(() => ({ render: () => '<div>detail</div>' }));
    const el = mountGrouped({ expandable: true, expandedRowContent: detail });

    const button = () => el.querySelector<HTMLButtonElement>('[data-testid="expand-button-1"]');
    const before = button()?.getAttribute('aria-label');
    button()?.click();
    flushSync();
    const after = button()?.getAttribute('aria-label');

    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it('grouped rows carry an id attribute', () => {
    const el = mountGrouped();
    expect(el.querySelector('[data-testid="grouped-item-1"]')?.id).toBe('1');
  });

  it('the checkbox column sits under its header — group indent first', () => {
    const el = mountGrouped({ selectionMode: 'multi' });

    // Head order: group column (colindex 1), then selection (colindex 2).
    const headCells = el.querySelectorAll('thead th');
    expect(headCells[0]?.getAttribute('aria-colindex')).toBe('1');
    expect(headCells[1]?.getAttribute('aria-colindex')).toBe('2');
    expect(headCells[1]?.querySelector('input[type="checkbox"]')).toBeTruthy();

    // The item row mirrors it: an aria-hidden indent cell first, the checkbox
    // second — GroupedRow's copy rendered the checkbox first, under the
    // group header column.
    const cells = el.querySelectorAll('[data-testid="grouped-item-1"] > td');
    expect(cells[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(cells[0]?.querySelector('input[type="checkbox"]')).toBeNull();
    expect(cells[1]?.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(cells[1]?.getAttribute('aria-colindex')).toBe('2');
  });

  it('grouped server rows report absolute aria row indices beside the true rowcount', () => {
    const view = createTableView({ defaults: { groupBy: 'dept' } });
    view.applyExternal({ page: 2, pageSize: 2 }, 'external');
    const el = mountTable({
      view,
      items: undefined,
      source: {
        processing: 'server',
        items: [
          { id: 21, dept: 'C', name: 'Carol', amount: 5 },
          { id: 22, dept: 'C', name: 'Chris', amount: 6 }
        ],
        total: 8
      }
    });

    // Page 2 of 2-per-page starts at absolute row 3; the copy reported the
    // page-local 1 beside an aria-rowcount of 8.
    expect(el.querySelector('table')?.getAttribute('aria-rowcount')).toBe('8');
    expect(el.querySelector('[data-testid="grouped-item-21"]')?.getAttribute('aria-rowindex')).toBe(
      '3'
    );
  });

  it('arrow keys walk across a group boundary and End reaches the last row', () => {
    const el = mountGrouped({ selectionMode: 'multi' });

    // The roving index starts at row 0 (the initial tab stop); two ArrowDowns
    // cross the A|B group boundary between indices 1 and 2.
    const rowAt = (i: number) => el.querySelector<HTMLElement>(`tr[data-row-index="${i}"]`);
    rowAt(0)?.focus();
    rowAt(0)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();
    expect(document.activeElement).toBe(rowAt(1));

    rowAt(1)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();
    expect(document.activeElement).toBe(rowAt(2));

    rowAt(2)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    flushSync();
    expect(document.activeElement).toBe(rowAt(3));
  });

  it('grouped cell test ids stay stable', () => {
    const el = mountGrouped();
    expect(el.querySelector('[data-testid="grouped-cell-1-name"]')).toBeTruthy();
  });
});

describe('ungrouped positive controls', () => {
  it('the flat row rings, toggles aria-expanded and its expand label', () => {
    const detail = createRawSnippet(() => ({ render: () => '<div>detail</div>' }));
    const el = mountTable({ expandable: true, expandedRowContent: detail });

    ctx?.pushUpdate(3, { name: 'Grace II' });
    ctx?.applyAllUpdates();
    flushSync();
    expect(el.querySelector('[data-testid="table-row-3"]')?.className).toContain('ring-success/30');

    const row = () => el.querySelector('[data-testid="table-row-1"]');
    const button = () => el.querySelector<HTMLButtonElement>('[data-testid="expand-button-1"]');
    expect(row()?.getAttribute('aria-expanded')).toBe('false');
    const before = button()?.getAttribute('aria-label');
    button()?.click();
    flushSync();
    expect(row()?.getAttribute('aria-expanded')).toBe('true');
    expect(button()?.getAttribute('aria-label')).not.toBe(before);
  });
});
