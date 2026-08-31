// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TableContext } from '$lib/core/table/index.js';
import type { Column } from '$lib/types/tableTypes';
import { installMemoryStorage, restoreStorage } from '../../../../../scripts/vitest-storage';
import TableHarness from '../core/__fixtures__/TableHarness.svelte';

/**
 * The closed summary vocabulary (#251) at its two runtime entry points.
 *
 * The five aggregation codes used to exist in five hand-written copies, and
 * two entrances accepted a code *outside* the union: prefs hydration checked
 * `typeof type === 'string'` instead of membership, and the filter bar's
 * summary menu parsed its `columnId:type` compound with `split(':')`.
 * Either one put a value like `'median'` (or, via a column id containing
 * `:`, the *severed half of the id*) into the store — and the next render
 * of the summary chip crashed the whole table (`tt(undefined)` explodes in
 * i18n's `getDeepValue`). Since the poison sat in storage, reloading did not
 * help: the table was dead at mount with no UI path to recover.
 *
 * These tests mount the full table because that is where the failure lived:
 * unit checks on the guard alone would not prove the mount survives.
 */

const SUMMARY_KEY = (tableId: string) => `urbicon_table_summary_configs_${tableId}_v1`;

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 }
];

// `dataType: 'number'` makes `amount` summable — utils/column-capabilities.ts.
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount', dataType: 'number' }
] as Column<(typeof ROWS)[number]>[];

// A column id with `:` in it — GraphQL aliases and namespaced fields look like
// this. The sort menu still encodes its option values as `${columnId}:${type}`
// (the summary menu passes column and type as objects since the move to the
// Menu primitive, #240), and the id must survive the round trip into the
// store and the chip either way.
const COLON_ROWS = [
  { id: 1, name: 'Ada', 'metrics:revenue': 100 },
  { id: 2, name: 'Grace', 'metrics:revenue': 200 }
];
const COLON_COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'metrics:revenue', title: 'Revenue', dataType: 'number' }
] as Column[];

beforeEach(() => {
  installMemoryStorage();
});

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  restoreStorage();
});

function renderTable(props: Record<string, unknown>): { context: () => TableContext } {
  let ctx: TableContext | undefined;
  const instance = mount(TableHarness, {
    target: document.body,
    props: { ...props, onReady: (context: TableContext) => (ctx = context) }
  });
  dispose = () => unmount(instance);
  flushSync();
  return {
    context: () => {
      if (!ctx) throw new Error('onReady never fired');
      return ctx;
    }
  };
}

// The filter-bar triggers carry their tool's name as `aria-label`
// (MenuTrigger); the options live in a native popover, which jsdom has no top
// layer for, hence `{ hidden: true }` — see the blocks-testing skill.
const barButton = (name: string) => screen.getByRole('button', { name, hidden: true });
const option = (name: string) => screen.getByRole('option', { name, hidden: true });

describe('prefs hydration: a stored aggregation type outside the vocabulary', () => {
  it('drops the config and mounts a usable table instead of crashing (P1)', () => {
    // An older app version, another app on the same origin, or a hand-edited
    // value: the entry parses fine, only the type is not ours.
    window.localStorage.setItem(
      SUMMARY_KEY('poison'),
      JSON.stringify([{ column: 'amount', type: 'median' }])
    );

    const { context } = renderTable({
      items: ROWS,
      columns: COLUMNS,
      enableSmartFilter: true,
      prefs: { storage: 'poison' }
    });

    // The mount survived and the grid is there. `getAllBy`: the responsive
    // table renders its rows twice (table + mobile card layout).
    expect(screen.getByRole('table', { hidden: true })).toBeTruthy();
    expect(screen.getAllByText('Ada').length).toBeGreaterThan(0);
    // The poisoned config was dropped, not hydrated.
    expect(context().state.summaryConfigs).toEqual([]);
  });

  it('drops only the invalid element — a valid sibling on another column still hydrates', () => {
    // Two different columns, or the per-column normalize (last wins) would mask
    // the drop and this test would pass without any element validation.
    window.localStorage.setItem(
      SUMMARY_KEY('mixed'),
      JSON.stringify([
        { column: 'name', type: 'median' },
        { column: 'amount', type: 'sum' }
      ])
    );

    const { context } = renderTable({
      items: ROWS,
      columns: COLUMNS,
      enableSmartFilter: true,
      prefs: { storage: 'mixed' }
    });

    expect(context().state.summaryConfigs).toEqual([{ column: 'amount', type: 'sum' }]);
  });

  it('a fully poisoned stored entry counts as absent — prefs defaults apply instead', () => {
    // The empty set left after dropping every element was never chosen by
    // the user; honouring it would silently suppress the declared default
    // until the user touches the axis.
    window.localStorage.setItem(
      SUMMARY_KEY('poison-defaults'),
      JSON.stringify([{ column: 'amount', type: 'median' }])
    );

    const { context } = renderTable({
      items: ROWS,
      columns: COLUMNS,
      enableSmartFilter: true,
      prefs: {
        storage: 'poison-defaults',
        defaults: { summaries: [{ column: 'amount', type: 'sum' }] }
      }
    });

    expect(context().state.summaryConfigs).toEqual([{ column: 'amount', type: 'sum' }]);
  });

  it('positive control: a genuinely stored empty set still suppresses the defaults', () => {
    // `[]` written by a user who removed every summary is a real state and
    // must keep winning over `defaults.summaries` — only the all-dropped
    // case above counts as absent.
    window.localStorage.setItem(SUMMARY_KEY('empty-real'), JSON.stringify([]));

    const { context } = renderTable({
      items: ROWS,
      columns: COLUMNS,
      enableSmartFilter: true,
      prefs: {
        storage: 'empty-real',
        defaults: { summaries: [{ column: 'amount', type: 'sum' }] }
      }
    });

    expect(context().state.summaryConfigs).toEqual([]);
    expect(context().state.showSummary).toBe(false);
  });

  it('positive control: a valid stored config renders its chip', () => {
    window.localStorage.setItem(
      SUMMARY_KEY('valid'),
      JSON.stringify([{ column: 'amount', type: 'avg' }])
    );

    renderTable({
      items: ROWS,
      columns: COLUMNS,
      enableSmartFilter: true,
      prefs: { storage: 'valid' }
    });

    expect(screen.getByText('Average: Amount')).toBeTruthy();
  });
});

describe('compound option values vs a column id containing ":"', () => {
  it('the summary menu stores the full id and the chip renders', async () => {
    const user = userEvent.setup();
    const { context } = renderTable({
      items: COLON_ROWS,
      columns: COLON_COLUMNS,
      enableSmartFilter: true
    });

    // The summary menu is a `role="menu"` since #240 — its rows are
    // menuitemradio, not listbox options.
    await user.click(barButton('Summary'));
    await user.click(screen.getByRole('menuitemradio', { name: '∑ Sum', hidden: true }));

    // The id survived the round trip un-severed…
    expect(context().state.summaryConfigs).toEqual([{ column: 'metrics:revenue', type: 'sum' }]);
    // …and the chip names the aggregation, not a TypeError.
    expect(screen.getByText('Sum: Revenue')).toBeTruthy();
  });

  it('the sort menu sorts the column instead of a silent no-op', async () => {
    const user = userEvent.setup();
    const { context } = renderTable({
      items: COLON_ROWS,
      columns: COLON_COLUMNS,
      enableSmartFilter: true
    });

    await user.click(barButton('Sort'));
    await user.click(option('Revenue · Ascending'));

    expect(context().view.sort).toEqual({ column: 'metrics:revenue', direction: 'asc' });
    const header = screen.getByRole('columnheader', { name: /Revenue/, hidden: true });
    expect(header.getAttribute('aria-sort')).toBe('ascending');
  });
});
