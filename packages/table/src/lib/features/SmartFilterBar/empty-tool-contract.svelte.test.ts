// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TableHarness from '$lib/core/__fixtures__/TableHarness.svelte';
import type { TableContext } from '$lib/core/table/index.js';
import type { InternalTableContext } from '$lib/stores/TableStore.svelte';
import type { Column } from '$lib/types/tableTypes';
import ToolSurfacesHarness from './__fixtures__/ToolSurfacesHarness.svelte';

/**
 * One empty-state policy per axis, in both geometries (#254).
 *
 * "No eligible column for this tool" used to be answered five different ways:
 * two triggers went inert with nothing to say, two sheet panels carried an
 * explanation the bar did not, and three axes said nothing at all — the eye
 * opened a listbox with zero options, the filter popover was a heading plus an
 * Apply button over nothing, and grouping offered a live dropdown whose entire
 * content was "No grouping".
 *
 * The rule now lives beside the builders (`toolEmptyKey` in tool-columns.ts):
 * a tool with no rows refuses its activation in the bar and says why, and says
 * the same sentence in its sheet section — which stays where it is, because a
 * sheet whose sections come and go with the column definition moves the other
 * four under the reader's thumb.
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

/** Tool name in the bar → the sentence its axis says when it has no rows. */
const EMPTY = {
  'Add filter': 'No column can be filtered',
  Sort: 'No column can be sorted',
  Grouping: 'No column can be grouped',
  Summary: 'No column can be summarized',
  'Column visibility': 'Every column is pinned'
} as const;

let dispose: (() => void) | undefined;
let restoreComputedStyle: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  restoreComputedStyle?.();
  restoreComputedStyle = undefined;
  vi.useRealTimers();
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

/**
 * What an unavailable trigger looks like, asserted the same way for all five:
 * `aria-disabled` and NOT the native attribute (see MenuTrigger for why that
 * difference is load-bearing), with the sentence in the accessible name behind
 * the tool's own name.
 */
function expectRefused(tool: keyof typeof EMPTY) {
  const trigger = barTrigger(tool);
  expect(trigger.getAttribute('aria-disabled')).toBe('true');
  expect(trigger.disabled).toBe(false);
  expect(trigger.getAttribute('aria-label')).toBe(`${tool} · ${EMPTY[tool]}`);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  return trigger;
}

describe('#254 — a tool with nothing to offer says the same thing in both geometries', () => {
  it('the eye: nothing hideable refuses the trigger, and no listbox opens', async () => {
    const user = userEvent.setup();
    renderTable();

    const eye = expectRefused('Column visibility');

    // The reported symptom: the eye used to open a listbox with 0 options.
    // Asserted on the expanded state and on the absence of any option in the
    // document — the `listbox` element itself is rendered by every closed
    // Select in the bar, so counting those measures nothing.
    await user.click(eye);
    expect(eye.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);

    expect(box('sheet-columns').getByText(EMPTY['Column visibility'])).toBeTruthy();
  });

  it('the funnel: nothing searchable refuses the trigger, and the panel loses its Apply', () => {
    renderTable();

    expectRefused('Add filter');

    // The reported symptom on the panel side: a heading plus an Apply button
    // over nothing. The sentence replaces the form, and the actions go with it.
    const panel = box('sheet-filter');
    expect(panel.getByText(EMPTY['Add filter'])).toBeTruthy();
    expect(panel.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('grouping: nothing groupable refuses the trigger, and "No grouping" alone is not an offer', async () => {
    const user = userEvent.setup();
    renderTable();

    const layers = expectRefused('Grouping');

    await user.click(layers);
    expect(screen.queryByRole('option', { name: 'No grouping', hidden: true })).toBeNull();

    const panel = box('sheet-grouping');
    expect(panel.getByText(EMPTY.Grouping)).toBeTruthy();
    expect(panel.queryByRole('radio', { name: 'No grouping' })).toBeNull();
  });

  it('positive control — sort was already inert, and now says why in both places', () => {
    renderTable();

    expectRefused('Sort');

    // The sheet rendered this section's controls unconditionally while the bar
    // refused the same axis — a radio list whose only row was "No sorting",
    // plus a direction control disabled beside it.
    const panel = box('sheet-sort');
    expect(panel.getByText(EMPTY.Sort)).toBeTruthy();
    expect(panel.queryByRole('radio', { name: 'No sorting' })).toBeNull();
    expect(panel.queryByRole('group', { name: 'Sort direction' })).toBeNull();
  });

  it('positive control — summary was already inert, and its panel already explained', () => {
    renderTable();

    expectRefused('Summary');
    expect(box('sheet-summary').getByText(EMPTY.Summary)).toBeTruthy();
  });

  it('positive control — an eligible table keeps every trigger live and every note away', () => {
    renderTable([
      { accessor: 'name', title: 'Name', sortable: true, groupable: true },
      { accessor: 'amount', title: 'Amount', dataType: 'number', sortable: true }
    ] as unknown as Column[]);

    for (const tool of Object.keys(EMPTY)) {
      const trigger = barTrigger(tool);
      expect(trigger.getAttribute('aria-disabled')).toBe('false');
      expect(trigger.getAttribute('aria-label')).toBe(tool);
    }

    for (const sentence of Object.values(EMPTY)) {
      expect(screen.queryByText(sentence)).toBeNull();
    }
  });
});

/**
 * How an unavailable trigger refuses.
 *
 * Not with the native `disabled` attribute, which would take the control out of
 * the tab order — and the wide bar is the geometry with no sheet section to
 * fall back on, so a keyboard user would never meet the sentence at all. It
 * keeps its tab stop and swallows the activation instead, which has to cover
 * the pointer *and* the keyboard: the overlays wrap the trigger in an element
 * carrying their own `onclick`/`onkeydown`, so an unstopped event opens the
 * panel from the wrapper even though the button itself did nothing.
 */
describe('#254 — an unavailable trigger refuses without leaving the keyboard behind', () => {
  it('keeps its tab stop and hands the sentence to a keyboard user', () => {
    vi.useFakeTimers();
    renderTable();

    const sort = barTrigger('Sort');
    sort.focus();
    expect(document.activeElement).toBe(sort);

    // Tooltip opens on `focusin` after its show delay and marks the trigger
    // wrapper `aria-describedby`. Read through to the text rather than at the
    // attribute: the tooltip element is mounted either way, so only the pairing
    // proves the sentence is actually offered.
    vi.advanceTimersByTime(300);
    flushSync();
    const describedBy = sort.parentElement?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toContain(EMPTY.Sort);
  });

  it('swallows the pointer and the Enter/Space activation on every axis', async () => {
    const user = userEvent.setup();
    renderTable();

    for (const tool of Object.keys(EMPTY)) {
      const trigger = barTrigger(tool);

      await user.click(trigger);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      trigger.focus();
      await user.keyboard('{Enter}');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      await user.keyboard(' ');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    }

    // And nothing anywhere opened as a result of any of it.
    expect(screen.queryAllByRole('option', { hidden: true })).toHaveLength(0);
    expect(screen.queryAllByRole('menuitemradio', { hidden: true })).toHaveLength(0);
  });

  it('keeps announcing the filter tool as a dialog trigger while it is empty', () => {
    renderTable();

    // Popover forwards `aria-haspopup="dialog"` onto the trigger, but only
    // while `autoTrigger` is on. Gating that flag on the empty state — the
    // first way this refusal was built — left an empty filter tool announcing
    // itself as a menu button.
    expect(barTrigger('Add filter').getAttribute('aria-haspopup')).toBe('dialog');
  });
});

/**
 * The offer is what a tool can act on, not what a column declares (#265).
 *
 * A value already in force gets a fallback row from the builders, so a tool
 * whose columns all opted out is still operable when something is running
 * through it — and must therefore NOT refuse and must NOT show the note.
 * Getting this wrong would strand exactly the values #253/#265 exist to keep
 * reachable.
 */
describe('#254 — an ineligible axis with a value in force stays operable', () => {
  const live = (tool: keyof typeof EMPTY) => {
    const trigger = barTrigger(tool);
    expect(trigger.getAttribute('aria-disabled')).toBe('false');
    return trigger;
  };

  it('a sort running on an unsortable column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().setSort({ column: 'name', direction: 'asc' });
    flushSync();

    live('Sort');
    const panel = box('sheet-sort');
    expect(panel.queryByText(EMPTY.Sort)).toBeNull();
    expect((panel.getByRole('radio', { name: 'Name' }) as HTMLInputElement).checked).toBe(true);
  });

  it('a filter running on a searchable:false column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().addFilter({ column: 'name', operator: 'contains', value: 'Ada' });
    flushSync();

    live('Add filter');
    const panel = box('sheet-filter');
    expect(panel.queryByText(EMPTY['Add filter'])).toBeNull();
    // Read-only section — the way out of a filter the column no longer offers.
    expect(panel.getByRole('heading', { name: 'Name' })).toBeTruthy();
    expect(panel.getByRole('button', { name: 'Remove filter' })).toBeTruthy();
  });

  it('a grouping running on an ungroupable column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().setGroupBy('name');
    flushSync();

    live('Grouping');
    const panel = box('sheet-grouping');
    expect(panel.queryByText(EMPTY.Grouping)).toBeNull();
    expect((panel.getByRole('radio', { name: 'Name' }) as HTMLInputElement).checked).toBe(true);
  });

  it('an aggregation configured on a summable:false column keeps the tool live', () => {
    const { ctx } = renderTable();

    ctx().addSummaryConfig({ column: 'amount', type: 'sum' });
    flushSync();

    live('Summary');
    const panel = box('sheet-summary');
    expect(panel.queryByText(EMPTY.Summary)).toBeNull();
    expect(panel.getByRole('radiogroup', { name: 'Amount' })).toBeTruthy();
  });

  it('a pinned column that was hidden anyway keeps the eye live, and the way back', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    // `hideColumn` is public on the context and does not consult `hideable`, so
    // this state is reachable — and it is the one case where an axis is
    // ineligible everywhere AND has something in force. Without the fallback
    // row the tool would say "Every column is pinned" while a column sat off
    // screen with no checkbox to bring it back.
    ctx().hideColumn('name');
    flushSync();

    live('Column visibility');
    const panel = box('sheet-columns');
    expect(panel.queryByText(EMPTY['Column visibility'])).toBeNull();

    const checkbox = panel.getByRole('checkbox', { name: 'Name' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);
    flushSync();
    expect(ctx().hiddenColumnKeys.has('name')).toBe(false);
  });
});

/**
 * A tool can empty itself under the hands using it, and that is the moment the
 * refusal has to be a soft one.
 *
 * Remove the last running filter of a table nothing else can filter and the
 * funnel goes from live to empty while focus sits on the × inside its own open
 * popover. A native `disabled` would have had the browser blur the trigger, and
 * Popover's dismiss restore (`focusTrigger`) is a spec no-op on a disabled
 * button; the panel losing the button under the pointer strands focus on
 * `<body>` regardless, which inside the sheet's modal dialog restarts every
 * subsequent Tab at the top.
 */
describe('#254 — a tool that empties under the user does not strand focus', () => {
  it('removing the last running filter keeps focus in the panel and the trigger reachable', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().addFilter({ column: 'name', operator: 'contains', value: 'Ada' });
    flushSync();

    const funnel = barTrigger('Add filter');
    await user.click(funnel);
    expect(funnel.getAttribute('aria-expanded')).toBe('true');

    // The popover's own copy of the panel, not the bare one the harness mounts
    // beside it for the sheet geometry.
    const remove = screen
      .getAllByRole('button', { name: 'Remove filter', hidden: true })
      .find((el) => !el.closest('[data-testid^="sheet-"]')) as HTMLButtonElement;
    const popover = remove.closest('[popover]') as HTMLElement;

    remove.focus();
    expect(document.activeElement).toBe(remove);

    await user.click(remove);
    flushSync();

    expect(ctx().view.filters).toEqual([]);
    expect(document.activeElement).not.toBe(document.body);
    expect(popover.contains(document.activeElement)).toBe(true);

    // …and the trigger that just went empty is still a focus target, which is
    // what makes the popover's dismiss restore land somewhere.
    expect(funnel.getAttribute('aria-disabled')).toBe('true');
    funnel.focus();
    expect(document.activeElement).toBe(funnel);
  });
});

/**
 * The filter footer answers two questions, and they have different answers.
 *
 * A panel of read-only sections — every column `searchable: false`, one filter
 * still running — is not empty, so the note does not fire; but every section is
 * read-only, so Apply would commit nothing. Clear all has to survive that,
 * because it is the only way out of the filter besides its own ×.
 */
describe('#254 — the filter footer gates Apply and Clear all separately', () => {
  it('read-only sections keep Clear all and lose Apply', async () => {
    const user = userEvent.setup();
    const { ctx } = renderTable();

    ctx().addFilter({ column: 'name', operator: 'contains', value: 'Ada' });
    flushSync();

    const panel = box('sheet-filter');
    expect(panel.queryByRole('button', { name: 'Apply' })).toBeNull();

    const clear = panel.getByRole('button', { name: 'Clear all' });
    clear.focus();
    await user.click(clear);
    flushSync();

    expect(ctx().view.filters).toEqual([]);
    // Clear all removes itself along with the filters, so it drops focus the
    // same way the × does.
    expect(document.activeElement).not.toBe(document.body);
  });

  it('positive control — a filterable table keeps Apply', () => {
    renderTable([{ accessor: 'name', title: 'Name' }] as unknown as Column[]);

    expect(box('sheet-filter').getByRole('button', { name: 'Apply' })).toBeTruthy();
  });
});

/**
 * The sheet section stays where it is.
 *
 * The bar swaps its five triggers for one sheet at its own `@md` container
 * step, and jsdom resolves no container queries — so the compact branch is only
 * reachable by answering the one custom property the bar reads
 * (`--blocks-table-tools`, #133), the same stub `summary-visibility` uses.
 */
describe('#254 — the sheet keeps the section and puts the sentence inside it', () => {
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

  it('keeps the Sort section in the accordion and explains inside it', async () => {
    const user = userEvent.setup();
    forceCompactBar();

    // The bar alone, not the both-geometries harness: what is under test here
    // is what the SHEET renders, and the bare panels beside it would answer
    // for it.
    const instance = mount(TableHarness, {
      target: document.body,
      props: { items: ROWS, columns: COLUMNS, enableSmartFilter: true } as Record<string, unknown>
    });
    dispose = () => unmount(instance);
    flushSync();

    await user.click(screen.getByTestId('tools-trigger'));
    flushSync();

    // The section is still there — a sheet whose sections come and go with the
    // column definition moves the other four under the thumb.
    const sortSection = screen.getByRole('button', { name: /^Sort/, hidden: true });
    expect(sortSection).toBeTruthy();

    // …and the sentence is inside it. Sections mount on first open (see
    // ToolsSheet's `mountedSections`), so it exists only after expanding.
    await user.click(sortSection);
    flushSync();
    expect(screen.getByText(EMPTY.Sort)).toBeTruthy();
  });
});
