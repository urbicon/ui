import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Calendar interactions in a real browser (e2e/test-fixtures/calendar): month
 * navigation incl. the onMonthChange contract, day selection through the
 * bound value, roving keyboard navigation on the month grid, view switching
 * through bind:view, the hover event-popover → onEventClick path, and
 * min/max bounds disabling both nav directions. The fixture is anchored to a
 * FIXED June 2026 (never the wall clock) with `locale="en-US"`, so every
 * selector and label here is deterministic. No snapshots — Linux-CI-safe.
 */

const FIXTURE_URL = '/test-fixtures/calendar';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="calendar-fixtures"]', { timeout: 30_000 });
  await page.waitForSelector('html[data-hydrated]', { timeout: 30_000 });
}

const main = (page: Page) => page.getByTestId('cal-main');
const day = (page: Page, date: string) => main(page).locator(`[data-date="${date}"]`);
const probe = (page: Page, id: string) => page.getByTestId(id);

test.describe('Calendar interactions', () => {
  test('month navigation: next / previous update the grid and report onMonthChange', async ({
    page
  }) => {
    await setupPage(page);
    const m = main(page);

    await expect(m.getByRole('status')).toHaveText('June 2026');

    await m.getByRole('button', { name: 'Next month' }).click();
    await expect(m.getByRole('status')).toHaveText('July 2026');
    // 0-based month payload (getMonth()): July = 6.
    await expect(probe(page, 'cal-month')).toHaveText('6-2026');
    await expect(day(page, '2026-07-15')).toBeVisible();

    await m.getByRole('button', { name: 'Previous month' }).click();
    await expect(m.getByRole('status')).toHaveText('June 2026');
    await expect(probe(page, 'cal-month')).toHaveText('5-2026');
  });

  test('clicking a day selects it: aria-selected + bound value', async ({ page }) => {
    await setupPage(page);

    await expect(probe(page, 'cal-selected')).toHaveText('none');
    await day(page, '2026-06-18').click();

    await expect(day(page, '2026-06-18')).toHaveAttribute('aria-selected', 'true');
    await expect(probe(page, 'cal-selected')).toHaveText('2026-06-18');
  });

  test('keyboard: arrows rove the grid, Enter selects the focused day', async ({ page }) => {
    await setupPage(page);

    await day(page, '2026-06-15').click();
    await expect(day(page, '2026-06-15')).toHaveAttribute('aria-selected', 'true');

    // ArrowRight +1 day, ArrowDown +7 days — focus moves, selection stays put.
    await page.keyboard.press('ArrowRight');
    await expect(day(page, '2026-06-16')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2026-06-23')).toBeFocused();
    await expect(day(page, '2026-06-15')).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');
    await expect(day(page, '2026-06-23')).toHaveAttribute('aria-selected', 'true');
    await expect(probe(page, 'cal-selected')).toHaveText('2026-06-23');
  });

  test('view switcher round-trips through bind:view', async ({ page }) => {
    await setupPage(page);
    const m = main(page);

    await expect(probe(page, 'cal-view')).toHaveText('month');

    await m.getByRole('radio', { name: 'Week' }).click();
    await expect(probe(page, 'cal-view')).toHaveText('week');

    await m.getByRole('radio', { name: 'Day' }).click();
    await expect(probe(page, 'cal-view')).toHaveText('day');

    await m.getByRole('radio', { name: 'Month' }).click();
    await expect(probe(page, 'cal-view')).toHaveText('month');
    await expect(m.getByRole('status')).toHaveText('June 2026');
  });

  test('hovering an event day opens the popover; clicking an event fires onEventClick', async ({
    page
  }) => {
    await setupPage(page);

    await expect(probe(page, 'cal-event-clicked')).toHaveText('none');

    // 2026-06-24 carries two events — the popover lists both; click one.
    await day(page, '2026-06-24').hover();
    const eventButton = page.getByRole('button', { name: /Release v7/ });
    await eventButton.click();

    await expect(probe(page, 'cal-event-clicked')).toHaveText('Release v7');
  });

  test('min/max bounds disable both nav directions on a one-month window', async ({ page }) => {
    await setupPage(page);
    const bounded = page.getByTestId('cal-bounded');

    await expect(bounded.getByRole('status')).toHaveText('June 2026');
    await expect(bounded.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    await expect(bounded.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });
});

/**
 * Accessibility of every Calendar view in a real browser (#208), on the
 * fixture's `cal-a11y` section. The docs-page scan (a11y.spec.ts) sees only the
 * views its demos render, in light mode, on the Rooms skin; this covers the
 * mini calendar it never renders, every variant, and dark mode and the bare
 * library skin as well.
 */
const A11Y = '[data-testid="cal-a11y"]';
const MONTHS = '[data-testid^="cal-a11y-month-"]';

async function setupScheme(page: Page, scheme: 'light' | 'dark', skin: 'rooms' | 'library') {
  // Before navigation, so the first paint already resolves light-dark() and
  // the skin: only `emulateMedia` reaches the page's media queries.
  await page.emulateMedia({ colorScheme: scheme });
  if (skin === 'library') {
    await page.addInitScript(() => localStorage.setItem('urbicon-docs-theme', 'library'));
  }
  await setupPage(page);
  // Positive controls: a test that measured the wrong mode or skin would pass
  // for the wrong reason.
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(
    scheme === 'dark'
  );
  expect(await page.evaluate(() => document.documentElement.classList.contains('docs-rooms'))).toBe(
    skin === 'rooms'
  );
}

/**
 * axe's contrast ratio for every text node of `include`: passed, failed, or
 * left incomplete — axe files some low-contrast nodes under incomplete, and a
 * node it could not measure counts as 0, so neither reads as a pass.
 */
async function contrastRatios(page: Page, include: string): Promise<number[]> {
  const results = await new AxeBuilder({ page })
    .include(include)
    .withRules(['color-contrast'])
    .analyze();
  return [...results.passes, ...results.violations, ...results.incomplete]
    .filter((r) => r.id === 'color-contrast')
    .flatMap((r) => r.nodes)
    .map((n) => (n.any[0]?.data as { contrastRatio?: number } | undefined)?.contrastRatio ?? 0);
}

test.describe('Calendar accessibility (#208)', () => {
  test('every grid owns only rows and every row only cells', async ({ page }) => {
    await setupPage(page);

    // Three month grids, the year grid, the mini calendar's grid and the
    // custom-cell month; the week view is a group, not a grid.
    await expect(page.locator(`${A11Y} [role="grid"]`)).toHaveCount(6);
    await expect(page.locator(`${A11Y} [role="group"][aria-label="Week view"]`)).toHaveCount(1);
    // The month grids carry the clickable multi-day bars this is about.
    await expect(page.locator(`${MONTHS} button[aria-colspan]`).first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include(A11Y)
      .withRules(['aria-required-children', 'aria-required-parent', 'aria-allowed-role'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)
    ).toEqual([]);
    // The rule ran on something: an empty pass list means the scan saw no grid.
    const judged = results.passes.find((r) => r.id === 'aria-required-children')?.nodes ?? [];
    expect(judged.length).toBeGreaterThan(5);
  });

  test('mini calendar: arrows move focus between days', async ({ page }) => {
    await setupPage(page);
    const mini = (iso: string) =>
      page.getByTestId('cal-a11y-week').locator(`[data-mini-date="${iso}"]`);

    await mini('2026-06-10').focus();
    await page.keyboard.press('ArrowRight');
    await expect(mini('2026-06-11')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(mini('2026-06-18')).toBeFocused();
  });

  for (const scheme of ['light', 'dark'] as const) {
    for (const skin of ['rooms', 'library'] as const) {
      test(`${scheme} · ${skin}: outside-month days and week numbers clear AA, still subdued`, async ({
        page
      }) => {
        await setupScheme(page, scheme, skin);

        const outside = await contrastRatios(page, `${MONTHS} [data-state="outsideMonth"]`);
        const weekNumbers = await contrastRatios(page, `${MONTHS} [role="rowheader"]`);
        const inMonth = await contrastRatios(page, `${MONTHS} [data-state="default"]`);

        // Three month grids, each with spill days and week numbers.
        expect(outside.length).toBeGreaterThanOrEqual(9);
        expect(weekNumbers.length).toBeGreaterThanOrEqual(15);
        expect(Math.min(...outside)).toBeGreaterThanOrEqual(4.5);
        expect(Math.min(...weekNumbers)).toBeGreaterThanOrEqual(4.5);
        // Subdued: every outside day reads lighter than every ordinary day.
        expect(Math.max(...outside)).toBeLessThan(Math.min(...inMonth));

        // The mini calendar's June grid and the days it spills into.
        const mini = '[data-testid="cal-a11y-week"]';
        const miniOutside = await contrastRatios(
          page,
          `${mini} [data-mini-date^="2026-05"], ${mini} [data-mini-date^="2026-07"]`
        );
        const miniInMonth = await contrastRatios(page, `${mini} [data-mini-date^="2026-06"]`);
        expect(miniOutside.length).toBeGreaterThanOrEqual(5);
        expect(Math.min(...miniOutside)).toBeGreaterThanOrEqual(4.5);
        expect(Math.max(...miniOutside)).toBeLessThan(Math.min(...miniInMonth));
      });

      test(`${scheme} · ${skin}: event labels clear AA on their fills`, async ({ page }) => {
        await setupScheme(page, scheme, skin);

        // Month bars on a consumer colour (#8b5cf6) and on the library's own
        // fill in every variant, and the week view's all-day items.
        const labels = await contrastRatios(
          page,
          `${MONTHS} [aria-colspan], [data-testid="cal-a11y-week"] button[title]`
        );
        expect(labels.length).toBeGreaterThanOrEqual(8);
        expect(Math.min(...labels)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
