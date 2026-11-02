// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TableContext } from '#lib/core/table/index.js';
import { TableColumns } from '#lib/factories/TableColumns.js';
import type { Column } from '#lib/types/tableTypes.js';
import { createTableView } from '#lib/view/view.svelte.js';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * Only the row activates the row. Enter or Space on any other focusable
 * element of the grid, and a click on any control inside a row, belong to that
 * element: the row action — Enter fires `onRowClick` or expands, Space
 * selects, a click does all three it is configured for — does not run as
 * well. And a key pressed on a row acts on that row, not on the one
 * `focusedRowIndex` still names.
 *
 * Every grid here is interactive (selection, `onRowClick`), or the keydown
 * handler returns before it reads a key and the test measures nothing. The
 * `control:` cases put the same gesture on the row itself, which must still
 * drive the grid; the group band's control is in `GroupedRow.toggle`.
 */

type Row = {
  id: number;
  name: string;
  joined: string;
  amount: number;
  status: string;
  note: string;
  url: string;
  plain: string;
  extra: string;
  widget: string;
  stop: string;
};

const ROWS: Row[] = [1, 2, 3].map((id) => ({
  id,
  name: `Person ${id}`,
  joined: `2026-03-1${id}`,
  amount: id * 100,
  status: 'active',
  note: `note ${id}`,
  url: `#row-${id}`,
  plain: `plain ${id}`,
  extra: `extra ${id}`,
  widget: `widget ${id}`,
  stop: `stop ${id}`
}));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function mountTable(props: Record<string, unknown>) {
  let ctx: TableContext | undefined;
  const onRowClick = vi.fn();
  // The harness types its rows as its own default shape; these rows are wider.
  const all: Record<string, unknown> = {
    items: ROWS,
    selectionMode: 'multi',
    onRowClick,
    onReady: (ready: TableContext) => (ctx = ready),
    ...props
  };
  const instance = mount(TableHarness, { target: document.body, props: all });
  dispose = () => unmount(instance);
  flushSync();
  const context = () => {
    if (!ctx) throw new Error('onReady never fired');
    return ctx;
  };
  const selectedIds = () => context().selectedItems.map((item) => item.id);
  const expandedRows = () =>
    document.querySelectorAll('tbody tr[data-row-index][aria-expanded="true"]').length;
  return { onRowClick, context, selectedIds, expandedRows };
}

function press(el: HTMLElement, key: string): KeyboardEvent {
  el.focus();
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  flushSync();
  return event;
}

function desktopRow(index: number): HTMLElement {
  const row = document.querySelector<HTMLElement>(`tbody tr[data-row-index="${index}"]`);
  if (!row) throw new Error(`no row ${index}`);
  return row;
}

/** A consumer cell that is focusable without being a control the grid knows. */
const tabStopCell = createRawSnippet((item: () => Row) => ({
  render: () => `<span tabindex="0" data-testid="tab-stop-${item().id}">stop</span>`
}));

/** A consumer cell holding a plain button — no `stopPropagation` of its own. */
const buttonCell = (spy: () => void) =>
  createRawSnippet((item: () => Row) => ({
    render: () => `<button type="button" data-testid="own-button-${item().id}">act</button>`,
    setup: (node: Element) => {
      node.addEventListener('click', spy);
    }
  }));

/** A consumer cell whose control is an ARIA widget, not a native element. */
const widgetCell = (spy: () => void) =>
  createRawSnippet((item: () => Row) => ({
    render: () => `<span role="button" tabindex="0" data-testid="widget-${item().id}">act</span>`,
    setup: (node: Element) => {
      node.addEventListener('click', spy);
    }
  }));

const expandedRowContent = createRawSnippet(() => ({ render: () => '<div>detail</div>' }));

describe('Enter and Space belong to the row only when the row has the focus', () => {
  function renderKeyGrid(extra: Record<string, unknown> = {}) {
    const columns: Column<Row>[] = [
      { accessor: 'plain', title: 'Plain', sortable: false },
      { accessor: 'note', title: 'Note', cell: tabStopCell }
    ];
    return mountTable({ columns, enableColumnReorder: true, ...extra });
  }

  /** The title of a column that reorders but does not sort — a tab stop with no Enter of its own. */
  function reorderOnlyTitle(): HTMLElement {
    const th = document.querySelector('[data-testid="column-header-plain"]');
    const title = th?.querySelector<HTMLElement>('[tabindex="0"]');
    if (!title) throw new Error('reorder-only header has no tab stop');
    expect(title.getAttribute('role'), 'not a button: it cannot sort').toBeNull();
    return title;
  }

  const tabStop = (id: number) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="tab-stop-${id}"]`);
    if (!el) throw new Error(`no tab stop in row ${id}`);
    return el;
  };

  const FOCUSABLES = [
    { name: 'a reorder-only column title in the head', element: reorderOnlyTitle },
    { name: "a consumer's tabindex element in a cell of row 3", element: () => tabStop(3) }
  ];

  it.each(FOCUSABLES)('$name: no row action on Enter or Space', ({ element }) => {
    const { onRowClick, selectedIds } = renderKeyGrid();

    press(element(), 'Enter');
    press(element(), ' ');

    expect(onRowClick, 'onRowClick').not.toHaveBeenCalled();
    expect(selectedIds(), 'selection').toEqual([]);
  });

  it.each(FOCUSABLES)('$name: no expansion on Enter, on expandable rows', ({ element }) => {
    const { onRowClick, expandedRows } = renderKeyGrid({ expandedRowContent });

    press(element(), 'Enter');

    expect(expandedRows(), 'expanded rows').toBe(0);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("a consumer's tabindex element in a group band: Enter and Space leave the rows alone", () => {
    const bandStop = createRawSnippet((name: () => string) => ({
      render: () => `<span tabindex="0" data-testid="band-stop-${name()}">stop</span>`
    }));
    const { onRowClick, selectedIds } = mountTable({
      columns: [{ accessor: 'plain', title: 'Plain' }],
      items: ROWS.map((row) => ({ ...row, dept: 'A' })),
      view: createTableView({ defaults: { groupBy: 'dept' } }),
      groupHeaderContent: bandStop
    });
    const stop = document.querySelector<HTMLElement>('[data-testid="band-stop-A"]');
    if (!stop) throw new Error('band content not rendered');

    press(stop, 'Enter');
    press(stop, ' ');

    expect(onRowClick).not.toHaveBeenCalled();
    expect(selectedIds()).toEqual([]);
  });

  it('a key on a row acts on that row, not on the one the roving index names', () => {
    // A pointer focuses a row without moving the roving index (a click on a
    // row whose click does not select), and so does `focus()`.
    const { onRowClick, selectedIds } = renderKeyGrid();
    const third = desktopRow(2);
    expect(third.getAttribute('tabindex'), 'row 3 is not the roving stop').toBe('-1');

    press(third, 'Enter');
    press(third, ' ');

    expect(onRowClick.mock.calls).toEqual([[ROWS[2]]]);
    expect(selectedIds()).toEqual([3]);
  });

  it.each([
    { name: 'Enter', key: 'Enter' },
    { name: 'Space', key: ' ' }
  ])(
    '$name on a row takes the roving index along: ArrowDown steps on from that row',
    async ({ key }) => {
      const user = userEvent.setup();
      renderKeyGrid();
      // A click that does not select focuses row 2 and leaves the index on row 1.
      const plain = document.querySelector<HTMLElement>('tbody [data-testid="cell-2-plain"]');
      if (!plain) throw new Error('no plain cell in row 2');
      await user.click(plain);
      expect(document.activeElement, 'the click focuses the row').toBe(desktopRow(1));
      expect(desktopRow(1).getAttribute('tabindex'), 'and leaves the index behind').toBe('-1');

      press(desktopRow(1), key);
      expect(desktopRow(1).getAttribute('tabindex'), 'the tab stop follows the key').toBe('0');

      press(desktopRow(1), 'ArrowDown');
      expect(document.activeElement).toBe(desktopRow(2));
    }
  );

  it('arrow keys and Home/End still navigate out of a focusable cell element', () => {
    renderKeyGrid();
    // Row 1's element, where the roving index already is: which row an arrow
    // steps from is not what this asserts.
    press(tabStop(1), 'ArrowDown');
    expect(document.activeElement, 'ArrowDown').toBe(desktopRow(1));

    press(tabStop(1), 'End');
    expect(document.activeElement, 'End').toBe(desktopRow(2));

    press(tabStop(1), 'Home');
    expect(document.activeElement, 'Home').toBe(desktopRow(0));
  });

  it('control: Enter and Space on the roving row still drive the grid', () => {
    const { onRowClick, selectedIds } = renderKeyGrid();
    const first = desktopRow(0);
    expect(first.getAttribute('tabindex')).toBe('0');

    press(first, ' ');
    press(first, 'Enter');

    expect(selectedIds()).toEqual([1]);
    expect(onRowClick.mock.calls).toEqual([[ROWS[0]]]);
  });
});

describe('a click on a control inside a row is that control’s alone', () => {
  const spies = {
    avatar: vi.fn(),
    date: vi.fn(),
    number: vi.fn(),
    status: vi.fn(),
    custom: vi.fn(),
    link: vi.fn(),
    button: vi.fn(),
    widget: vi.fn()
  };

  afterEach(() => {
    for (const spy of Object.values(spies)) spy.mockReset();
  });

  /** Every column the population covers, keyed by the column id the cell tests address. */
  const COLUMNS: Record<string, () => Column<Row>> = {
    name: () =>
      TableColumns.userAvatar<Row>('name', 'User', { clickable: true, onClick: spies.avatar }),
    joined: () => TableColumns.date<Row>('joined', 'Joined', { onClick: spies.date }),
    amount: () => TableColumns.number<Row>('amount', 'Amount', { onClick: spies.number }),
    status: () =>
      TableColumns.status<Row>('status', 'Status', { onClick: spies.status, interactive: true }),
    note: () => TableColumns.custom<Row>('note', 'Note', { onClick: spies.custom }),
    url: () => TableColumns.link<Row>('url', 'Link', { onClick: spies.link }),
    plain: () => ({ accessor: 'plain', title: 'Plain', cell: buttonCell(spies.button) }),
    widget: () => ({ accessor: 'widget', title: 'Widget', cell: widgetCell(spies.widget) }),
    // Focusable and nothing else, like a tooltip trigger: not a control.
    stop: () => ({ accessor: 'stop', title: 'Stop', cell: tabStopCell })
  };

  const CONTROLS = [
    { name: 'UserAvatar', column: 'name', spy: 'avatar', selector: '[role="button"]' },
    { name: 'DateCell', column: 'joined', spy: 'date', selector: '[role="button"]' },
    { name: 'NumberCell', column: 'amount', spy: 'number', selector: '[role="button"]' },
    { name: 'StatusBadge', column: 'status', spy: 'status', selector: '[role="button"]' },
    { name: 'CustomCell', column: 'note', spy: 'custom', selector: '[role="button"]' },
    { name: 'LinkCell', column: 'url', spy: 'link', selector: 'a[href]' },
    { name: "a consumer's button", column: 'plain', spy: 'button', selector: 'button' },
    {
      name: "a consumer's role=button",
      column: 'widget',
      spy: 'widget',
      selector: '[role="button"]'
    }
  ] as const;

  function controlIn(scope: Element, selector: string): HTMLElement {
    const el = scope.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`no ${selector} in ${scope.outerHTML.slice(0, 80)}`);
    return el;
  }

  describe('desktop rows', () => {
    function renderClickGrid() {
      // `rowClickSelects` and `expandedRowContent` on top of `onRowClick`, so a
      // leaked click shows on all three channels a row click drives.
      return mountTable({
        columns: Object.values(COLUMNS).map((make) => make()),
        rowClickSelects: true,
        expandedRowContent
      });
    }

    /** TableCell's `<td>`, by its `cell-<rowId>-<columnId>` test id. */
    function cellOf(id: number, column: string): HTMLElement {
      const cell = document.querySelector<HTMLElement>(
        `tbody [data-testid="cell-${id}-${column}"]`
      );
      if (!cell) throw new Error(`no cell ${column} in row ${id}`);
      return cell;
    }

    it.each(CONTROLS)(
      '$name: one click on the control, no row action',
      async ({ column, spy, selector }) => {
        const user = userEvent.setup();
        const { onRowClick, selectedIds, expandedRows } = renderClickGrid();

        await user.click(controlIn(cellOf(3, column), selector));
        flushSync();

        expect(spies[spy]).toHaveBeenCalledTimes(1);
        expect(onRowClick, 'onRowClick').not.toHaveBeenCalled();
        expect(selectedIds(), 'selection').toEqual([]);
        expect(expandedRows(), 'expansion').toBe(0);
      }
    );

    it('a click on an element that is only focusable is the row’s: every row action runs once', async () => {
      const user = userEvent.setup();
      const { onRowClick, selectedIds, expandedRows } = renderClickGrid();

      await user.click(controlIn(cellOf(3, 'stop'), '[tabindex="0"]'));
      flushSync();

      expect(onRowClick.mock.calls).toEqual([[ROWS[2]]]);
      expect(selectedIds()).toEqual([3]);
      expect(expandedRows()).toBe(1);
    });

    it('control: a click on the same cell outside its control runs every row action once', async () => {
      const user = userEvent.setup();
      const { onRowClick, selectedIds, expandedRows } = renderClickGrid();

      // The `<td>` itself, around the avatar: no control sits under the pointer.
      await user.click(cellOf(3, 'name'));
      flushSync();

      expect(spies.avatar).not.toHaveBeenCalled();
      expect(onRowClick.mock.calls).toEqual([[ROWS[2]]]);
      expect(selectedIds()).toEqual([3]);
      expect(expandedRows()).toBe(1);
    });
  });

  describe('group band', () => {
    it("a click on a consumer's button in the band does not toggle the group", async () => {
      const user = userEvent.setup();
      const bandButton = createRawSnippet(() => ({
        render: () => '<button type="button" data-testid="band-button">act</button>',
        setup: (node: Element) => {
          node.addEventListener('click', spies.button);
        }
      }));
      mountTable({
        columns: [{ accessor: 'plain', title: 'Plain' }],
        items: ROWS.map((row) => ({ ...row, dept: 'A' })),
        view: createTableView({ defaults: { groupBy: 'dept' } }),
        groupHeaderContent: bandButton
      });
      const members = () => document.querySelectorAll('[data-testid^="grouped-item-"]').length;
      expect(members()).toBe(3);

      const button = document.querySelector<HTMLElement>('[data-testid="band-button"]');
      if (!button) throw new Error('band content not rendered');
      await user.click(button);
      flushSync();

      expect(spies.button).toHaveBeenCalledTimes(1);
      expect(members(), 'the group stays open').toBe(3);
    });
  });

  describe('mobile card headline', () => {
    function renderCards(title: () => Column<Row>) {
      // The first card column is the title and renders inside the headline
      // button, which a row click turns into the "open" action.
      return mountTable({
        columns: [title(), { accessor: 'extra', title: 'Extra' }],
        selectionMode: 'none'
      });
    }

    function headline(id: number): HTMLElement {
      const el = document.querySelector<HTMLElement>(
        `[data-testid="mobile-table"] [data-testid="mobile-card-headline-${id}"]`
      );
      if (!el) throw new Error(`no headline for card ${id}`);
      return el;
    }

    it.each(CONTROLS)(
      '$name as the title: one click on the control, no row click',
      async ({ column, spy, selector }) => {
        const user = userEvent.setup();
        const { onRowClick } = renderCards(COLUMNS[column]);

        await user.click(controlIn(headline(3), selector));
        flushSync();

        expect(spies[spy]).toHaveBeenCalledTimes(1);
        expect(onRowClick).not.toHaveBeenCalled();
      }
    );

    it('an element that is only focusable in the title leaves the click to the headline', async () => {
      const user = userEvent.setup();
      const { onRowClick } = renderCards(COLUMNS.stop);

      await user.click(controlIn(headline(3), '[tabindex="0"]'));
      flushSync();

      expect(onRowClick.mock.calls).toEqual([[ROWS[2]]]);
    });

    it('control: a click on the headline outside the control opens the record', async () => {
      const user = userEvent.setup();
      const { onRowClick } = renderCards(COLUMNS.name);

      await user.click(headline(3));
      flushSync();

      expect(onRowClick.mock.calls).toEqual([[ROWS[2]]]);
      expect(spies.avatar).not.toHaveBeenCalled();
    });
  });
});
