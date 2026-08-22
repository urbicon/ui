// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TableContext } from '$lib/core/table/index.js';
import type { Column } from '$lib/types/tableTypes';
import TableHarness from '../core/__fixtures__/TableHarness.svelte';

/**
 * An open header menu must own its keys (PR #260 review, P1).
 *
 * The menu panel renders in the DOM of its `<th>` — `usePortal` only promotes
 * it to the top layer, it does not reparent — so its keydowns bubble to
 * `handleTableKeyDown` on the interactive grid. Before the fix, ArrowDown in
 * the open menu also moved the grid's row focus (stealing DOM focus out of
 * the menu), and Escape on the focused panel ran past the form-element
 * exception (the panel is a div, not a button) into `deselectAll()`.
 *
 * The sibling suite's arrow test stayed green through this because its
 * harness is not interactive — `handleTableKeyDown` returns first thing
 * without `selectable`/`expandable`/`onRowClick`. This one is, and it carries
 * its own counter-control: the same keys WITHOUT an open menu must keep
 * driving the grid, or the rig would measure nothing.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 },
  { id: 3, name: 'Lin', amount: 300 }
];

const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount', dataType: 'number' }
] as Column<(typeof ROWS)[number]>[];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderInteractive(): { context: () => TableContext } {
  let ctx: TableContext | undefined;
  // Multi-selection + `onRowClick` make the grid interactive — the whole
  // point of this harness (see the docblock). `selectionMode`, not a
  // `selectable` flag: TableDesktop derives `selectable` from the mode.
  const props: Record<string, unknown> = {
    items: ROWS,
    columns: COLUMNS,
    selectionMode: 'multi',
    onRowClick: vi.fn(),
    onReady: (context: TableContext) => (ctx = context)
  };
  const instance = mount(TableHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return {
    context: () => {
      if (!ctx) throw new Error('onReady never fired');
      return ctx;
    }
  };
}

const menuTrigger = () => screen.getByTestId('header-menu-trigger-amount');

// The grid's focused row, read from the DOM: the roving tabindex sits on
// exactly the row `focusedRowIndex` addresses (TableRow renders
// `tabindex={isFocused ? 0 : -1}`), so a moved index is visible here without
// reaching into internal context.
const focusedRowKey = () =>
  document.querySelector('tbody tr[tabindex="0"]')?.getAttribute('data-row-index') ?? null;

describe('HeaderMenu on an interactive grid — the menu owns its keys', () => {
  it('(a) arrow keys rove the menu without moving the grid row focus', async () => {
    const user = userEvent.setup();
    renderInteractive();

    await user.click(menuTrigger());
    const rowFocusBefore = focusedRowKey();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');

    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('[role="menu"]'), 'focus must stay inside the menu').toBeTruthy();
    expect(active?.closest('tbody'), 'no body row may take focus').toBeNull();
    expect(focusedRowKey(), 'the roving row focus must not move').toBe(rowFocusBefore);
  });

  it('(b) Escape closes the menu without clearing the row selection', async () => {
    const user = userEvent.setup();
    const { context } = renderInteractive();

    context().toggleItem(1);
    context().toggleItem(2);
    flushSync();
    expect(context().selectedItems).toHaveLength(2);

    await user.click(menuTrigger());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { hidden: true }), 'menu closed').toBeNull();
    expect(context().selectedItems, 'selection survives').toHaveLength(2);
  });

  it('(d) ArrowDown on the closed trigger opens the menu without roving the grid', async () => {
    const user = userEvent.setup();
    renderInteractive();

    menuTrigger().focus();
    const rowFocusBefore = focusedRowKey();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('menu', { hidden: true }), 'menu opened').toBeTruthy();
    expect(focusedRowKey(), 'the roving row focus must not move').toBe(rowFocusBefore);
    // The return target must be the trigger, not a row Menu captured because
    // the same key roved the grid first.
    await user.keyboard('{Escape}');
    expect(document.activeElement, 'focus returns to the trigger').toBe(menuTrigger());
  });

  it('(c) counter-control: without an open menu the same keys drive the grid', async () => {
    const { context } = renderInteractive();
    const grid = screen.getByTestId('table-element');

    // ArrowDown on the grid itself moves the roving row focus …
    const before = focusedRowKey();
    grid.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    flushSync();
    expect(focusedRowKey(), 'row focus moves without a menu in the way').not.toBe(before);

    // … and Escape still clears a selection.
    context().toggleItem(1);
    context().toggleItem(2);
    flushSync();
    expect(context().selectedItems).toHaveLength(2);
    grid.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    flushSync();
    expect(context().selectedItems).toHaveLength(0);
  });
});
