import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { LAUNCH_ARGS } from '../playwright.config';

/**
 * The virtualized layout in a real browser: one `<table>` in one scroll box,
 * the column header pinned to its top and the summary row to its bottom, the
 * offset of the rendered window carried by two spacer rows (#14).
 *
 * Every assertion here is a measurement only a layout engine can take — the
 * reason the three-table layout survived as long as it did is that jsdom lays
 * nothing out, and `apps/docs` runs on overlay scrollbars that reserve no space.
 * The fixture forces a classic 15px scrollbar on the scroll box for exactly that
 * reason, and the first thing the gutter test does is prove the reservation
 * took effect: without that control the drift assertion passes against a page
 * that measures nothing.
 *
 * No `@pixel` tag — the one screenshot here is read back as numbers, not
 * compared against a baseline.
 */

// Playwright's headless Chromium launches with `--hide-scrollbars`, and under
// it even a styled `::-webkit-scrollbar` reserves nothing (measured: a 0px
// gutter, the positive control below red). Dropping the flag for this file is
// what makes the gutter real; the fixture's 15px rule is what makes it a
// classic one on macOS as well as on Linux. `LAUNCH_ARGS` keeps the sandbox
// flag the config adds under root, since `test.use` replaces `launchOptions`
// rather than merging them.
test.use({ launchOptions: { args: LAUNCH_ARGS, ignoreDefaultArgs: ['--hide-scrollbars'] } });

const FIXTURE = '/test-fixtures/table-virtualized';
const GUTTER = 15;
const ROW_COUNT = 2000;

type Rect = { top: number; bottom: number; left: number; right: number; height: number };

/**
 * One reading of the whole layout at a given scroll position, taken in one
 * pass so every number describes the same frame.
 */
async function readAt(page: Page, scrollTop: number | 'max') {
  return page.evaluate(
    async ([scrollTop, gutter]) => {
      const desktop = document.querySelector('[data-table-layout="desktop"]') as HTMLElement;
      const scroller = desktop.querySelector(
        '[data-testid="virtual-scroll-container"]'
      ) as HTMLElement;
      scroller.scrollTop = scrollTop === 'max' ? scroller.scrollHeight : (scrollTop as number);
      // Two frames: one for the scroll to land, one for the window to re-derive
      // from the scroll event and paint.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const rect = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
      };
      const tables = [...desktop.querySelectorAll('table')];
      const table = tables[0];
      const thead = table?.querySelector('thead') ?? null;
      const tfoot = table?.querySelector('tfoot') ?? null;
      const rows = [...desktop.querySelectorAll<HTMLElement>('tr[data-row-index]')];
      const spacers = [...desktop.querySelectorAll<HTMLElement>('tr[data-virtual-spacer]')];

      // Column edges: the header cell of each data column against the cell of
      // the same column in the first row that is fully below the header.
      const headerRight: Record<string, number> = {};
      for (const th of desktop.querySelectorAll<HTMLElement>('th[data-testid^="column-header-"]')) {
        headerRight[th.dataset.testid!.replace('column-header-', '')] =
          th.getBoundingClientRect().right;
      }
      const theadBottom = thead?.getBoundingClientRect().bottom ?? -Infinity;
      const sample = rows.find((row) => row.getBoundingClientRect().top >= theadBottom - 0.5);
      const cellRight: Record<string, number> = {};
      if (sample) {
        const itemId = sample.id;
        for (const td of sample.querySelectorAll<HTMLElement>(
          `td[data-testid^="cell-${itemId}-"]`
        )) {
          cellRight[td.dataset.testid!.replace(`cell-${itemId}-`, '')] =
            td.getBoundingClientRect().right;
        }
      }

      return {
        scrollTop: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        clientWidth: scroller.clientWidth,
        offsetWidth: scroller.offsetWidth,
        gutterReserved: scroller.offsetWidth - scroller.clientWidth === gutter,
        scroller: rect(scroller) as Rect,
        tableCount: tables.length,
        tableRole: table?.getAttribute('role') ?? null,
        ariaRowCount: table?.getAttribute('aria-rowcount') ?? null,
        colgroups: table?.querySelectorAll('colgroup').length ?? 0,
        thead: rect(thead) as Rect | null,
        tfoot: rect(tfoot) as Rect | null,
        rowCount: rows.length,
        rows: rows.map((row) => ({
          index: Number(row.dataset.rowIndex),
          ...(rect(row) as Rect)
        })),
        spacers: spacers.map((row) => ({
          where: row.dataset.virtualSpacer,
          height: row.getBoundingClientRect().height,
          hidden: row.getAttribute('aria-hidden'),
          hasRowIndex: row.hasAttribute('data-row-index')
        })),
        headerRight,
        cellRight
      };
    },
    [scrollTop, GUTTER] as const
  );
}

async function open(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(FIXTURE, { waitUntil: 'load' });
  await page.waitForSelector('html[data-hydrated]');
  // The sentinel proves the server is serving THIS fixture — a dev server on
  // the port can belong to another worktree.
  await expect(page.getByTestId('sentinel')).toHaveText('Virtualized single-table fixture');
  await page.waitForSelector('[data-testid="virtual-scroll-container"] tr[data-row-index]');
}

/**
 * The band of the scroll box that is not covered by the pinned layers — the
 * only place a row can be seen. Read from the DOM, never from constants.
 */
function band(reading: Awaited<ReturnType<typeof readAt>>) {
  return {
    top: reading.thead?.bottom ?? reading.scroller.top,
    bottom: reading.tfoot?.top ?? reading.scroller.bottom
  };
}

test.describe('Virtualized table — one table in one scroll box', () => {
  test('one table carries the grid, its header, its rows and its summary', async ({ page }) => {
    await open(page);
    const r = await readAt(page, 0);

    // The structural claim of #14: no second or third `<table>` beside the one
    // that carries the role — and therefore one column model.
    expect(r.tableCount).toBe(1);
    expect(r.tableRole).toBe('grid');
    expect(r.ariaRowCount).toBe(String(ROW_COUNT));
    expect(r.colgroups).toBe(1);
    expect(r.thead).not.toBeNull();
    expect(r.tfoot).not.toBeNull();

    // A window, not the list: 400px of box at the md row height plus overscan.
    expect(r.rowCount).toBeGreaterThan(0);
    expect(r.rowCount).toBeLessThan(60);

    // The offset is carried by two rows that are invisible to everything that
    // reads rows — no `data-row-index`, so the row-height probe, the keyboard
    // and `aria-rowindex` never meet them.
    expect(r.spacers.map((s) => s.where)).toEqual(['top', 'bottom']);
    for (const spacer of r.spacers) {
      expect(spacer.hidden).toBe('true');
      expect(spacer.hasRowIndex).toBe(false);
    }
    expect(r.spacers[0].height).toBe(0);
    expect(r.spacers[1].height).toBeGreaterThan(0);
  });

  test('a classic scrollbar gutter narrows the header and the rows together', async ({ page }) => {
    await open(page);
    const r = await readAt(page, 0);

    // POSITIVE CONTROL: the fixture's `::-webkit-scrollbar { width: 15px }`
    // has to have produced a real gutter, or every equality below is vacuous —
    // with an overlay scrollbar the header and the body are the same width in
    // any layout.
    expect(
      r.gutterReserved,
      `expected a ${GUTTER}px gutter, got ${r.offsetWidth - r.clientWidth}`
    ).toBe(true);

    // Every data column — the two explicit tracks and the two proportional
    // ones — ends on the same pixel in the header and in a row. With the header
    // in a table of its own outside the scroll box, the proportional tracks
    // absorbed the gutter in the body alone (measured before the rework: 15px
    // at the last column).
    const ids = Object.keys(r.headerRight);
    expect(ids).toEqual(['name', 'role', 'city', 'score']);
    for (const id of ids) {
      expect(
        Math.abs(r.headerRight[id] - r.cellRight[id]),
        `column "${id}": header right ${r.headerRight[id]}, cell right ${r.cellRight[id]}`
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test('the header pins to the top of the box and the summary to its bottom, with no gap to the rows', async ({
    page
  }) => {
    await open(page);

    for (const position of [0, 800, 'max'] as const) {
      const r = await readAt(page, position);
      const label = `at scrollTop ${r.scrollTop}`;

      // Sticky travel: the header's top edge IS the box's top edge and the
      // summary's bottom edge IS the box's bottom edge, wherever the list is
      // scrolled to. The old header table sat outside the box with zero travel.
      expect(Math.abs(r.thead!.top - r.scroller.top), `thead top ${label}`).toBeLessThanOrEqual(
        0.5
      );
      expect(
        Math.abs(r.tfoot!.bottom - r.scroller.bottom),
        `tfoot bottom ${label}`
      ).toBeLessThanOrEqual(0.5);

      // No gap: some rendered row starts at or above the header's bottom edge,
      // and some rendered row ends at or below the summary's top edge — the
      // window covers the whole band between the two pinned layers.
      const { top, bottom } = band(r);
      const firstTop = Math.min(...r.rows.map((row) => row.top));
      const lastBottom = Math.max(...r.rows.map((row) => row.bottom));
      expect(firstTop, `first rendered row ${label}`).toBeLessThanOrEqual(top + 1);
      expect(lastBottom, `last rendered row ${label}`).toBeGreaterThanOrEqual(bottom - 1);
    }

    // At rest the first row sits directly under the header; at the far end the
    // last row sits directly above the summary — the two positions where a
    // stride error would show as a strip.
    const rest = await readAt(page, 0);
    const row0 = rest.rows.find((row) => row.index === 0)!;
    expect(Math.abs(row0.top - band(rest).top)).toBeLessThanOrEqual(1);

    const end = await readAt(page, 'max');
    const last = end.rows.find((row) => row.index === ROW_COUNT - 1)!;
    expect(last, 'row 1999 rendered at the far end').toBeDefined();
    expect(Math.abs(last.bottom - band(end).bottom)).toBeLessThanOrEqual(1);
  });

  test('the header keeps its underline while pinned', async ({ page }) => {
    await open(page);

    // Under `border-collapse` the table paints the borders, and a collapsed
    // border does not travel with a sticky `<thead>` (measured in Chromium,
    // Firefox and WebKit: the seam shows the passing row's border, or nothing).
    // The underline is therefore a shadow on the header row, and this reads the
    // pixels of that seam at two scroll positions — through the checkbox
    // column's left inset, where nothing but background sits under the line.
    //
    // 815 rather than 800, deliberately: at 800 the seam coincides with a row
    // boundary (20 rows of 40px), and a translucent line over a row border is a
    // different colour from the same line over background.
    const seam = async (scrollTop: number) => {
      const r = await readAt(page, scrollTop);
      const x = Math.round(r.scroller.left + 4);
      const y0 = Math.round(r.thead!.top);
      const height = Math.round(r.thead!.height) + 2;
      const shot = await page.screenshot({
        clip: { x, y: y0, width: 1, height },
        scale: 'css'
      });
      const column = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const px: number[][] = [];
        for (let y = 0; y < img.height; y++) {
          const d = ctx.getImageData(0, y, 1, 1).data;
          px.push([d[0], d[1], d[2]]);
        }
        return px;
      }, shot.toString('base64'));
      return { column, lineRow: Math.round(r.thead!.height) };
    };

    const rest = await seam(0);
    const scrolled = await seam(815);

    const luminance = (p: number[]) => (p[0] + p[1] + p[2]) / 3;
    for (const { column, lineRow } of [rest, scrolled]) {
      // The line is darker than the header background right above it.
      expect(luminance(column[lineRow])).toBeLessThan(luminance(column[lineRow - 2]) - 4);
    }
    // And it is the same line: the pixel column through header and seam is
    // identical whether the list is at rest or scrolled twenty rows in.
    expect(scrolled.column).toEqual(rest.column);
  });

  test('the keyboard lands every focused row between the pinned header and the pinned summary', async ({
    page
  }) => {
    await open(page);

    const focusedRowIsInBand = async (index: number) => {
      const focused = page.locator(':focus');
      await expect(focused).toHaveAttribute('data-row-index', String(index));
      const r = await page.evaluate(() => {
        const scroller = document.querySelector(
          '[data-testid="virtual-scroll-container"]'
        ) as HTMLElement;
        const table = scroller.querySelector('table')!;
        const row = document.activeElement!.getBoundingClientRect();
        const thead = table.querySelector('thead')!.getBoundingClientRect();
        const tfoot = table.querySelector('tfoot')!.getBoundingClientRect();
        return {
          rowTop: row.top,
          rowBottom: row.bottom,
          bandTop: thead.bottom,
          bandBottom: tfoot.top
        };
      });
      expect(r.rowTop, `row ${index} top vs header bottom`).toBeGreaterThanOrEqual(r.bandTop - 0.5);
      expect(r.rowBottom, `row ${index} bottom vs summary top`).toBeLessThanOrEqual(
        r.bandBottom + 0.5
      );
    };

    await page.locator('tr[data-row-index="0"]').click();
    await expect(page.locator(':focus')).toHaveAttribute('data-row-index', '0');

    // Down through the first window — the focus moves with the index and the
    // row stays visible.
    for (let i = 1; i <= 12; i++) {
      await page.keyboard.press('ArrowDown');
      await focusedRowIsInBand(i);
    }

    // End: the window moves to the far end, the last row renders and takes the
    // focus — and it sits above the pinned summary, not under it. This is the
    // assertion the summary-as-third-table could not make: the totals were
    // 80 000px down, past the row.
    await page.keyboard.press('End');
    await focusedRowIsInBand(ROW_COUNT - 1);
    const end = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="virtual-scroll-container"]') as HTMLElement;
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    });
    expect(end).toBe(true);

    // Up from the end: a row that has to come out from under the pinned header.
    await page.keyboard.press('ArrowUp');
    await focusedRowIsInBand(ROW_COUNT - 2);

    // Home: back to row 0, under the header at rest.
    await page.keyboard.press('Home');
    await focusedRowIsInBand(0);

    // PageDown is a no-op here by design (client-virtualized tables render no
    // pager to step), pinned in the jsdom suite; the focus stays where it is.
    await page.keyboard.press('PageDown');
    await focusedRowIsInBand(0);
  });

  test('the grid passes an axe scan', async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page })
      .include('[data-table-layout="desktop"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)
    ).toEqual([]);
  });
});
