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
