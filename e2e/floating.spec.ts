import { expect, type Page, test } from '@playwright/test';

const FIXTURE_URL = '/test-fixtures/floating';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="floating-fixtures"]', { timeout: 30_000 });
  await page.waitForTimeout(2000);
}

test.describe('Floating positioning – Visual Regression', () => {
  // ─── Popover section: all cardinal placements at once ──────────────────

  test('popovers open at all cardinal placements', async ({ page }) => {
    await setupPage(page);

    for (const placement of ['top', 'bottom', 'left', 'right']) {
      const content = page.getByTestId(`popover-content-${placement}`);
      await content.waitFor({ state: 'visible', timeout: 10_000 });
    }

    const section = page.getByTestId('popover-section');
    await expect(section).toHaveScreenshot('popover-all-placements.png');
  });

  // ─── Menu section ──────────────────────────────────────────────────

  test('menu opens below trigger', async ({ page }) => {
    await setupPage(page);

    const section = page.getByTestId('menu-section');
    await expect(section).toHaveScreenshot('menu-open.png');
  });

  // ─── Combobox section ──────────────────────────────────────────────────

  test('combobox opens below input', async ({ page }) => {
    await setupPage(page);

    const section = page.getByTestId('combobox-section');
    await expect(section).toHaveScreenshot('combobox-open.png');
  });

  // ─── Tooltip: hover each placement, screenshot section ─────────────────

  for (const placement of ['top', 'bottom', 'left', 'right'] as const) {
    test(`tooltip appears at ${placement} on hover`, async ({ page }) => {
      await setupPage(page);

      const trigger = page.getByTestId(`tooltip-trigger-${placement}`);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.hover();
      await page.waitForTimeout(500);

      // All four tooltips sit in the DOM permanently as manual popovers since
      // the exit-transition rework (99adb41) — scope by accessible name, a bare
      // [role="tooltip"] locator is a strict-mode violation.
      const tooltip = page.getByRole('tooltip', { name: `Tooltip ${placement}` });
      await tooltip.waitFor({ state: 'visible', timeout: 5_000 });
      await page.waitForTimeout(300);

      const section = page.getByTestId('tooltip-section');
      await expect(section).toHaveScreenshot(`tooltip-hover-${placement}.png`);
    });
  }

  // ─── Full page baseline ────────────────────────────────────────────────

  test('full fixture page layout', async ({ page }) => {
    await setupPage(page);

    await expect(page).toHaveScreenshot('floating-fixture-full.png', {
      fullPage: true
    });
  });
});
