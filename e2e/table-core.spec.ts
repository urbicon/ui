import { expect, type Page, test } from '@playwright/test';

/**
 * Core Table flows in a real browser: header-click sorting (asc → desc → off cycle),
 * smart-filter search narrowing the visible rows, and virtualization rendering only a
 * DOM window of a 2000-row dataset that swaps on scroll. The fixture dataset is fully
 * deterministic — the spec regenerates the same score sequence to compute the expected
 * sorted pages instead of trusting the component under test.
 */

const FIXTURE_URL = '/test-fixtures/table';

// Mirrors the fixture's generator (apps/docs/src/routes/test-fixtures/table/+page.svelte).
// 37 and 101 are coprime and i < 101, so all 57 scores are distinct — no tie-order
// ambiguity in the expected slices.
const scoresOf = (count: number) => Array.from({ length: count }, (_, i) => (i * 37) % 101);

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="table-fixtures"]', { timeout: 30_000 });
}

test.describe('Table core flows', () => {
  test('header click cycles sort asc → desc → off', async ({ page }) => {
    await setupPage(page);

    const standard = page.getByTestId('table-standard');
    const rows = standard.locator('tr[data-row-index]');
    const scoreHeader = standard.getByTestId('column-header-score');
    const sortToggle = scoreHeader.locator('[role="button"]');
    const scoreCells = standard.locator('tr[data-row-index] td:nth-child(3)');
    const firstCell = rows.first().locator('td').first();

    // Unsorted: insertion order, page 1.
    await expect(rows).toHaveCount(10);
    await expect(scoreHeader).toHaveAttribute('aria-sort', 'none');
    await expect(firstCell).toHaveText('Item 0000');

    const sortedAsc = scoresOf(57).sort((a, b) => a - b);

    // 1st click: ascending — page 1 shows the 10 smallest scores in order.
    await sortToggle.click();
    await expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending');
    const ascTexts = await scoreCells.allTextContents();
    expect(ascTexts.map((t) => Number.parseInt(t, 10))).toEqual(sortedAsc.slice(0, 10));

    // 2nd click: descending — page 1 shows the 10 largest scores in order.
    await sortToggle.click();
    await expect(scoreHeader).toHaveAttribute('aria-sort', 'descending');
    const descTexts = await scoreCells.allTextContents();
    expect(descTexts.map((t) => Number.parseInt(t, 10))).toEqual(
      [...sortedAsc].reverse().slice(0, 10)
    );

    // 3rd click: sort off — back to insertion order.
    await sortToggle.click();
    await expect(scoreHeader).toHaveAttribute('aria-sort', 'none');
    await expect(firstCell).toHaveText('Item 0000');
  });

  test('search narrows the visible rows and clearing restores them', async ({ page }) => {
    await setupPage(page);

    const standard = page.getByTestId('table-standard');
    const rows = standard.locator('tr[data-row-index]');
    const search = standard.locator('input[type="search"]');

    await expect(rows).toHaveCount(10);

    // "0042" only occurs in one name (scores render unpadded, categories are words).
    await search.fill('0042');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').first()).toHaveText('Item 0042');

    await search.fill('');
    await expect(rows).toHaveCount(10);
  });

  test('virtualized table renders only a DOM window and swaps it on scroll', async ({ page }) => {
    await setupPage(page);

    const virtual = page.getByTestId('table-virtual');
    const vRows = virtual.locator('tr[data-row-index]');
    const scroller = virtual.getByTestId('virtual-scroll-container');

    // Only viewport + overscan rows exist in the DOM — nowhere near the 2000 items
    // (360px viewport / 56px rows + 2×5 overscan ≈ 18 rows).
    const initialCount = await vRows.count();
    expect(initialCount).toBeGreaterThan(0);
    expect(initialCount).toBeLessThan(60);
    await expect(vRows.first()).toHaveAttribute('data-row-index', '0');
    await expect(vRows.first().locator('td').first()).toHaveText('Item 0000');

    // Programmatic scroll to the middle of the virtual space.
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });

    // A different window materializes: first rendered index deep into the list.
    await expect
      .poll(async () =>
        Number.parseInt((await vRows.first().getAttribute('data-row-index')) ?? '-1', 10)
      )
      .toBeGreaterThan(500);

    const scrolledCount = await vRows.count();
    expect(scrolledCount).toBeGreaterThan(0);
    expect(scrolledCount).toBeLessThan(60);

    // The rendered rows show the matching deep items (index === row id by construction).
    const firstIndex = Number.parseInt(
      (await vRows.first().getAttribute('data-row-index')) ?? '-1',
      10
    );
    await expect(vRows.first().locator('td').first()).toHaveText(
      `Item ${String(firstIndex).padStart(4, '0')}`
    );
  });
});
