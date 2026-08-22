// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import TableHarness from '../core/__fixtures__/TableHarness.svelte';

/**
 * The column menu's summary entry.
 *
 * It used to be a toggle that chose the aggregation for you — `sum` for a
 * number column, `count` for anything else — so an average was unreachable
 * from the header, while the tools sheet offered all six states. That made the
 * two surfaces disagree about what a column could even be set to. The entry
 * expands into the same six — since the move to the Menu primitive (#240) as
 * a sub-menu of `menuitemradio` rows whose active one is `aria-checked`, with
 * the collapsed parent row reading the choice out via its `detail` text.
 *
 * The menu had no test of any kind before this file, which is why the wrong
 * behaviour could sit there: the package's 699 green tests never rendered it.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 }
];

// `amount` carries `dataType: 'number'`, which is what makes it summable —
// see utils/column-capabilities.ts.
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

function renderTable() {
  const instance = mount(TableHarness, {
    target: document.body,
    props: { items: ROWS, columns: COLUMNS }
  });
  dispose = () => unmount(instance);
  flushSync();
}

// The trigger still carries a test id (it is our own Button in the
// customTrigger snippet); everything below it is queried by role + accessible
// name — MenuItem does not forward `data-*` attributes, and role queries are
// exactly what the move to the Menu primitive bought. Disambiguation against
// the filter bar's "Summary" tool holds via the role: that one is a `button`,
// the row here is a `menuitem`.
//
// `{ hidden: true }` on every role query: the menu lives in a native popover,
// which jsdom has no top layer for — see the blocks-testing skill. These
// assertions are about the interaction logic, not about visibility; that is
// Playwright's job.
const menuTrigger = () => screen.getByTestId('header-menu-trigger-amount');
const summaryRow = () => screen.getByRole('menuitem', { name: 'Summary', hidden: true });
const typeItem = (name: string) => screen.getByRole('menuitemradio', { name, hidden: true });

async function openSummary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(menuTrigger());
  await user.click(summaryRow());
}

describe('HeaderMenu — menu semantics', () => {
  it('is a real menu: role="menu" behind an aria-haspopup trigger, arrow keys rove the items', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(menuTrigger().getAttribute('aria-haspopup')).toBe('menu');

    await user.click(menuTrigger());

    expect(screen.getByRole('menu', { hidden: true })).toBeTruthy();

    // Positive control for the keyboard model: pointer-open parks focus on the
    // panel; ArrowDown must then actually MOVE focus row by row — including
    // onto `menuitemradio` rows, which a reduced role set would silently skip
    // (the Popover-of-buttons this replaced had no arrow navigation at all).
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(typeItem('Sort ascending'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(typeItem('Sort descending'));
  });

  it('ArrowDown on the closed trigger opens the menu; Shift+Arrow stays with the header', async () => {
    const user = userEvent.setup();
    renderTable();

    menuTrigger().focus();

    // Modified arrows are not ours — the surrounding header owns Shift+Arrow
    // for column reorder, so the trigger must let them pass.
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(screen.queryByRole('menu', { hidden: true })).toBeNull();

    // APG menu button: plain ArrowDown opens (Menu's default trigger can do
    // this; the customTrigger has to repeat it).
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { hidden: true })).toBeTruthy();
  });

  it('announces the effective sort direction as aria-checked, not just a tint', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(menuTrigger());
    await user.click(typeItem('Sort ascending'));

    await user.click(menuTrigger());
    expect(typeItem('Sort ascending').getAttribute('aria-checked')).toBe('true');
    expect(typeItem('Sort descending').getAttribute('aria-checked')).toBe('false');
  });
});

describe('HeaderMenu — summary', () => {
  it('offers every aggregation, not just the one it would have guessed', async () => {
    const user = userEvent.setup();
    renderTable();

    await openSummary(user);

    for (const label of ['None', 'Sum', 'Average', 'Count', 'Minimum', 'Maximum']) {
      expect(typeItem(label), label).toBeTruthy();
    }
  });

  it('applies the aggregation the reader picks, including one the toggle could never reach', async () => {
    const user = userEvent.setup();
    renderTable();

    await openSummary(user);
    // `avg` on a number column: the old toggle hardcoded `sum` here.
    await user.click(typeItem('Average'));

    // The collapsed parent row reads the choice out via `detail` —
    // "Summary — Average" — while its accessible NAME stays "Summary"
    // (the detail span is a description, aria-describedby).
    await user.click(menuTrigger());
    expect(summaryRow().textContent).toContain('Average');
    expect(summaryRow().getAttribute('aria-describedby')).toBeTruthy();
  });

  it('marks the active aggregation aria-checked and clears it through "None"', async () => {
    const user = userEvent.setup();
    renderTable();

    await openSummary(user);
    await user.click(typeItem('Minimum'));

    await openSummary(user);
    expect(typeItem('Minimum').getAttribute('aria-checked')).toBe('true');
    expect(typeItem('Sum').getAttribute('aria-checked')).toBe('false');

    await user.click(typeItem('None'));

    await user.click(menuTrigger());
    expect(summaryRow().textContent).toContain('None');
  });

  it('leaves a column that cannot be summarised without the entry', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByTestId('header-menu-trigger-name'));

    expect(screen.queryByRole('menuitem', { name: 'Summary', hidden: true })).toBeNull();
  });
});
