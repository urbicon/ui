import { expect, test } from '@playwright/test';

/**
 * The actions column's width budget, measured by the engine that decides it.
 *
 * `TableColumns.actions` declares a width computed from the built-in view /
 * edit / delete trio, and under `table-layout: auto` that declaration is a
 * floor rather than a promise: when the cell's min-content exceeds it, the
 * column silently grows and everything after it shifts.
 *
 * `Table.cellinset.svelte.test.ts` already recomputes the arithmetic from a
 * mounted table, and it catches a changed `w-*` step, gap or cell inset without
 * a browser. What it structurally cannot see is the *used* width of a button:
 * the blocks `Button` carries `min-w-min`, so its real floor is its own content
 * (icon + `px-2` + 1px border each side), and when that exceeds the `w-*` class
 * the class stops being the number that matters. jsdom computes no layout, so
 * reproducing it there would mean emulating min-content — a second oracle, the
 * kind this repo has learned not to write.
 *
 * That gap was not hypothetical: `9rem` shipped 6px short at `lg`, where the
 * column had been rendering 150px against its own 144px declaration, because
 * the factory's arithmetic used the declared 32px per button and the engine was
 * laying out 34 (2026-08-25).
 *
 * What is asserted is the cell's **min-content**, not the rendered column width.
 * The requirement is what the factory's number is a claim about, and it is
 * independent of how `table-layout: auto` hands out surplus space — a column
 * measured wider than its declaration may simply have been given slack by a
 * wide table, which is not a defect and would make this a flaky gate.
 *
 * And min-content is probed, not recomputed. Summing buttons + gap + the `<td>`
 * inset reproduces the factory's own arithmetic, and therefore inherits its
 * blind spot: any box *between* the `<td>` and the buttons is missing from both.
 * That is not a hypothetical either — it is exactly what #256 removed from
 * `ActionButtons.svelte`, hand-written markup that the component's own comment
 * says "no config-level check could see". Measured on this fixture, putting
 * that `px-2` back leaves the sum at 150 while the column renders 166. So the
 * cell's content is cloned into a zero-width box and the engine is asked what
 * it cannot go below; the sum is kept only to assert the two agree, which is
 * the assertion that catches an uncounted wrapper.
 */

const FIXTURE_URL = '/test-fixtures/table';
const SIZES = ['sm', 'md', 'lg'] as const;

type Measurement = {
  declaredWidthPx: number;
  buttonWidths: number[];
  /** The `w-<step>` each button declares, to prove the measurement sees past it. */
  declaredButtonWidths: number[];
  gapPx: number;
  padLeftPx: number;
  padRightPx: number;
  /** Buttons + gaps + inset — the factory's arithmetic, reproduced. */
  requiredPx: number;
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

    const buttons = [...cell.querySelectorAll('button')];
    const row = buttons[0].parentElement;
    if (!row) throw new Error('The buttons have no row to sit in.');

    // The declared step, read off the class the arithmetic is written from.
    // Tailwind's `w-<n>` is n/4 rem; anything else leaves the entry NaN and the
    // positive control below reports it rather than passing silently. Unlike
    // the jsdom test's reader, this one takes the first match instead of
    // refusing an ambiguous pair — one `w-*` reaches the button from one `tv()`
    // slot, and a second would fail that test first.
    const declaredButtonWidths = buttons.map((b) => {
      const step = [...b.classList]
        .map((c) => /^w-(\d+(?:\.\d+)?)$/.exec(c)?.[1])
        .find((v) => v !== undefined);
      return step === undefined ? Number.NaN : (Number.parseFloat(step) / 4) * rootFontPx;
    });

    const rowStyle = getComputedStyle(row);
    const cellStyle = getComputedStyle(cell);
    const buttonWidths = buttons.map((b) => b.getBoundingClientRect().width);
    const gapPx = Number.parseFloat(rowStyle.columnGap) || 0;
    const padLeftPx = Number.parseFloat(cellStyle.paddingLeft) || 0;
    const padRightPx = Number.parseFloat(cellStyle.paddingRight) || 0;

    // The probe: the cell's content, cloned into a box that offers it no width,
    // so the engine reports the floor rather than the layout it happens to have
    // been given. Parented inside the `<td>` so the clone inherits the same
    // font and token context its original renders in.
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;visibility:hidden';
    const floor = document.createElement('div');
    floor.style.width = 'min-content';
    floor.appendChild(row.cloneNode(true));
    box.appendChild(floor);
    cell.appendChild(box);
    const contentFloorPx = floor.getBoundingClientRect().width;
    box.remove();

    return {
      declaredWidthPx,
      buttonWidths,
      declaredButtonWidths,
      gapPx,
      padLeftPx,
      padRightPx,
      requiredPx:
        buttonWidths.reduce((sum, w) => sum + w, 0) +
        gapPx * (buttons.length - 1) +
        padLeftPx +
        padRightPx,
      minContentPx: contentFloorPx + padLeftPx + padRightPx
    };
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
    test(`size=${size}: the rendered trio fits the width the factory declares`, async ({
      page
    }) => {
      const m = await measure(page, size);

      expect(m.buttonWidths).toHaveLength(3);
      expect(
        new Set(m.buttonWidths.map((w) => w.toFixed(2))).size,
        'the trio shares one width'
      ).toBe(1);

      expect(
        m.minContentPx,
        `The actions cell cannot go below ${m.minContentPx.toFixed(1)}px at size=${size}, ` +
          `but TableColumns.actions declares ${m.declaredWidthPx}px. Under ` +
          'table-layout: auto the column will grow past its declaration instead of ' +
          'reporting the disagreement — raise the factory width, and the comment ' +
          'arithmetic beside it.'
      ).toBeLessThanOrEqual(m.declaredWidthPx);

      // The factory's arithmetic counts buttons, gaps and the `<td>` inset. If
      // the engine's floor is higher, something horizontal sits between the two
      // that no one is counting — a padding or margin on a wrapper, the #256
      // defect class. The number above would still pass while the column
      // overran, so this is the assertion that sees it.
      expect(
        m.minContentPx,
        `At size=${size} the cell's floor is ${m.minContentPx.toFixed(1)}px but buttons + ` +
          `gaps + inset add up to ${m.requiredPx.toFixed(1)}px (3 × ` +
          `${m.buttonWidths[0].toFixed(1)} + 2 × ${m.gapPx} + ${m.padLeftPx} + ` +
          `${m.padRightPx}). The difference is a horizontal box between the <td> and ` +
          'the buttons that the factory comment does not know about — either drop it ' +
          '(the <td> owns the inset, #256) or count it in the budget.'
      ).toBeCloseTo(m.requiredPx, 1);
    });
  }

  /**
   * The positive control this gate needs on its own oracle.
   *
   * Everything above would also pass if the browser were merely reflecting the
   * `w-*` classes back — which is exactly what the jsdom test already does, and
   * would make this file an expensive duplicate rather than the second oracle
   * it claims to be. It is only worth its runtime if the engine reports a width
   * the class does not state, so that difference is asserted rather than
   * assumed: `min-w-min` lifts every button in this cell above its step
   * (`w-7` → 32px, `w-8` → 34px). If blocks ever makes the icon and padding fit
   * inside the step, this fails and the file's reason for existing should be
   * re-argued — it does not fail because anything is broken.
   */
  test('the measurement sees past the declared w-* class', async ({ page }) => {
    const seen: string[] = [];
    for (const size of SIZES) {
      const m = await measure(page, size);
      expect(
        m.declaredButtonWidths.every(Number.isFinite),
        `size=${size}: a button carries no w-<step> class, so the control below compares ` +
          'against NaN. Read the step the way the arithmetic does, or drop the control.'
      ).toBe(true);
      seen.push(
        `${size}: used ${m.buttonWidths[0].toFixed(1)}px vs declared ${m.declaredButtonWidths[0].toFixed(1)}px`
      );
      expect(
        m.buttonWidths[0],
        `size=${size}: the used button width equals its w-* class, so this file measures ` +
          `nothing the jsdom test cannot. Seen — ${seen.join(' · ')}`
      ).toBeGreaterThan(m.declaredButtonWidths[0]);
    }
  });
});
