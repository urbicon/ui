// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROW_HEIGHTS } from '$lib/utils/virtualizer';
import { createTableView } from '$lib/view/view.svelte';
import type { InternalTableContext } from '../stores/TableStore.svelte';
import TableHarness from './__fixtures__/TableHarness.svelte';
import type { TableContext } from './table/index';

/**
 * Keyboard and ARIA in the virtualized branch, against a mounted table.
 *
 * Every finding these tests pin was measured against exactly this rig with a
 * positive control on the non-virtualized branch: the focus that never moved
 * (focusRow searched the header table, whose only children are colgroup and
 * thead), the keyboard index space capped at pageSize while the scroll
 * container rendered everything, and the rows living outside the one element
 * that claimed role="grid".
 *
 * jsdom computes no layout, so the viewport height is stubbed and the scroll
 * position is driven by hand — the sequence (set scrollTop → window re-derives
 * → focus) is what is being proven; how it feels is the e2e suite's job.
 */

const COUNT = 200;
const ROWS = Array.from({ length: COUNT }, (_, i) => ({
  id: i + 1,
  name: `Row ${i + 1}`,
  amount: i
}));
const ROW_H = ROW_HEIGHTS.md;
const VIEWPORT = 400;

/**
 * Stub a layout property jsdom does not compute — same lookup discipline as
 * `Table.render.svelte.test.ts`: find the prototype that actually owns the
 * property instead of assuming one.
 */
function stubLayoutProp(prop: 'clientHeight' | 'offsetHeight', value: number): () => void {
  let proto: object | null = HTMLElement.prototype;
  while (proto && !Object.getOwnPropertyDescriptor(proto, prop)) {
    proto = Object.getPrototypeOf(proto);
  }
  if (!proto) throw new Error(`jsdom defines no \`${prop}\` to stub.`);
  const owner = proto;
  const original = Object.getOwnPropertyDescriptor(owner, prop);
  if (!original) throw new Error(`jsdom defines no \`${prop}\` to stub.`);
  Object.defineProperty(owner, prop, {
    configurable: true,
    get() {
      return value;
    }
  });
  return () => Object.defineProperty(owner, prop, original);
}

interface Mounted {
  target: HTMLElement;
  comp: Record<string, unknown>;
  ctx: InternalTableContext;
}

let mounted: Mounted[] = [];
let restoreViewport: (() => void) | undefined;

function mountTable(props: Record<string, unknown>): Mounted {
  const target = document.createElement('div');
  document.body.appendChild(target);
  let ctx: InternalTableContext | undefined;
  const comp = mount(TableHarness, {
    target,
    props: {
      items: ROWS,
      onReady: (c: TableContext) => (ctx = c as InternalTableContext),
      ...props
    }
  }) as Record<string, unknown>;
  flushSync();
  if (!ctx) throw new Error('onReady never fired');
  const entry: Mounted = { target, comp, ctx };
  mounted.push(entry);
  return entry;
}

function pagedView(pageSize: number, page = 1) {
  const view = createTableView();
  view.applyExternal({ pageSize, page }, 'external');
  return view;
}

/** Dispatch a key on the branch's ARIA surface and settle the async focus hop. */
async function press(surface: Element, key: string) {
  surface.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  flushSync();
  await tick();
  flushSync();
}

/** The virtualized branch's one `<table>` — the grid, and the keydown host. */
function gridOf(target: HTMLElement): HTMLElement {
  const grid = target.querySelector<HTMLElement>(
    '[data-testid="virtual-scroll-container"] [data-testid="table-element"]'
  );
  if (!grid) throw new Error('virtualized table not rendered');
  return grid;
}

function scrollerOf(target: HTMLElement): HTMLElement {
  const el = target.querySelector<HTMLElement>('[data-testid="virtual-scroll-container"]');
  if (!el) throw new Error('virtual scroll container not rendered');
  return el;
}

beforeEach(() => {
  restoreViewport = stubLayoutProp('clientHeight', VIEWPORT);
});

afterEach(() => {
  for (const entry of mounted) {
    unmount(entry.comp);
    entry.target.remove();
  }
  mounted = [];
  restoreViewport?.();
  restoreViewport = undefined;
});

describe('virtualized keyboard navigation moves the DOM focus', () => {
  it('ArrowDown three times focuses the row the index points at', async () => {
    const t = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    const grid = gridOf(t.target);

    await press(grid, 'ArrowDown');
    await press(grid, 'ArrowDown');
    await press(grid, 'ArrowDown');

    expect(t.ctx.focusedRowIndex).toBe(3);
    expect((document.activeElement as HTMLElement)?.getAttribute('data-row-index')).toBe('3');
  });

  it('positive control: the same walk works unvirtualized', async () => {
    const t = mountTable({ view: pagedView(10), selectionMode: 'multi' });
    const table = t.target.querySelector('[data-testid="table-element"]');
    if (!table) throw new Error('table not rendered');

    await press(table, 'ArrowDown');
    await press(table, 'ArrowDown');
    await press(table, 'ArrowDown');

    expect((document.activeElement as HTMLElement)?.getAttribute('data-row-index')).toBe('3');
  });

  it('End reaches the last of ALL rows — the window moves, the row renders, the focus lands', async () => {
    const t = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    const grid = gridOf(t.target);
    const scroller = scrollerOf(t.target);

    await press(grid, 'End');

    // Before the fix both halves were dead: the index capped at pageSize-1
    // (9), and the focus never moved because focusRow searched the header
    // table. The window must have scrolled far enough to render row 199.
    expect(t.ctx.focusedRowIndex).toBe(COUNT - 1);
    expect(scroller.scrollTop).toBeGreaterThanOrEqual((COUNT - VIEWPORT / ROW_H) * ROW_H);
    const last = t.target.querySelector(`tr[data-row-index="${COUNT - 1}"]`);
    expect(last).not.toBeNull();
    expect(document.activeElement).toBe(last);
  });

  it('the keyboard index space is all sorted rows, not a page slice', () => {
    const t = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    expect(t.ctx.navigableItems.length).toBe(COUNT);
  });

  it('a scroll that unmounts the actually-focused row still hands the tab stop over', async () => {
    const t = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    const scroller = scrollerOf(t.target);

    // Row 0 holds the REAL focus. The jump scrolls it out of the window, so
    // this very scroll event unmounts it — at event time it is still the
    // activeElement, which is why a pre-flush guard skipped and left zero
    // rendered tab stops (measured: rendered tab stops: 0 at range 145..164).
    const row0 = t.target.querySelector<HTMLElement>('tr[data-row-index="0"]');
    if (!row0) throw new Error('row 0 not rendered');
    row0.focus();
    expect(document.activeElement).toBe(row0);

    scroller.scrollTop = 150 * ROW_H;
    scroller.dispatchEvent(new Event('scroll'));
    flushSync();
    await tick();
    flushSync();
    await tick();
    flushSync();

    const tabStops = t.target.querySelectorAll('tr[tabindex="0"]');
    expect(tabStops.length).toBe(1);
    const index = Number(tabStops[0]?.getAttribute('data-row-index'));
    expect(index).toBeGreaterThanOrEqual(150);
    // And the focus follows the tab stop: a focus the unmount dropped on
    // <body> is picked up by the row that now carries the stop, so the next
    // arrow key drives the grid and not the page.
    expect(document.activeElement).toBe(tabStops[0]);
  });

  it('scrolling the focused row out of the window hands the tab stop to a rendered row', async () => {
    const t = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    const scroller = scrollerOf(t.target);

    // Row 0 holds the roving tab stop; a mouse scroll to the far end unmounts
    // it. Without the handler's guard no rendered row carries tabindex="0" any
    // more and the table loses its keyboard entry point.
    scroller.scrollTop = (COUNT - VIEWPORT / ROW_H) * ROW_H;
    scroller.dispatchEvent(new Event('scroll'));
    flushSync();
    await tick();
    flushSync();
    await tick();
    flushSync();

    const tabStops = t.target.querySelectorAll('tr[tabindex="0"]');
    expect(tabStops.length).toBe(1);
    const index = Number(tabStops[0]?.getAttribute('data-row-index'));
    expect(index).toBeGreaterThanOrEqual(VIEWPORT / ROW_H);
  });

  it('PageDown/PageUp jump one band of visible rows and focus the row — and still page unvirtualized', async () => {
    const virtual = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    const grid = gridOf(virtual.target);
    // No pinned heights in jsdom (rects are 0), so the band is the whole box.
    const band = VIEWPORT / ROW_H;

    await press(grid, 'PageDown');
    expect(virtual.ctx.effectivePage).toBe(1);
    expect(virtual.ctx.focusedRowIndex).toBe(band);
    expect((document.activeElement as HTMLElement)?.getAttribute('data-row-index')).toBe(
      String(band)
    );

    await press(grid, 'PageDown');
    expect(virtual.ctx.focusedRowIndex).toBe(2 * band);
    expect((document.activeElement as HTMLElement)?.getAttribute('data-row-index')).toBe(
      String(2 * band)
    );

    await press(grid, 'PageUp');
    expect(virtual.ctx.focusedRowIndex).toBe(band);
    expect((document.activeElement as HTMLElement)?.getAttribute('data-row-index')).toBe(
      String(band)
    );

    // Clamped at both ends.
    await press(grid, 'End');
    await press(grid, 'PageDown');
    expect(virtual.ctx.focusedRowIndex).toBe(COUNT - 1);
    await press(grid, 'Home');
    await press(grid, 'PageUp');
    expect(virtual.ctx.focusedRowIndex).toBe(0);

    const standard = mountTable({ view: pagedView(10), selectionMode: 'multi' });
    const table = standard.target.querySelector('[data-testid="table-element"]');
    if (!table) throw new Error('table not rendered');
    await press(table, 'PageDown');
    expect(standard.ctx.effectivePage).toBe(2);
    await press(table, 'PageUp');
    expect(standard.ctx.effectivePage).toBe(1);
  });

  it('a tab stop that sits under the pinned foot band counts as out of view', async () => {
    // The visible band is the box minus what the pinned head and foot cover.
    // jsdom reports every rect as 0, so the head is given a height here: with
    // a 40px head over a 400px box, rows 0..8 are fully visible at rest and
    // row 9 is the first one that is not. A guard that reads the box height
    // alone counts row 9 as visible and leaves the tab stop on a row nobody
    // can see.
    const realRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const rect = realRect.call(this);
      if (this.tagName !== 'THEAD') return rect;
      return {
        x: rect.x,
        y: rect.y,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        top: 0,
        bottom: ROW_H,
        height: ROW_H
      } as DOMRect;
    };
    try {
      const t = mountTable({
        virtualized: true,
        virtualHeight: `${VIEWPORT}px`,
        selectionMode: 'multi'
      });
      const scroller = scrollerOf(t.target);
      const lastVisible = VIEWPORT / ROW_H - ROW_H / ROW_H - 1;

      // POSITIVE CONTROL: the last fully visible row keeps the stop.
      t.ctx.setFocusedRow(lastVisible);
      scroller.dispatchEvent(new Event('scroll'));
      flushSync();
      await tick();
      flushSync();
      expect(t.ctx.focusedRowIndex).toBe(lastVisible);

      // The row under the foot band hands it over to the first visible row.
      t.ctx.setFocusedRow(lastVisible + 1);
      scroller.dispatchEvent(new Event('scroll'));
      flushSync();
      await tick();
      flushSync();
      expect(t.ctx.focusedRowIndex).toBe(0);
    } finally {
      Element.prototype.getBoundingClientRect = realRect;
    }
  });
});

describe('the virtualized table is one grid', () => {
  it('interactive: the one table is the grid, contains every rendered row, and every gridcell has it as ancestor', () => {
    const t = mountTable({
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });

    const tables = t.target.querySelectorAll('table');
    expect(tables.length).toBe(1);
    const grids = t.target.querySelectorAll('[role="grid"]');
    expect(grids.length).toBe(1);
    const grid = grids[0];
    expect(grid).toBe(tables[0]);
    expect(grid.getAttribute('aria-rowcount')).toBe(String(COUNT));
    expect(grid.getAttribute('aria-label')).toBe('Test table');

    const rows = t.target.querySelectorAll('tr[data-row-index]');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(grid.contains(row)).toBe(true);
    }

    const cells = t.target.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.closest('[role="grid"]')).toBe(grid);
    }
  });

  it('non-interactive: a plain table with the true row count, and no gridcells', () => {
    const t = mountTable({ virtualized: true, virtualHeight: `${VIEWPORT}px` });

    const table = gridOf(t.target);
    // Implicit `table` role, like the standard branch — no explicit role.
    expect(table.getAttribute('role')).toBeNull();
    expect(table.getAttribute('aria-rowcount')).toBe(String(COUNT));
    expect(t.target.querySelector('[role="grid"]')).toBeNull();
    expect(t.target.querySelectorAll('[role="gridcell"]').length).toBe(0);
  });

  it('one table: colgroup, thead, tbody with spacer rows, tfoot with the summary', () => {
    const t = mountTable({
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi',
      prefs: { defaults: { summaries: [{ column: 'amount', type: 'sum' }] } }
    });
    const scroller = scrollerOf(t.target);
    const table = gridOf(t.target);

    // The scroll box holds the table and nothing beside it — no header table
    // above it, no summary table after the rows.
    expect(scroller.children.length).toBe(1);
    expect(scroller.firstElementChild).toBe(table);
    expect([...table.children].map((el) => el.tagName)).toEqual([
      'COLGROUP',
      'THEAD',
      'TBODY',
      'TFOOT'
    ]);
    expect(table.querySelectorAll('colgroup').length).toBe(1);

    // The offset is carried by two rows that nothing reading rows can see.
    const spacers = [...table.querySelectorAll<HTMLElement>('tbody tr[data-virtual-spacer]')];
    expect(spacers.map((tr) => tr.dataset.virtualSpacer)).toEqual(['top', 'bottom']);
    for (const spacer of spacers) {
      expect(spacer.getAttribute('aria-hidden')).toBe('true');
      expect(spacer.hasAttribute('data-row-index')).toBe(false);
      expect(spacer.children.length).toBe(0);
    }
    expect(table.querySelector('tbody')?.firstElementChild).toBe(spacers[0]);
    expect(table.querySelector('tbody')?.lastElementChild).toBe(spacers[1]);
    expect(spacers[0].style.height).toBe('0px');
    const rendered = table.querySelectorAll('tbody tr[data-row-index]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(spacers[1].style.height).toBe(`${(COUNT - rendered) * ROW_H}px`);

    // The summary row lives in the foot, not at the end of the spacer.
    expect(table.querySelector('tfoot [data-testid="summary-row-total"]')).not.toBeNull();
    expect(table.querySelector('tbody [data-testid="summary-row-total"]')).toBeNull();

    // Without a summary there is no foot at all.
    const bare = mountTable({ virtualized: true, virtualHeight: `${VIEWPORT}px` });
    expect(gridOf(bare.target).querySelector('tfoot')).toBeNull();
  });

  it('the pinned summary row draws its rule as a shadow — a look, so `unstyled` takes it', () => {
    const summaries = { defaults: { summaries: [{ column: 'amount', type: 'sum' as const }] } };
    const styled = mountTable({
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      prefs: summaries
    });
    const styledRow = styled.target.querySelector('tfoot [data-testid="summary-row-total"]');
    expect(styledRow?.className).toMatch(/shadow-\[0_-2px_0_0_var\(--color-summary\)\]/);
    expect(styledRow?.className.split(' ')).not.toContain('border-t-2');

    const bare = mountTable({
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      prefs: summaries,
      unstyled: true
    });
    const bareRow = bare.target.querySelector('tfoot [data-testid="summary-row-total"]');
    expect(bareRow).not.toBeNull();
    expect(bareRow?.className ?? '').not.toMatch(/shadow-/);
  });

  it('regression pin: a non-interactive standard table claims no gridcells either', () => {
    const t = mountTable({});
    expect(t.target.querySelectorAll('[role="gridcell"]').length).toBe(0);
  });
});

describe('virtualization keeps the pager in server mode', () => {
  const TOTAL = 400;
  const PAGE = 20;
  const SERVER_ROWS = Array.from({ length: TOTAL }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    amount: i
  }));

  it('a virtualized server table pages: nav present, one page rendered, honest counts', () => {
    const t = mountTable({
      view: pagedView(PAGE),
      items: undefined,
      source: { processing: 'server', items: SERVER_ROWS.slice(0, PAGE), total: TOTAL },
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });

    expect(t.target.querySelector('nav')).not.toBeNull();
    // The virtualizer renders its window OF the loaded page — the index space
    // is the page (20), the DOM holds what fits the viewport plus overscan.
    expect(t.ctx.navigableItems.length).toBe(PAGE);
    const rendered = t.target.querySelectorAll('tr[data-row-index]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(PAGE);
    expect(gridOf(t.target).getAttribute('aria-rowcount')).toBe(String(TOTAL));
  });

  it('page 2 announces rows 21..40', () => {
    const t = mountTable({
      view: pagedView(PAGE, 2),
      items: undefined,
      source: { processing: 'server', items: SERVER_ROWS.slice(PAGE, PAGE * 2), total: TOTAL },
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });

    const first = t.target.querySelector('tr[data-row-index="0"]');
    expect(first?.getAttribute('aria-rowindex')).toBe(String(PAGE + 1));
  });

  it('the next control writes the view page', () => {
    const t = mountTable({
      view: pagedView(PAGE),
      items: undefined,
      source: { processing: 'server', items: SERVER_ROWS.slice(0, PAGE), total: TOTAL },
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });

    const nav = t.target.querySelector('nav');
    if (!nav) throw new Error('pager not rendered');
    const buttons = [...nav.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const next = buttons.find((b) => /next|weiter/i.test(b.getAttribute('aria-label') ?? ''));
    if (!next) throw new Error('next control not found in the pager');
    next.click();
    flushSync();

    expect(t.ctx.view.page).toBe(2);
  });

  it('positive control: client-virtualized scopes the pager to the mobile layout', () => {
    const t = mountTable({
      view: pagedView(10),
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi'
    });
    // The desktop scroll container holds the whole list, so no desktop pager —
    // but the always-mounted cards keep paging, and the shared pager renders
    // hidden from the desktop layout by the container query.
    const nav = t.target.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav?.closest('div[class*="transition-opacity"]')?.className).toMatch(
      /@min-\[\d+rem\]:hidden/
    );
  });
});

describe('aria-colindex counts every column aria-colcount declares', () => {
  it('virtualized: a gapless 1..N over structural and data cells, header and body agreeing', () => {
    const t = mountTable({
      virtualized: true,
      virtualHeight: `${VIEWPORT}px`,
      selectionMode: 'multi',
      // `expandable` is derived from the snippet's presence.
      expandedRowContent: createRawSnippet(() => ({ render: () => '<div>detail</div>' }))
    });

    const grid = gridOf(t.target);
    const colcount = Number(grid.getAttribute('aria-colcount'));
    // selection + expand + 3 data columns (name, category, score in the
    // harness would be 2 — the default harness has name + amount).
    expect(colcount).toBe(2 + 2);

    // One data row: selection 1, expand 2, data 3..colcount — gapless.
    const row = t.target.querySelector('tr[data-row-index="0"]');
    if (!row) throw new Error('row 0 not rendered');
    const indices = [...row.querySelectorAll('[aria-colindex]')].map((c) =>
      Number(c.getAttribute('aria-colindex'))
    );
    expect(indices).toEqual([1, 2, 3, 4]);
    expect(Math.max(...indices)).toBe(colcount);

    // The header agrees where it renders a th: selection at 1, data at 3..N
    // (the expand spacer is aria-hidden — the column counts, the header
    // element does not).
    const headerIndices = [...t.target.querySelectorAll('th[aria-colindex]')].map((c) =>
      Number(c.getAttribute('aria-colindex'))
    );
    expect(headerIndices).toEqual([1, 3, 4]);
  });

  it('standard branch heals too: the selection cell is column 1, data starts at 2', () => {
    const t = mountTable({ selectionMode: 'multi' });

    const row = t.target.querySelector('tr[data-row-index="0"]');
    if (!row) throw new Error('row 0 not rendered');
    const indices = [...row.querySelectorAll('[aria-colindex]')].map((c) =>
      Number(c.getAttribute('aria-colindex'))
    );
    expect(indices).toEqual([1, 2, 3]);
  });
});
