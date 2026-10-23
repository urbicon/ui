// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TableContext } from '#lib/core/table/index.js';
import { TableColumns } from '#lib/factories/TableColumns.js';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * A clickable cell that handles Enter or Space owns the key on an interactive
 * grid: the cell's `onClick` runs once, and the grid's row action (Space
 * toggles selection, Enter fires `onRowClick`) does not run as well.
 *
 * The grid is interactive (multi-selection + `onRowClick`), or
 * `handleTableKeyDown` returns before it reads a key and the test measures
 * nothing. The control in the last case is the same key on the row itself,
 * which must still reach the grid.
 */

type Row = {
  id: number;
  name: string;
  joined: string;
  amount: number;
  status: string;
  note: string;
};

const ROWS: Row[] = [1, 2, 3].map((id) => ({
  id,
  name: `Person ${id}`,
  joined: `2026-03-1${id}`,
  amount: id * 100,
  status: 'active',
  note: `note ${id}`
}));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderGrid() {
  const spies = {
    avatar: vi.fn(),
    date: vi.fn(),
    number: vi.fn(),
    status: vi.fn(),
    custom: vi.fn(),
    row: vi.fn()
  };
  let ctx: TableContext | undefined;
  const columns = [
    TableColumns.userAvatar<Row>('name', 'User', { clickable: true, onClick: spies.avatar }),
    TableColumns.date<Row>('joined', 'Joined', { onClick: spies.date }),
    TableColumns.number<Row>('amount', 'Amount', { onClick: spies.number }),
    TableColumns.status<Row>('status', 'Status', { onClick: spies.status, interactive: true }),
    TableColumns.custom<Row>('note', 'Note', { onClick: spies.custom })
  ];
  // The harness types its rows as its own default shape; these rows are wider.
  const props: Record<string, unknown> = {
    items: ROWS,
    columns,
    selectionMode: 'multi',
    onRowClick: spies.row,
    onReady: (ready: TableContext) => (ctx = ready)
  };
  const instance = mount(TableHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  const context = () => {
    if (!ctx) throw new Error('onReady never fired');
    return ctx;
  };
  return { spies, context };
}

/** The clickable element of column `col` in the third row. */
function cellButton(col: number): HTMLElement {
  const row = document.querySelector<HTMLElement>('tbody tr[data-row-index="2"]');
  const cells = row?.querySelectorAll<HTMLElement>('td');
  // Column 0 is the selection checkbox.
  const el = cells?.[col + 1]?.querySelector<HTMLElement>('[role="button"]');
  if (!el) throw new Error(`no clickable element in column ${col}`);
  return el;
}

function press(el: HTMLElement, key: string, repeat = false): KeyboardEvent {
  el.focus();
  const event = new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  flushSync();
  return event;
}

const CELLS = [
  { col: 0, name: 'UserAvatar', spy: 'avatar' },
  { col: 1, name: 'DateCell', spy: 'date' },
  { col: 2, name: 'NumberCell', spy: 'number' },
  { col: 3, name: 'StatusBadge', spy: 'status' },
  { col: 4, name: 'CustomCell', spy: 'custom' }
] as const;

describe('a clickable cell owns Enter and Space on an interactive grid', () => {
  it.each(CELLS)('$name: one cell click per key, no row action', ({ col, spy }) => {
    const { spies, context } = renderGrid();

    for (const key of ['Enter', ' ']) {
      expect(press(cellButton(col), key).defaultPrevented, `${key} is claimed`).toBe(true);
    }

    expect(spies[spy]).toHaveBeenCalledTimes(2);
    expect(spies.row, 'onRowClick').not.toHaveBeenCalled();
    expect(context().selectedItems, 'selection').toHaveLength(0);
  });

  it('UserAvatar: a held Space clicks once and stays claimed', () => {
    const { spies, context } = renderGrid();
    const avatar = cellButton(0);

    press(avatar, ' ');
    expect(context().selectedItems, 'selection after the first press').toHaveLength(0);
    const repeat = press(avatar, ' ', true);

    expect(spies.avatar).toHaveBeenCalledTimes(1);
    expect(repeat.defaultPrevented).toBe(true);
    expect(context().selectedItems, 'selection after the repeat').toHaveLength(0);
  });

  it('control: the same keys on the row itself still drive the grid', () => {
    const { spies, context } = renderGrid();
    const row = document.querySelector<HTMLElement>('tbody tr[tabindex="0"]');
    if (!row) throw new Error('no focusable row');

    press(row, ' ');
    press(row, 'Enter');

    expect(context().selectedItems).toHaveLength(1);
    expect(spies.row).toHaveBeenCalledTimes(1);
  });
});
