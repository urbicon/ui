// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTableView } from '#lib/view/view.svelte.js';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * The group band's toggle is a real `<button>` inside the band's cell: the
 * `<td>` keeps its cell role in the grid, the button carries the name and
 * `aria-expanded`, and the keys reach it natively. The band around it still
 * toggles on a pointer click. On an interactive grid neither key runs a row
 * action as well.
 */

const ITEMS = [
  { id: 1, dept: 'A', name: 'Ada', amount: 1 },
  { id: 2, dept: 'A', name: 'Alan', amount: 2 },
  { id: 3, dept: 'B', name: 'Grace', amount: 3 }
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderGrouped() {
  let ctx: TableContext | undefined;
  const onRowClick = vi.fn();
  const instance = mount(TableHarness, {
    target: document.body,
    props: {
      items: ITEMS,
      columns: [
        { accessor: 'name', title: 'Name' },
        { accessor: 'amount', title: 'Amount' }
      ],
      view: createTableView({ defaults: { groupBy: 'dept' } }),
      selectionMode: 'multi',
      onRowClick,
      onReady: (c: TableContext) => (ctx = c)
    }
  });
  dispose = () => unmount(instance);
  flushSync();
  const band = document.querySelector<HTMLElement>('[data-testid="grouped-row-a"]');
  const cell = band?.querySelector<HTMLElement>('td');
  const toggle = cell?.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!band || !cell || !toggle) throw new Error('group band not rendered');
  const context = () => {
    if (!ctx) throw new Error('onReady never fired');
    return ctx;
  };
  const memberRows = () => document.querySelectorAll('[data-testid^="grouped-item-"]').length;
  return { cell, toggle, onRowClick, context, memberRows };
}

describe('group band toggle', () => {
  it('is a named button inside a cell that keeps its role', () => {
    const { cell, toggle } = renderGrouped();
    expect(cell.hasAttribute('role')).toBe(false);
    expect(cell.hasAttribute('tabindex')).toBe(false);
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toMatch(/^A /);
  });

  it.each(['{Enter}', ' '])('%j on the button toggles the group and nothing else', async (key) => {
    const user = userEvent.setup();
    const { toggle, onRowClick, context, memberRows } = renderGrouped();
    expect(memberRows()).toBe(3);

    toggle.focus();
    await user.keyboard(key);
    flushSync();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(memberRows()).toBe(1);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(context().selectedItems).toHaveLength(0);
  });

  it('a click on the band outside the button toggles once', async () => {
    const user = userEvent.setup();
    const { cell, toggle, memberRows } = renderGrouped();

    await user.click(cell);
    flushSync();
    expect(memberRows()).toBe(1);

    await user.click(toggle);
    flushSync();
    expect(memberRows(), 'a click on the button bubbles once, not twice').toBe(3);
  });
});
