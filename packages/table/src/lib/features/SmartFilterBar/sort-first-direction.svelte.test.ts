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
 * `sortDescFirst` must reach the reader who has no header to click.
 *
 * The flag decides which way a column's *first* sort step goes, and the
 * desktop reads it in `handleSort`. Below `cardsBelow` there is no header at
 * all — `TableMobile` renders cards — so the filter bar's sort panel is the
 * only sort control there is, and it must give the same answer.
 *
 * The question lives next to the capability predicates
 * (`firstSortDirectionById`) and both surfaces ask it. What follows pins the
 * two answers against each other, not each one on its own: a test that only
 * checked the panel would stay green if the header click changed underneath.
 *
 * The controls that **name** a direction are the other half of the contract and
 * are asserted here too — the panel's asc/desc segments and the wide bar's
 * `column · direction` options must keep meaning exactly what they say.
 */

type Row = { id: number; name: string; created: string };

const ROWS: Row[] = [
  { id: 1, name: 'Ada', created: '2021-03-15' },
  { id: 2, name: 'Grace', created: '2019-07-01' },
  { id: 3, name: 'Barbara', created: '2023-11-30' }
];

const COLUMNS = [
  { accessor: 'name', title: 'Name', sortable: true },
  // The reason the flag exists: newest first is what a reader means by
  // "sort by date".
  { accessor: 'created', title: 'Created', dataType: 'date', sortable: true, sortDescFirst: true }
] as unknown as Column[];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTable(): { ctx: () => InternalTableContext } {
  let ctx: InternalTableContext | undefined;
  const instance = mount(ToolSurfacesHarness, {
    target: document.body,
    props: {
      items: ROWS,
      columns: COLUMNS,
      onReady: (c: TableContext) => (ctx = c as InternalTableContext)
    }
  });
  dispose = () => unmount(instance);
  flushSync();
  return {
    ctx: () => {
      if (!ctx) throw new Error('onReady never fired');
      return ctx;
    }
  };
}

const sortPanel = () => within(screen.getByTestId('sheet-sort'));
const columnRadio = (name: string) => sortPanel().getByRole('radio', { name });
// Menu and Select content renders in a native popover; jsdom has no top layer,
// hence `{ hidden: true }` — see the blocks-testing skill.
const barTrigger = (name: string) => screen.getByRole('button', { name, hidden: true });
const names = (rows: unknown[]) => rows.map((row) => (row as Row).name);

describe('the sort panel starts a newly chosen column in its own first direction', () => {
  it('choosing a sortDescFirst column while nothing is sorted picks descending', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();
    expect(ctx().view.sort).toBeNull();

    await user.click(columnRadio('Created'));
    flushSync();

    expect(ctx().view.sort).toEqual({ column: 'created', direction: 'desc' });
    // The rows, not only the axis: newest first is the thing being asked for.
    expect(names(ctx().sortedItems)).toEqual(['Barbara', 'Ada', 'Grace']);
  });

  it('choosing it while another column is sorted picks descending too', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().setSort({ column: 'name', direction: 'asc' });
    flushSync();

    await user.click(columnRadio('Created'));
    flushSync();

    // Not `asc` inherited from the column being left behind.
    expect(ctx().view.sort).toEqual({ column: 'created', direction: 'desc' });
  });

  it('leaving it for a default column starts that one ascending', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().setSort({ column: 'created', direction: 'desc' });
    flushSync();

    await user.click(columnRadio('Name'));
    flushSync();

    // The direction belongs to the column, not to the panel: `desc` was
    // Created's first step and must not travel to Name.
    expect(ctx().view.sort).toEqual({ column: 'name', direction: 'asc' });
    expect(names(ctx().sortedItems)).toEqual(['Ada', 'Barbara', 'Grace']);
  });

  it('“No sorting” still clears, whatever the column would have asked for', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().setSort({ column: 'created', direction: 'desc' });
    flushSync();

    await user.click(columnRadio('No sorting'));
    flushSync();

    expect(ctx().view.sort).toBeNull();
  });

  it('agrees with the header click on the same column', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    // The desktop's answer…
    ctx().handleSort('created');
    flushSync();
    const fromHeader = { ...ctx().view.sort };

    ctx().setSort(null);
    flushSync();

    // …and the phone's, for the same first choice. This is the disagreement
    // the shared helper exists to make unrepresentable.
    await user.click(columnRadio('Created'));
    flushSync();

    expect(ctx().view.sort).toEqual(fromHeader);
    expect(fromHeader).toEqual({ column: 'created', direction: 'desc' });
  });
});

describe('controls that name a direction keep saying exactly what they say', () => {
  it('the panel’s segments set the direction they are labelled with', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    await user.click(columnRadio('Created'));
    flushSync();
    expect(ctx().view.sort).toEqual({ column: 'created', direction: 'desc' });

    // An explicit pick outranks the column's preference — and is not undone
    // by the panel re-deriving anything.
    await user.click(sortPanel().getByRole('radio', { name: 'Ascending' }));
    flushSync();
    expect(ctx().view.sort).toEqual({ column: 'created', direction: 'asc' });
    expect(names(ctx().sortedItems)).toEqual(['Grace', 'Ada', 'Barbara']);
  });

  it('the wide bar offers both directions per column and sets the one chosen', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    // SortMenu is the cartesian product of columns and directions, so it never
    // has a bare "choose this column" step to answer — every row already names
    // its direction. Ascending on a `sortDescFirst` column is a legitimate,
    // reachable choice and must survive the pick.
    await user.click(barTrigger('Sort'));
    await user.click(screen.getByRole('option', { name: 'Created · Ascending', hidden: true }));
    flushSync();

    expect(ctx().view.sort).toEqual({ column: 'created', direction: 'asc' });
    expect(names(ctx().sortedItems)).toEqual(['Grace', 'Ada', 'Barbara']);
  });
});

describe('the first direction survives its column being hidden', () => {
  it('a hidden sortDescFirst column still starts descending on handleSort', () => {
    const { ctx } = renderTable();

    // `state.columns` is the visible subset and `state.allColumns` the declared
    // set; every by-id lookup in the concerns reads the second (#253). Resolving
    // the flag over the visible one instead makes a hidden column silently lose
    // its first direction — a sort survives hiding, so its definition must too.
    ctx().hideColumn('created');
    flushSync();
    expect(ctx().state.columns.map((c) => c.title)).toEqual(['Name']);

    ctx().handleSort('created');
    flushSync();

    expect(ctx().view.sort).toEqual({ column: 'created', direction: 'desc' });
    expect(names(ctx().sortedItems)).toEqual(['Barbara', 'Ada', 'Grace']);
  });
});
