import { expect, type Locator, type Page, test } from '@playwright/test';

const FIXTURE_URL = '/test-fixtures/floating';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="floating-fixtures"]', { timeout: 30_000 });
  await page.waitForTimeout(2000);
}

test.describe('Floating positioning – Visual Regression', { tag: '@pixel' }, () => {
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

  // The menu (736px) and combobox (1080px) sections both sit below the 720px
  // viewport fold, so at scrollY=0 the floating layer correctly flips ABOVE its
  // trigger — there is no room below. Screenshotting without scrolling froze
  // that flipped state into baselines named "opens below", and tied the shot to
  // the fixture's total height.
  //
  // `scrollIntoViewIfNeeded()` is NOT enough: it scrolls the minimum needed to
  // make the section visible (120px for the menu), leaving 64px under the
  // trigger for a 134px panel — so it still flips. `block: 'center'` gives both
  // sides room. Measured on this fixture: menu panel 428..562 below trigger
  // 380..420.
  //
  // Each test also asserts the geometry it is named for. The screenshot alone
  // cannot: a flipped panel is a perfectly valid-looking image, which is how
  // the old baselines passed for months. The assertion is also the only half
  // of these tests that will run in Linux CI, where no baselines exist.

  /** Waits until `floating` has settled below `anchor`. */
  async function expectOpensBelow(anchor: Locator, floating: Locator) {
    await expect
      .poll(
        async () => {
          const a = await anchor.boundingBox();
          const f = await floating.boundingBox();
          if (!a || !f) return null;
          // Allow 1px for sub-pixel rounding of the anchor's bottom edge.
          return f.y >= a.y + a.height - 1;
        },
        {
          timeout: 5_000,
          message: 'floating element never settled below its anchor'
        }
      )
      .toBe(true);
  }

  test('menu opens below trigger', async ({ page }) => {
    await setupPage(page);

    const section = page.getByTestId('menu-section');
    await section.evaluate((el) => el.scrollIntoView({ block: 'center' }));

    await expectOpensBelow(page.getByRole('button', { name: 'Actions' }), page.getByRole('menu'));
    await expect(section).toHaveScreenshot('menu-open.png');
  });

  // ─── Combobox section ──────────────────────────────────────────────────

  test('combobox opens below input', async ({ page }) => {
    await setupPage(page);

    const section = page.getByTestId('combobox-section');
    await section.evaluate((el) => el.scrollIntoView({ block: 'center' }));

    await expectOpensBelow(page.getByPlaceholder('Search fruits'), page.getByRole('listbox'));
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
