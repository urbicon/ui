import { expect, type Page, test } from '@playwright/test';

/**
 * Structural token smoke test. The VR suite compares pixels against committed baselines
 * and tolerates token-level total failures (a baseline captured with broken tokens keeps
 * passing). This spec instead asserts that var()-consuming token families RESOLVE to
 * real computed values: box-shadow (f7a9093 — light-dark() is color-only, shadows
 * defined through it computed to 'none' everywhere), transition-duration (an unresolved
 * var() collapses to 0s), and the tier border-radius scale. DOM/computed-style only —
 * portable to Linux CI.
 */

const FIXTURE_URL = '/test-fixtures/dialog';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="token-probe"]', { timeout: 30_000 });
}

const style = (locator: ReturnType<Page['locator']>, prop: string) =>
  locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test.describe('Token smoke', () => {
  test('shadow, motion, and radius token families resolve on static consumers', async ({
    page
  }) => {
    await setupPage(page);

    const card = page.getByTestId('probe-card');
    const button = page.getByTestId('probe-button');

    // Shadow family: --blocks-shadow-md → --color-shadow-md → real shadow list.
    // A broken chain computes to 'none' (exactly the f7a9093 total failure).
    const boxShadow = await style(card, 'box-shadow');
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).not.toBe('');

    // Motion family: duration-[var(--blocks-duration-fast)] — if the token is gone the
    // computed transition-duration falls back to 0s on every entry.
    for (const target of [card, button]) {
      const durations = (await style(target, 'transition-duration'))
        .split(',')
        .map((d) => Number.parseFloat(d));
      expect(Math.max(...durations)).toBeGreaterThan(0);
    }

    // Tier radius family: Card sits on the contain tier (small but non-zero), Button on
    // the commit tier (pill). Unresolved var() → 0px.
    expect(Number.parseFloat(await style(card, 'border-radius'))).toBeGreaterThan(0);
    expect(Number.parseFloat(await style(button, 'border-radius'))).toBeGreaterThan(0);
  });

  test('overlay surface consumes a resolved shadow token in the top layer', async ({ page }) => {
    await setupPage(page);

    // The Dialog panel carries shadow-[var(--blocks-shadow-lg)] — assert the overlay
    // branch of the family too, on a live top-layer element.
    await page.getByTestId('dialog-trigger').click();
    const dialog = page.getByTestId('dialog-el');
    await expect(dialog).toBeVisible();

    const panel = dialog.locator('[role="document"]');
    const boxShadow = await style(panel, 'box-shadow');
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).not.toBe('');
    expect(Number.parseFloat(await style(panel, 'border-radius'))).toBeGreaterThan(0);
  });
});
