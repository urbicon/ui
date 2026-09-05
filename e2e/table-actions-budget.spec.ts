import { expect, test } from '@playwright/test';

/**
 * The actions column's width budget, measured by the engine that decides it.
 *
 * `TableColumns.actions` declares a width computed from the built-in view /
 * edit / delete trio, and under `table-layout: auto` that declaration is a
 * floor rather than a promise: when the cell's min-content exceeds it, the
 * column silently grows and everything after it shifts.
 *
 * `Table.cellinset.svelte.test.ts` recomputes that arithmetic from the classes
 * of a mounted table — a changed `w-*` step, gap, padding or inset fails there
 * without a browser. What it structurally cannot see is a box *between* the
 * `<td>` and the buttons that no class names: a wrapper's padding or margin
 * (the shape #256 removed from `ActionButtons.svelte`) widens the cell's
 * min-content while every class reads the same. So the cell's content is
 * cloned into a box that offers it no width, the engine is asked what it
 * cannot go below, and that number is held against the declaration.
 *
 * Min-content, not the rendered column width: a column measured wider than its
 * declaration may simply have been handed slack by a wide table, which is not
 * a defect and would make this a flaky gate.
 */

const FIXTURE_URL = '/test-fixtures/table';
const SIZES = ['sm', 'md', 'lg'] as const;

type Measurement = {
  declaredWidthPx: number;
  /** What the engine says the cell cannot go below. The contract. */
  minContentPx: number;
};

async function measure(
  page: import('@playwright/test').Page,
  size: (typeof SIZES)[number]
): Promise<Measurement> {
  return page.evaluate((s) => {
    const root = document.querySelector(`[data-testid="table-actions-${s}"]`);
    if (!root) throw new Error(`No fixture section for size=${s}`);

    const declared = root.getAttribute('data-declared-width');
    if (!declared) throw new Error(`Fixture section for size=${s} carries no data-declared-width`);
    const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const declaredWidthPx = declared.endsWith('rem')
      ? Number.parseFloat(declared) * rootFontPx
      : Number.parseFloat(declared);
    if (!Number.isFinite(declaredWidthPx)) {
      throw new Error(`Cannot read "${declared}" as a rem or px length`);
    }

    const cell = [...root.querySelectorAll('td')].find(
      (c) => c.querySelectorAll('button').length >= 3
    );
    if (!cell) throw new Error(`No actions cell with the built-in trio at size=${s}`);

    const cellStyle = getComputedStyle(cell);
    const padLeftPx = Number.parseFloat(cellStyle.paddingLeft) || 0;
    const padRightPx = Number.parseFloat(cellStyle.paddingRight) || 0;

    // The probe: the `<td>`'s WHOLE content — every wrapper between the cell and
    // the buttons included, which is the box this spec exists to count — cloned
    // into a box that offers it no width, so the engine reports the floor
    // rather than the layout it happens to have been given. Parented inside
    // the `<td>` so the clone inherits the same font and token context its
    // original renders in, and so a selector written against the fixture's
    // ancestry still reaches it.
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;visibility:hidden';
    const floor = document.createElement('div');
    floor.style.width = 'min-content';
    for (const child of [...cell.childNodes]) floor.appendChild(child.cloneNode(true));
    box.appendChild(floor);
    cell.appendChild(box);
    const contentFloorPx = floor.getBoundingClientRect().width;
    box.remove();

    return { declaredWidthPx, minContentPx: contentFloorPx + padLeftPx + padRightPx };
  }, size);
}

test.describe('Actions column width budget', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
    await page.goto(FIXTURE_URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="table-fixtures"]', { timeout: 30_000 });
  });

  for (const size of SIZES) {
    test(`size=${size}: the cell's min-content fits the width the factory declares`, async ({
      page
    }) => {
      const m = await measure(page, size);

      expect(
        m.minContentPx,
        `The actions cell cannot go below ${m.minContentPx.toFixed(1)}px at size=${size}, ` +
          `but TableColumns.actions declares ${m.declaredWidthPx}px. Under ` +
          'table-layout: auto the column will grow past its declaration instead of ' +
          'reporting the disagreement — either a box between the <td> and the buttons ' +
          'is uncounted (the <td> owns the inset, #256) or the factory width and the ' +
          'comment arithmetic beside it need raising.'
      ).toBeLessThanOrEqual(m.declaredWidthPx);
    });
  }
});
