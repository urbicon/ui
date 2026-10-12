import { expect, type Page, test } from '@playwright/test';

/**
 * A centred Scroller brings every item to the middle, the first and the last
 * included, whatever `itemBasis` is.
 *
 * The DOM suites cannot see the defect this guards: jsdom has no layout, and
 * its `CSS.supports` accepts every value. With `itemBasis="auto"` the centring
 * padding `calc(50% - var(--blocks-scroller-item)/2)` is invalid, the browser
 * drops the declaration, and the row rests like `align="start"` — the leading
 * chips never reach the middle and their dots collapse into one. The
 * length-basis row beside it is the control: its padding is CSS alone.
 *
 * Reduced motion turns the row's smooth scrolling off, so every press lands in
 * one step and `settle` only has to wait out the scroll event.
 */

const URL = '/test-fixtures/scroller';
const ROWS = ['centre-basis', 'centre-auto'] as const;

test.use({ channel: 'chromium', locale: 'en-US', reducedMotion: 'reduce' });

/** Each item's distance from the middle of the row, and which dot is lit. */
function rowState(page: Page, row: string) {
  return page.evaluate((testid) => {
    const root = document.querySelector(`[data-testid="${testid}"] [data-align]`) as HTMLElement;
    const viewport = root.firstElementChild as HTMLElement;
    const middle =
      viewport.getBoundingClientRect().left + viewport.clientLeft + viewport.clientWidth / 2;
    const offCentre = Array.from(viewport.children, (item) => {
      const box = item.getBoundingClientRect();
      return box.left + box.width / 2 - middle;
    });
    const dots = Array.from(root.querySelectorAll('button[aria-label^="Item"]'));
    const lit = dots.findIndex((dot) => dot.getAttribute('aria-current') === 'true');
    return { offCentre, dots: dots.length, lit };
  }, row);
}

/** Resolve once the row's scroll position has held still for 300ms. */
function settle(page: Page, row: string) {
  return page.evaluate(async (testid) => {
    const viewport = document.querySelector(`[data-testid="${testid}"] [data-align]`)
      ?.firstElementChild as HTMLElement;
    let last = Number.NaN;
    let stillSince = performance.now();
    while (performance.now() - stillSince < 300) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (viewport.scrollLeft !== last) {
        last = viewport.scrollLeft;
        stillSince = performance.now();
      }
    }
  }, row);
}

for (const row of ROWS) {
  test(`${row}: every item comes to rest in the middle, first and last included`, async ({
    page
  }) => {
    // `networkidle`: the dev server optimises a route's dependencies on its
    // first visit and reloads the page when done (see tab-focus-ring.spec.ts).
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const dots = page.getByTestId(row).getByRole('button', { name: /^Items? \d+(–\d+)? of \d+$/ });
    // Dots render only once the row has measured itself as overflowing.
    await expect(dots.first()).toBeVisible();
    await settle(page, row);

    const atLoad = await rowState(page, row);
    // One resting place per item. A row that cannot centre its ends collapses
    // the items sharing an end of the scroll range into one dot.
    expect(atLoad.dots).toBe(atLoad.offCentre.length);
    expect(Math.abs(atLoad.offCentre[0] as number)).toBeLessThanOrEqual(1);
    expect(atLoad.lit).toBe(0);

    // Last first: the far end is the one the padding has to make reachable.
    for (let index = atLoad.dots - 1; index >= 0; index--) {
      await dots.nth(index).click();
      await settle(page, row);
      const now = await rowState(page, row);
      expect(Math.abs(now.offCentre[index] as number), `item ${index + 1}`).toBeLessThanOrEqual(1);
      expect(now.lit, `dot ${index + 1}`).toBe(index);
    }
  });
}
