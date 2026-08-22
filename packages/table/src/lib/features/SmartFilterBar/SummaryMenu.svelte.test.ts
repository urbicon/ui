// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TableContext } from '$lib/core/table/index.js';
import type { Column } from '$lib/types/tableTypes';
import TableHarness from '../../core/__fixtures__/TableHarness.svelte';

/**
 * The filter bar's summary tool as a `role="menu"` (#240).
 *
 * It used to be a Select worn as a command surface: an additive-looking
 * "pick a column·type to add" list that encoded each option as
 * `columnId:type`, marked the active combination `disabled`, and had to
 * reset its own value after every pick. Now it shows the store's actual
 * shape — one `role="group"` per summable column, six `menuitemradio` rows
 * inside (None + the five vocabulary types), the active one `aria-checked`
 * — and "None" removes the aggregation through the public
 * `removeSummaryConfig`. The `columnId:type` compound is gone from this
 * menu entirely; the colon-id regression suite next door
 * (summary-vocabulary.svelte.test.ts) keeps guarding the id round trip.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100, price: 5 },
  { id: 2, name: 'Grace', amount: 200, price: 9 }
];

// Two summable columns, so the per-column grouping is observable — and a
// mislabelled group would put a pick on the wrong column.
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount', dataType: 'number' },
  { accessor: 'price', title: 'Price', dataType: 'number' }
] as Column[];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTable(): { context: () => TableContext } {
  let ctx: TableContext | undefined;
  // `Record<string, unknown>`, like the sister suite next door: the harness
  // fixture types `columns` against its own three-field demo row, and the
  // point of THIS fixture is a fourth summable column.
  const props: Record<string, unknown> = {
    items: ROWS,
    columns: COLUMNS,
    enableSmartFilter: true,
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

// The menu content lives in a native popover; jsdom has no top layer, hence
// `{ hidden: true }` — see the blocks-testing skill.
const trigger = () => screen.getByRole('button', { name: 'Summary', hidden: true });
const columnGroup = (name: string) => screen.getByRole('group', { name, hidden: true });
const radioIn = (group: HTMLElement, name: string) =>
  within(group).getByRole('menuitemradio', { name, hidden: true });

describe('SummaryMenu — a menu of radio groups', () => {
  it('offers the six states per summable column, grouped under the column title', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');

    await user.click(trigger());

    for (const columnTitle of ['Amount', 'Price']) {
      const group = columnGroup(columnTitle);
      for (const label of ['None', '∑ Sum', '⌀ Average', '# Count', '↓ Minimum', '↑ Maximum']) {
        expect(radioIn(group, label), `${columnTitle} / ${label}`).toBeTruthy();
      }
      // Nothing is configured yet: None is the effective state.
      expect(radioIn(group, 'None').getAttribute('aria-checked')).toBe('true');
    }
  });

  it('ArrowDown on the closed trigger opens the menu (APG menu button)', async () => {
    const user = userEvent.setup();
    renderTable();

    trigger().focus();
    expect(screen.queryByRole('menu', { hidden: true })).toBeNull();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { hidden: true })).toBeTruthy();
  });

  it('marks the active combination aria-checked — still clickable, not the old disabled hack', async () => {
    const user = userEvent.setup();
    const { context } = renderTable();

    await user.click(trigger());
    await user.click(radioIn(columnGroup('Amount'), '∑ Sum'));

    expect(context().state.summaryConfigs).toEqual([{ column: 'amount', type: 'sum' }]);

    await user.click(trigger());
    const amount = columnGroup('Amount');
    const active = radioIn(amount, '∑ Sum');
    expect(active.getAttribute('aria-checked')).toBe('true');
    // The Select marked the active option `disabled`; a checked radio must
    // stay activatable (re-picking it is a no-op replace, not an error).
    expect(active.hasAttribute('disabled')).toBe(false);
    expect(active.getAttribute('aria-disabled')).toBeNull();
    expect(radioIn(amount, '⌀ Average').getAttribute('aria-checked')).toBe('false');
    // The sibling column is untouched.
    expect(radioIn(columnGroup('Price'), 'None').getAttribute('aria-checked')).toBe('true');
  });

  it('"None" removes the aggregation through removeSummaryConfig', async () => {
    const user = userEvent.setup();
    const { context } = renderTable();

    await user.click(trigger());
    await user.click(radioIn(columnGroup('Price'), '↓ Minimum'));
    expect(context().state.summaryConfigs).toEqual([{ column: 'price', type: 'min' }]);

    await user.click(trigger());
    await user.click(radioIn(columnGroup('Price'), 'None'));

    expect(context().state.summaryConfigs).toEqual([]);

    await user.click(trigger());
    expect(radioIn(columnGroup('Price'), 'None').getAttribute('aria-checked')).toBe('true');
  });
});
