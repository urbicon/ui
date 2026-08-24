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
 * One empty-state policy per axis, in both geometries (#254).
 *
 * "No eligible column for this tool" used to be answered five different ways:
 * two triggers went `disabled` with nothing to say, two sheet panels carried an
 * explanation the bar did not, and three axes said nothing at all — the eye
 * opened a listbox with zero options, the filter popover was a heading plus an
 * Apply button over nothing, and grouping offered an enabled dropdown whose
 * entire content was "No grouping".
 *
 * The rule now lives beside the builders (`toolEmptyKey` in tool-columns.ts):
 * a tool with no rows is disabled in the bar and says why, and says the same
 * sentence in its sheet section — which stays where it is, because a sheet
 * whose sections come and go with the column definition jumps under the thumb.
 *
 * Every column here opts out of every axis, so all five tools are empty at
 * once — the same table the probe measured, which is what makes the two
 * already-correct axes (sort, summary) positive controls rather than a
 * separate fixture.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 }
];

/**
 * Legal, and ineligible everywhere: `sortable`/`searchable` are opt-outs,
 * `groupable`/`summable` opt-ins, `hideable: false` pins the column. A
 * consumer reaches this by declaring a table of render-only columns.
 *
 * `summable: false` on the numeric column matters — without it `dataType:
 * 'number'` would grant the summary axis a row and the axis would not be empty.
 */
const COLUMNS = [
  {
    accessor: 'name',
    title: 'Name',
    sortable: false,
    searchable: false,
    groupable: false,
    hideable: false
  },
  {
    accessor: 'amount',
    title: 'Amount',
    dataType: 'number',
    sortable: false,
    searchable: false,
    groupable: false,
    summable: false,
    hideable: false
  }
] as unknown as Column[];

const EMPTY = {
  filter: 'No column can be filtered',
  sort: 'No column can be sorted',
  grouping: 'No column can be grouped',
  summary: 'No column can be summarised',
  columns: 'Every column is pinned'
} as const;

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTable(columns: Column[] = COLUMNS): { ctx: () => InternalTableContext } {
  let ctx: InternalTableContext | undefined;
  const props: Record<string, unknown> = {
    items: ROWS,
    columns,
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

const box = (testid: string) => within(screen.getByTestId(testid));

/**
 * The wide bar's five triggers, scoped to the toolbar they live in — the sheet
 * panels below carry buttons of their own, and an unavailable trigger's name
 * grows the explanation, so the query matches on the tool name as a prefix.
 */
const barTrigger = (tool: string) =>
  within(screen.getByRole('toolbar', { name: 'Filter bar' })).getByRole('button', {
    name: new RegExp(`^${tool}`)
  }) as HTMLButtonElement;

describe('#254 — a tool with nothing to offer says the same thing in both geometries', () => {
  it('the eye: nothing hideable disables the trigger, and no listbox opens', async () => {
    const user = userEvent.setup();
    renderTable();

    const eye = barTrigger('Column visibility');
    expect(eye.disabled).toBe(true);
    // Two channels, because a disabled control's hover is not uniform across
    // browsers: the native `title` needs no event at all, and the accessible
    // name carries the sentence for a screen reader.
    expect(eye.getAttribute('title')).toBe(EMPTY.columns);
    expect(eye.getAttribute('aria-label')).toContain(EMPTY.columns);

    // The reported symptom: the eye used to open a listbox with 0 options.
    // Asserted on the expanded state and on the absence of any option in the
    // document — the `listbox` element itself is rendered by every closed
    // Select in the bar, so counting those measures nothing.
    await user.click(eye);
    expect(eye.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);

    expect(box('sheet-columns').getByText(EMPTY.columns)).toBeTruthy();
  });

  it('the funnel: nothing searchable disables the trigger, and the panel loses its Apply', () => {
    renderTable();

    const funnel = barTrigger('Add filter');
    expect(funnel.disabled).toBe(true);
    expect(funnel.getAttribute('title')).toBe(EMPTY.filter);
    expect(funnel.getAttribute('aria-label')).toContain(EMPTY.filter);

    // The reported symptom on the panel side: a heading plus an Apply button
    // over nothing. The sentence replaces the form, and the actions go with it.
    const panel = box('sheet-filter');
    expect(panel.getByText(EMPTY.filter)).toBeTruthy();
    expect(panel.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('grouping: nothing groupable disables the trigger, and "No grouping" alone is not an offer', async () => {
    const user = userEvent.setup();
    renderTable();

    const layers = barTrigger('Grouping');
    expect(layers.disabled).toBe(true);
    expect(layers.getAttribute('title')).toBe(EMPTY.grouping);
    expect(layers.getAttribute('aria-label')).toContain(EMPTY.grouping);

    await user.click(layers);
    expect(screen.queryByRole('option', { name: 'No grouping', hidden: true })).toBeNull();

    const panel = box('sheet-grouping');
    expect(panel.getByText(EMPTY.grouping)).toBeTruthy();
    expect(panel.queryByRole('radio', { name: 'No grouping' })).toBeNull();
  });

  it('positive control — sort was already disabled, and now says why in both places', () => {
    renderTable();

    const sort = barTrigger('Sort');
    expect(sort.disabled).toBe(true);
    expect(sort.getAttribute('title')).toBe(EMPTY.sort);

    // The sheet rendered this section's controls unconditionally while the bar
    // disabled the same axis — a radio list whose only row was "No sorting",
    // plus a direction control disabled beside it.
    const panel = box('sheet-sort');
    expect(panel.getByText(EMPTY.sort)).toBeTruthy();
    expect(panel.queryByRole('radio', { name: 'No sorting' })).toBeNull();
    expect(panel.queryByRole('group', { name: 'Sort direction' })).toBeNull();
  });

  it('positive control — summary was already disabled, and its panel already explained', () => {
    renderTable();

    const summary = barTrigger('Summary');
    expect(summary.disabled).toBe(true);
    expect(summary.getAttribute('title')).toBe(EMPTY.summary);

    expect(box('sheet-summary').getByText(EMPTY.summary)).toBeTruthy();
  });

  it('positive control — an eligible table keeps every trigger live and every note away', () => {
    renderTable([
      { accessor: 'name', title: 'Name', sortable: true, groupable: true },
      { accessor: 'amount', title: 'Amount', dataType: 'number', sortable: true }
    ] as unknown as Column[]);

    for (const tool of ['Add filter', 'Sort', 'Grouping', 'Summary', 'Column visibility']) {
      const trigger = barTrigger(tool);
      expect(trigger.disabled).toBe(false);
      expect(trigger.getAttribute('title')).toBeNull();
    }

    for (const sentence of Object.values(EMPTY)) {
      expect(screen.queryByText(sentence)).toBeNull();
    }
  });
});

/**
 * The offer is what a tool can act on, not what a column declares (#265).
 *
 * A value already in force gets a fallback row from the builders, so a tool
 * whose columns all opted out is still operable when something is running
 * through it — and must therefore NOT be disabled and must NOT show the note.
 * Getting this wrong would strand exactly the values #253/#265 exist to keep
 * reachable.
 */
describe('#254 — an ineligible axis with a value in force stays operable', () => {
  it('a sort running on an unsortable column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().setSort({ column: 'name', direction: 'asc' });
    flushSync();

    expect(barTrigger('Sort').disabled).toBe(false);
    const panel = box('sheet-sort');
    expect(panel.queryByText(EMPTY.sort)).toBeNull();
    expect((panel.getByRole('radio', { name: 'Name' }) as HTMLInputElement).checked).toBe(true);
  });

  it('a filter running on a searchable:false column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().addFilter({ column: 'name', operator: 'contains', value: 'Ada' });
    flushSync();

    expect(barTrigger('Add filter').disabled).toBe(false);
    const panel = box('sheet-filter');
    expect(panel.queryByText(EMPTY.filter)).toBeNull();
    // Read-only section — the way out of a filter the column no longer offers.
    expect(panel.getByRole('heading', { name: 'Name' })).toBeTruthy();
    expect(panel.getByRole('button', { name: 'Remove filter' })).toBeTruthy();
  });

  it('a grouping running on an ungroupable column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().setGroupBy('name');
    flushSync();

    expect(barTrigger('Grouping').disabled).toBe(false);
    const panel = box('sheet-grouping');
    expect(panel.queryByText(EMPTY.grouping)).toBeNull();
    expect((panel.getByRole('radio', { name: 'Name' }) as HTMLInputElement).checked).toBe(true);
  });

  it('an aggregation configured on a summable:false column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().addSummaryConfig({ column: 'amount', type: 'sum' });
    flushSync();

    expect(barTrigger('Summary').disabled).toBe(false);
    const panel = box('sheet-summary');
    expect(panel.queryByText(EMPTY.summary)).toBeNull();
    expect(panel.getByRole('radiogroup', { name: 'Amount' })).toBeTruthy();
  });
});
