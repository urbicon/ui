// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TableContext } from '$lib/core/table/index.js';
import type { Column } from '$lib/types/tableTypes';
import TableHarness from '../core/__fixtures__/TableHarness.svelte';

/**
 * `toggleSummary()` against every surface that announces a summary (#252).
 *
 * The toggle is public API with no built-in UI, so `showSummary === false`
 * while `summaryConfigs` is non-empty is a state a consumer's own "show
 * totals" switch reaches — and every surface used to decide on its own whether
 * to combine the two fields. Three carried a copy of the gate, five did not:
 * the filter bar's Σ trigger stayed lit with a badge reading "2", the summary
 * chips stayed on the bar and the head kept its indicator dots, all while no
 * summary row existed in either layout and the tool count on that same bar
 * said 0.
 *
 * The store now answers that question once (`effectiveSummaryConfigs`), so the
 * assertions below are about one derivation reaching every reader. They mount
 * the full table because the contradiction was *between* components; a unit
 * check on the derived would prove none of it.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100, price: 5 },
  { id: 2, name: 'Grace', amount: 200, price: 9 }
];

// `dataType: 'number'` is what makes a column summable — utils/column-capabilities.ts.
const COLUMNS = [
  { accessor: 'name', title: 'Name' },
  { accessor: 'amount', title: 'Amount', dataType: 'number' },
  { accessor: 'price', title: 'Price', dataType: 'number' }
] as Column[];

// Two columns, two different aggregations: a single config could not tell
// "the set came back" from "one pick landed".
const SEED = [
  { column: 'amount', type: 'sum' as const },
  { column: 'price', type: 'min' as const }
];

let dispose: (() => void) | undefined;
let restoreComputedStyle: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  restoreComputedStyle?.();
  restoreComputedStyle = undefined;
  document.body.replaceChildren();
});

function renderTable(props: Record<string, unknown> = {}): { context: () => TableContext } {
  let ctx: TableContext | undefined;
  // `Record<string, unknown>`, like the sister suites: the harness fixture
  // types `columns` against its own three-field demo row, and this fixture
  // needs a fourth summable column.
  const mountProps: Record<string, unknown> = {
    items: ROWS,
    columns: COLUMNS,
    enableSmartFilter: true,
    onReady: (context: TableContext) => (ctx = context),
    ...props
  };
  const instance = mount(TableHarness, { target: document.body, props: mountProps });
  dispose = () => unmount(instance);
  flushSync();
  return {
    context: () => {
      if (!ctx) throw new Error('onReady never fired');
      return ctx;
    }
  };
}

/**
 * Put the filter bar into its narrow (sheet) mode.
 *
 * Which mode the bar is in is a container-query decision that CSS makes and
 * the bar only *reads*, as the custom property `--blocks-table-tools` (#133) —
 * and jsdom resolves no container queries, so the property is empty there and
 * the bar is always wide. The stub answers that one property and passes every
 * other read through, which is the smallest lie that reaches the tool button.
 */
function forceCompactBar() {
  const real = window.getComputedStyle;
  window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    const style = real.call(window, element, pseudo ?? undefined);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (name: string) =>
            name === '--blocks-table-tools' ? 'sheet' : target.getPropertyValue(name);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
      }
    });
  }) as typeof window.getComputedStyle;
  restoreComputedStyle = () => {
    window.getComputedStyle = real;
  };
}

// Menus and tooltips live in a native popover, which jsdom has no top layer
// for — hence `{ hidden: true }` everywhere; see the blocks-testing skill.
const summaryTrigger = () => screen.getByRole('button', { name: 'Summary', hidden: true });
const query = (testId: string) => screen.queryByTestId(testId);

/** Every surface that claims a summary is acting on the grid, read at once. */
function announcements() {
  const trigger = summaryTrigger();
  return {
    desktopRow: query('summary-row-total') !== null,
    mobileBand: screen.queryByText('Total summary') !== null,
    triggerLit: /\bbg-summary-subtle\b/.test(trigger.className),
    triggerBadge: within(trigger).queryByText('2') !== null,
    chips: [
      screen.queryByText('Sum: Amount') !== null,
      screen.queryByText('Minimum: Price') !== null
    ],
    headDots: [
      query('summary-indicator-amount') !== null,
      query('summary-indicator-price') !== null
    ]
  };
}

const ALL_ANNOUNCING = {
  desktopRow: true,
  mobileBand: true,
  triggerLit: true,
  triggerBadge: true,
  chips: [true, true],
  headDots: [true, true]
};

const ALL_QUIET = {
  desktopRow: false,
  mobileBand: false,
  triggerLit: false,
  triggerBadge: false,
  chips: [false, false],
  headDots: [false, false]
};

describe('toggleSummary(): the surfaces that announce a summary', () => {
  it('all go quiet together when the row is hidden, and all come back when it returns', () => {
    const { context } = renderTable();

    context().setSummaryConfigs(SEED);
    flushSync();
    // Positive control first: with the row shown, every surface speaks — an
    // assertion that only checked the quiet state would pass on a table that
    // never rendered a summary at all.
    expect(announcements()).toEqual(ALL_ANNOUNCING);

    context().toggleSummary();
    flushSync();

    expect(context().state.summaryConfigs).toEqual(SEED);
    expect(announcements()).toEqual(ALL_QUIET);

    // …and back: hiding is not deleting.
    context().toggleSummary();
    flushSync();
    expect(announcements()).toEqual(ALL_ANNOUNCING);
  });

  it('the derived totals go with them — a hidden row computes nothing', () => {
    const { context } = renderTable();

    context().setSummaryConfigs(SEED);
    flushSync();
    expect(screen.getByTestId('summary-cell-amount').textContent).toContain('300');

    context().toggleSummary();
    flushSync();
    expect(query('summary-cell-amount')).toBeNull();
  });

  it('the narrow bar counts the same summary its wide sibling does', () => {
    // The tool button is the surface that exposed the contradiction: it read
    // the gate correctly and therefore said 0 while the Σ trigger beside it —
    // the same bar, one breakpoint apart — was lit with a badge.
    forceCompactBar();
    const { context } = renderTable();
    flushSync();

    const tools = () => screen.getByTestId('tools-trigger');
    context().setSummaryConfigs(SEED);
    flushSync();
    expect(tools().getAttribute('aria-label')).toBe('Table tools, 1 active');

    context().toggleSummary();
    flushSync();
    expect(tools().getAttribute('aria-label')).toBe('Table tools');
    expect(within(tools()).queryByText('1')).toBeNull();

    context().toggleSummary();
    flushSync();
    expect(tools().getAttribute('aria-label')).toBe('Table tools, 1 active');
  });
});

describe('toggleSummary(): the editing controls', () => {
  it('still show what a column is configured to aggregate while the row is hidden', async () => {
    // The deviation from "everything goes quiet", decided in HeaderMenu.svelte:
    // a radio's value is the control's own state, not a claim about the grid.
    // Silencing it would announce "Summary, None" and then, one keypress later,
    // "Sum, checked" — and would leave a configured aggregation that displays
    // nowhere with no row that removes it.
    const user = userEvent.setup();
    const { context } = renderTable();

    context().setSummaryConfigs(SEED);
    context().toggleSummary();
    flushSync();
    expect(query('summary-row-total')).toBeNull();

    await user.click(screen.getByTestId('header-menu-trigger-amount'));
    await user.click(screen.getByRole('menuitem', { name: 'Summary', hidden: true }));

    expect(
      screen.getByRole('menuitemradio', { name: 'Sum', hidden: true }).getAttribute('aria-checked')
    ).toBe('true');
    expect(
      screen.getByRole('menuitemradio', { name: 'None', hidden: true }).getAttribute('aria-checked')
    ).toBe('false');
  });

  it('a pick from the hidden state brings back exactly the set the control showed', async () => {
    // Every write funnels through `setSummaryConfigs`, which derives
    // `showSummary` from the count — so an edit unhides the whole configured
    // set, not just the edited column. That is the reason the controls keep
    // showing it: what they display is what the next pick puts on screen.
    const user = userEvent.setup();
    const { context } = renderTable();

    context().setSummaryConfigs(SEED);
    context().toggleSummary();
    flushSync();

    await user.click(screen.getByTestId('header-menu-trigger-amount'));
    await user.click(screen.getByRole('menuitem', { name: 'Summary', hidden: true }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Average', hidden: true }));

    expect(context().state.summaryConfigs).toEqual([
      { column: 'amount', type: 'avg' },
      { column: 'price', type: 'min' }
    ]);
    expect(screen.getByText('Average: Amount')).toBeTruthy();
    expect(screen.getByText('Minimum: Price')).toBeTruthy();
    expect(screen.getByTestId('summary-row-total')).toBeTruthy();
  });
});
