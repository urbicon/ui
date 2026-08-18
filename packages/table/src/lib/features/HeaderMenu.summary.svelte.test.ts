// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
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
 * two surfaces disagree about what a column could even be set to. The entry now
 * expands into the same six.
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

// By test id, not by name: the SmartFilterBar carries its own "Summary"
// button, and a role+name query finds that one instead.
//
// `{ hidden: true }` on every role query: the menu lives in a native popover,
// which jsdom has no top layer for — see the blocks-testing skill. These
// assertions are about the interaction logic, not about visibility; that is
// Playwright's job.
const menuTrigger = () => screen.getByTestId('header-menu-trigger-amount');
const summaryRow = () => screen.getByTestId('header-menu-summary-amount');
const summaryTypes = () => within(screen.getByTestId('header-menu-summary-types-amount'));

async function openSummary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(menuTrigger());
  await user.click(summaryRow());
}

describe('HeaderMenu — summary', () => {
  it('offers every aggregation, not just the one it would have guessed', async () => {
    const user = userEvent.setup();
    renderTable();

    await openSummary(user);

    for (const label of ['Sum', 'Average', 'Count', 'Minimum', 'Maximum', 'None']) {
      expect(summaryTypes().getByRole('button', { name: label, hidden: true }), label).toBeTruthy();
    }
  });

  it('applies the aggregation the reader picks, including one the toggle could never reach', async () => {
    const user = userEvent.setup();
    renderTable();

    await openSummary(user);
    // `avg` on a number column: the old toggle hardcoded `sum` here.
    await user.click(summaryTypes().getByRole('button', { name: 'Average', hidden: true }));

    await user.click(menuTrigger());
    expect(summaryRow().textContent).toContain('Average');
  });

  it('marks the active aggregation and clears it through "None"', async () => {
    const user = userEvent.setup();
    renderTable();

    await openSummary(user);
    await user.click(summaryTypes().getByRole('button', { name: 'Minimum', hidden: true }));

    await openSummary(user);
    expect(
      summaryTypes()
        .getByRole('button', { name: 'Minimum', hidden: true })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      summaryTypes().getByRole('button', { name: 'Sum', hidden: true }).getAttribute('aria-pressed')
    ).toBe('false');

    await user.click(summaryTypes().getByRole('button', { name: 'None', hidden: true }));

    await user.click(menuTrigger());
    expect(summaryRow().textContent).toContain('None');
  });

  it('leaves a column that cannot be summarised without the entry', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByTestId('header-menu-trigger-name'));

    expect(screen.queryByTestId('header-menu-summary-name')).toBeNull();
  });
});
