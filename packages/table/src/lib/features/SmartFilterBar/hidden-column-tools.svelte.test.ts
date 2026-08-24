// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TableContext } from '$lib/core/table/index.js';
import type { InternalTableContext } from '$lib/stores/TableStore.svelte';
import type { Column } from '$lib/types/tableTypes';
import ToolSurfacesHarness from './__fixtures__/ToolSurfacesHarness.svelte';

/**
 * Hiding a column must not take its tool values off screen (#253).
 *
 * `state.columns` is the *visible* subset, and every tool surface used to
 * build its option list from it while the engines applied the full view
 * state. A column carrying an active filter, sort, grouping or aggregation
 * could therefore be hidden — two clicks in the shipped UI — and the value
 * kept acting with no surface able to show or edit it.
 *
 * Every scenario here is the same two steps: set a tool value on a column,
 * hide that column, then ask both geometries (the wide bar's menu and the
 * sheet's panel) what they show. Grouping is the positive control: it grew
 * the fallback row first, so its row must be present in both phases.
 */

type Row = {
  id: number;
  name: string;
  home: { city: string };
  stats: { amount: number };
};

const ROWS: Row[] = [
  { id: 1, name: 'Ada', home: { city: 'Berlin' }, stats: { amount: 100 } },
  { id: 2, name: 'Grace', home: { city: 'Vienna' }, stats: { amount: 200 } }
];

/**
 * Both tool-carrying columns take a **function** accessor with an explicit id,
 * which is what makes the engine half of this observable: `getNestedValue(item,
 * 'city')` cannot reach `home.city`, so a lookup that resolves the column over
 * the visible subset silently yields `undefined` once the column is hidden.
 * With a plain string accessor the fallback path happens to give the same
 * answer and the defect hides.
 */
const COLUMNS = [
  { accessor: 'name', title: 'Name', sortable: true },
  {
    id: 'city',
    accessor: (row: Row) => row.home.city,
    title: 'Location',
    sortable: true,
    groupable: true
  },
  {
    id: 'amount',
    accessor: (row: Row) => row.stats.amount,
    title: 'Amount',
    dataType: 'number',
    sortable: true
  }
] as unknown as Column[];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/**
 * The context handed to `onReady` is the store object itself; the public
 * `TableContext` is a hand-written narrowing of it. `hideColumn` lives on the
 * wide side (column visibility is prop-driven), so the cast is how a test
 * reaches the same call the shipped visibility menu makes — the same spelling
 * `Table.sharedview.svelte.test.ts` uses.
 */
function renderTable(): { ctx: () => InternalTableContext } {
  let ctx: InternalTableContext | undefined;
  const props: Record<string, unknown> = {
    items: ROWS,
    columns: COLUMNS,
    onReady: (c: TableContext) => (ctx = c as InternalTableContext)
  };
  const instance = mount(ToolSurfacesHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return {
    ctx: () => {
      if (!ctx) throw new Error('onReady never fired');
      return ctx;
    }
  };
}

const box = (testid: string) => screen.getByTestId(testid);
// Menu and Select content renders in a native popover; jsdom has no top layer,
// hence `{ hidden: true }` — see the blocks-testing skill.
const trigger = (name: string) => screen.getByRole('button', { name, hidden: true });
const names = (items: unknown[]) => items.map((item) => (item as Row).name);

describe('#253 — a hidden column keeps its tool value on screen', () => {
  it('scenario 1: the active filter of a hidden column stays shown, named and editable', async () => {
    const { ctx } = renderTable();

    ctx().addFilter({ column: 'city', operator: 'contains', value: 'Berlin' });
    ctx().hideColumn('city');
    flushSync();

    // The chip resolves its label over the declared set, so it keeps naming
    // the column rather than degrading to the raw id.
    expect(screen.getByText('Location: Berlin')).toBeTruthy();

    // …and the form still carries a section for it, with the running filter
    // listed inside — otherwise the only way out is the chip.
    const filterPanel = within(box('sheet-filter'));
    expect(filterPanel.getByRole('heading', { name: 'Location' })).toBeTruthy();
    expect(filterPanel.getByText('contains: Berlin')).toBeTruthy();
  });

  it('scenario 2: a function-accessor filter keeps matching after the column is hidden', () => {
    const { ctx } = renderTable();

    ctx().addFilter({ column: 'city', operator: 'contains', value: 'Berlin' });
    flushSync();
    expect(names(ctx().filteredItems)).toEqual(['Ada']);

    ctx().hideColumn('city');
    flushSync();

    // The filter is still running: resolving it over the visible subset made
    // every row's value `undefined`, i.e. an empty table with no editable cause.
    expect(names(ctx().filteredItems)).toEqual(['Ada']);
  });

  it('scenario 3: a hidden sorted column keeps its option, its checked radio and its order', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().setSort({ column: 'city', direction: 'desc' });
    flushSync();
    expect(names(ctx().sortedItems)).toEqual(['Grace', 'Ada']);

    ctx().hideColumn('city');
    flushSync();

    // The sheet: exactly one radio is checked, and it is the sorted column.
    const sortPanel = within(box('sheet-sort'));
    const sorted = sortPanel.getByRole('radio', { name: 'Location' }) as HTMLInputElement;
    expect(sorted.checked).toBe(true);
    expect((sortPanel.getByRole('radio', { name: 'No sorting' }) as HTMLInputElement).checked).toBe(
      false
    );

    // The wide bar: the Select's value has an option to display. Asserted on
    // the option and not on Select's own `value … has no matching option`
    // DEV-warning, which would be the better oracle but is silent here —
    // measured: with the fallback row removed again this test still fails on
    // the option, while the warning never fires, because SortMenu renders a
    // `customTrigger` and Svelte never evaluates the `selectedOptions` argument
    // it declines to read.
    await user.click(trigger('Sort'));
    expect(
      screen.getByRole('option', { name: 'Location · Descending', hidden: true })
    ).toBeTruthy();

    // …and the grid is still sorted by it, not re-ordered by an undefined value.
    expect(names(ctx().sortedItems)).toEqual(['Grace', 'Ada']);
  });

  it('scenario 4: a hidden column keeps its aggregation row in both summary editors', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().addSummaryConfig({ column: 'amount', type: 'sum' });
    ctx().hideColumn('amount');
    flushSync();

    // The sheet's panel: one radio row per column, the configured type checked.
    const summaryPanel = within(box('sheet-summary'));
    const group = summaryPanel.getByRole('radiogroup', { name: 'Amount' });
    expect((within(group).getByRole('radio', { name: 'Sum' }) as HTMLInputElement).checked).toBe(
      true
    );

    // The wide bar's menu: the same state as a `menuitemradio` group.
    await user.click(trigger('Summary'));
    const menuGroup = screen.getByRole('group', { name: 'Amount', hidden: true });
    expect(
      within(menuGroup)
        .getByRole('menuitemradio', { name: '∑ Sum', hidden: true })
        .getAttribute('aria-checked')
    ).toBe('true');

    // …and the aggregate itself stays right. The summary row draws no cell for
    // a hidden column, so this is the only place the value is observable —
    // which is exactly why it would have rotted to 0 unnoticed until the
    // column came back.
    expect(ctx().summaryData).toEqual({ amount: 300 });
  });

  it('positive control: grouping already keeps its row — and now keeps its name too', () => {
    const { ctx } = renderTable();

    ctx().setGroupBy('city');
    ctx().hideColumn('city');
    flushSync();

    // The row survived hiding before this fix; only the label degraded to the
    // humanised id, because the fallback resolved over the visible subset too.
    const groupingPanel = within(box('sheet-grouping'));
    expect(
      (groupingPanel.getByRole('radio', { name: 'Location' }) as HTMLInputElement).checked
    ).toBe(true);
    // Exactly one row for the column — the fallback must not duplicate a
    // listed entry.
    expect(groupingPanel.queryAllByRole('radio', { name: 'Location' })).toHaveLength(1);

    // And the engine still buckets by the real accessor rather than dropping
    // every row into 'Unassigned'.
    expect(Object.keys(ctx().grouped)).toEqual(['Berlin', 'Vienna']);
  });

  it('positive control: a visible column is listed once, with no fallback row beside it', () => {
    const { ctx } = renderTable();

    ctx().setSort({ column: 'city', direction: 'asc' });
    ctx().addFilter({ column: 'city', operator: 'contains', value: 'Berlin' });
    ctx().addSummaryConfig({ column: 'amount', type: 'sum' });
    flushSync();

    expect(within(box('sheet-sort')).queryAllByRole('radio', { name: 'Location' })).toHaveLength(1);
    expect(
      within(box('sheet-filter')).queryAllByRole('heading', { name: 'Location' })
    ).toHaveLength(1);
    expect(
      within(box('sheet-summary')).queryAllByRole('radiogroup', { name: 'Amount' })
    ).toHaveLength(1);
  });
});
