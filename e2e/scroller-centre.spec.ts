import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * A centred Scroller brings every item to the middle, the first and the last
 * included, whatever `itemBasis` is — and it does so without touching the
 * items' own widths or the position a consumer gave the row.
 *
 * The DOM suites cannot see the defects this guards: jsdom has no layout, and
 * its `CSS.supports` accepts every value. With `itemBasis="auto"` the centring
 * padding `calc(50% - var(--blocks-scroller-item)/2)` is invalid, the browser
 * drops the declaration, and the row rests like `align="start"` — the leading
 * chips never reach the middle and their dots collapse into one. A `var()`
 * basis passes the parser whatever it resolves to, so only the computed value
 * can tell, and that value can change with the viewport alone. The
 * length-basis row is the control: its padding is CSS alone.
 *
 * Reduced motion turns the row's smooth scrolling off, so every press lands in
 * one step and `settle` only has to wait out the scroll event. It is set with
 * `page.emulateMedia`: `test.use({ reducedMotion })` leaves
 * `(prefers-reduced-motion: reduce)` unmatched in the page. The consumer cases
 * also run with motion: a consumer's scroll is then still under way after the
 * row's own effects, so end spacing that lands late leaves it off centre.
 */

const URL = '/test-fixtures/scroller';
const ROWS = [
  'centre-basis',
  'centre-auto',
  'centre-var',
  'centre-var-length',
  'centre-images',
  'centre-percent'
] as const;

test.use({ channel: 'chromium', locale: 'en-US' });

type Motion = 'reduce' | 'no-preference';

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

/** Load the fixture and wait until `row` has measured itself and come to rest. */
async function load(page: Page, row: string, reducedMotion: Motion = 'reduce') {
  await page.emulateMedia({ reducedMotion });
  // `networkidle`: the dev server optimises a route's dependencies on its
  // first visit and reloads the page when done (see tab-focus-ring.spec.ts).
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const dots = page.getByTestId(row).getByRole('button', { name: /^Items? \d+(–\d+)? of \d+$/ });
  // Dots render only once the row has measured itself as overflowing.
  await expect(dots.first()).toBeVisible();
  await settle(page, row);
  return dots;
}

/** Press every dot, last first, and expect its item in the middle with its dot lit. */
async function expectEveryItemReachable(page: Page, row: string, dots: Locator) {
  // One resting place per item. A row that cannot centre its ends collapses
  // the items sharing an end of the scroll range into one dot.
  const { dots: count, offCentre } = await rowState(page, row);
  expect(count).toBe(offCentre.length);
  // Last first: the far end is the one the spacing has to make reachable.
  for (let index = count - 1; index >= 0; index--) {
    await dots.nth(index).click();
    await settle(page, row);
    const now = await rowState(page, row);
    expect(Math.abs(now.offCentre[index] as number), `item ${index + 1}`).toBeLessThanOrEqual(1);
    expect(now.lit, `dot ${index + 1}`).toBe(index);
  }
}

for (const row of ROWS) {
  test(`${row}: every item comes to rest in the middle, first and last included`, async ({
    page
  }) => {
    const dots = await load(page, row);

    const atLoad = await rowState(page, row);
    expect(Math.abs(atLoad.offCentre[0] as number)).toBeLessThanOrEqual(1);
    expect(atLoad.lit).toBe(0);
    await expectEveryItemReachable(page, row, dots);
  });
}

// The basis is a length from 700px up and `auto` below it, so crossing that
// width changes which edge spacing the row needs without any prop changing.
test('centre-responsive: a resize across the breakpoint keeps every item reachable', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const dots = await load(page, 'centre-responsive');
  await expectEveryItemReachable(page, 'centre-responsive', dots);

  await page.setViewportSize({ width: 640, height: 900 });
  await settle(page, 'centre-responsive');
  // Wherever the resize left the row, it rests on an item.
  const resized = await rowState(page, 'centre-responsive');
  expect(Math.abs(resized.offCentre[resized.lit] as number)).toBeLessThanOrEqual(1);
  await expectEveryItemReachable(page, 'centre-responsive', dots);
});

// The edge spacing must not narrow the box the items size against: an item
// whose width resolves against the row would shrink, be measured again, and
// shrink further.
test('centre-images: every image keeps its own aspect ratio', async ({ page }) => {
  await load(page, 'centre-images');
  const images = await page
    .getByTestId('centre-images')
    .getByRole('img')
    .evaluateAll((nodes) =>
      (nodes as HTMLImageElement[]).map((img) => ({
        rendered: img.offsetWidth / img.offsetHeight,
        natural: img.naturalWidth / img.naturalHeight
      }))
    );
  expect(images).toHaveLength(6);
  for (const [index, { rendered, natural }] of images.entries()) {
    expect(rendered, `image ${index + 1}`).toBeCloseTo(natural, 2);
  }
});

test('centre-percent: a `%` width stays a share of the whole row', async ({ page }) => {
  await load(page, 'centre-percent');
  const { row, items } = await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="centre-percent"] [data-align]')
      ?.firstElementChild as HTMLElement;
    return {
      row: viewport.clientWidth,
      items: Array.from(viewport.children, (item) => (item as HTMLElement).offsetWidth)
    };
  });
  for (const [index, width] of items.entries()) {
    expect(Math.abs(width - row * 0.4), `panel ${index + 1}`).toBeLessThanOrEqual(1);
  }
});

// A consumer that moves the row owns the position. The fixture scrolls item 4
// into the middle from `onMount` — with motion, that scroll is still under way
// when the row's own effects are done — and on the button press smooth-scrolls
// to it and appends a trailing chip in the same task, which changes the last
// item's width mid-scroll. The `onMount` row's items have fixed widths: the
// scroll aims at the layout of that moment, and a webfont arriving after it
// would move content-sized items under it, which no row can correct.
for (const motion of ['reduce', 'no-preference'] as const) {
  test(`consumer-mount: a position set in onMount is kept (motion: ${motion})`, async ({
    page
  }) => {
    await load(page, 'consumer-mount', motion);
    const state = await rowState(page, 'consumer-mount');
    expect(Math.abs(state.offCentre[3] as number)).toBeLessThanOrEqual(1);
    expect(state.lit).toBe(3);
  });
}

test('consumer-append: a smooth scroll survives an item appended in the same task', async ({
  page
}) => {
  await load(page, 'consumer-append', 'no-preference');
  await page.getByRole('button', { name: 'Select the fourth, add one' }).click();
  await expect(page.getByTestId('consumer-append').getByText('Clear filters')).toBeVisible();
  await settle(page, 'consumer-append');

  const state = await rowState(page, 'consumer-append');
  expect(state.offCentre).toHaveLength(7);
  expect(Math.abs(state.offCentre[3] as number)).toBeLessThanOrEqual(1);
  expect(state.lit).toBe(3);
});
