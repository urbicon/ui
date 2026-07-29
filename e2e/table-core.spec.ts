import { expect, type Page, test } from '@playwright/test';

/**
 * Core Table flows in a real browser: header-click sorting (asc → desc → off cycle),
 * smart-filter search narrowing the visible rows, virtualization rendering only a DOM
 * window of a 2000-row dataset that swaps on scroll, region grouping (groupOrder +
 * membership), multi-select (row + select-all + count), keyboard column reorder, and
 * remote/server-mode data (a request per interaction). The fixture dataset is fully
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

  test('grouping renders headers in groupOrder with rows under their own group', async ({
    page
  }) => {
    await setupPage(page);

    const grouped = page.getByTestId('table-grouped');
    const groupHeaders = grouped.locator('[data-testid^="grouped-row-"]');

    // Three region groups render, ordered by groupOrder (['east','north','south'])
    // rather than the insertion order — proving groupOrder drives the display.
    await expect(groupHeaders).toHaveCount(3);
    const headerOrder = await groupHeaders.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid'))
    );
    expect(headerOrder).toEqual(['grouped-row-east', 'grouped-row-north', 'grouped-row-south']);

    // Walk the tbody in DOM order: every member row must sit under the header of
    // its own region, and each group must hold its expected member count.
    const sequence = await grouped.locator('tbody tr').evaluateAll((rows) =>
      rows.map((row) => {
        const testId = row.getAttribute('data-testid') ?? '';
        const regionCell = row.querySelector('[data-testid$="-region"]');
        return {
          isHeader: testId.startsWith('grouped-row-'),
          isMember: testId.startsWith('grouped-item-'),
          group: testId.startsWith('grouped-row-') ? testId.slice('grouped-row-'.length) : '',
          region: (regionCell?.textContent ?? '').trim()
        };
      })
    );

    let currentGroup = '';
    const counts: Record<string, number> = {};
    for (const entry of sequence) {
      if (entry.isHeader) {
        currentGroup = entry.group;
        counts[currentGroup] = 0;
      } else if (entry.isMember) {
        expect(entry.region).toBe(currentGroup);
        counts[currentGroup] += 1;
      }
    }
    expect(counts).toEqual({ east: 1, north: 3, south: 2 });
  });

  test('keyboard navigation crosses group boundaries and selects the right row', async ({
    page
  }) => {
    await setupPage(page);

    const table = page.getByTestId('table-grouped-keyboard');
    const rows = table.locator('tbody tr[data-row-index]');

    // Every item row across all three groups is in one index space, numbered in
    // visual order. Before 2026-07-25 grouped rows carried no data-row-index at
    // all, so this collection was empty and the whole keyboard path was inert.
    await expect(rows).toHaveCount(6);
    const indices = await rows.evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute('data-row-index')))
    );
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);

    // groupOrder is east(1), north(3), south(2) — so index 0 is the sole east row
    // and index 1 is the first north row: arrowing down crosses a group boundary.
    const regionAt = async (i: number) =>
      (await rows.nth(i).locator('[data-testid$="-region"]').textContent())?.trim();
    expect(await regionAt(0)).toBe('east');
    expect(await regionAt(1)).toBe('north');

    await rows.first().focus();
    await expect(rows.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();

    // Space selects the focused row. It must select the row the focus is on —
    // the id lookup used to read the paginated (ungrouped) list, so under
    // grouping it would have resolved a different item.
    await page.keyboard.press(' ');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false');

    // End jumps to the last row of the last group; Home returns to the first.
    await page.keyboard.press('End');
    await expect(rows.nth(5)).toBeFocused();
    expect(await regionAt(5)).toBe('south');

    await page.keyboard.press('Home');
    await expect(rows.nth(0)).toBeFocused();
  });

  test('collapsing a group removes its rows from the keyboard sequence', async ({ page }) => {
    await setupPage(page);

    const table = page.getByTestId('table-grouped-keyboard');
    const rows = table.locator('tbody tr[data-row-index]');
    await expect(rows).toHaveCount(6);

    // Collapse the first group (east, 1 row) via its header.
    await table.getByTestId('grouped-row-east').click();

    // Its row leaves the DOM, and the remaining rows renumber from 0 so the
    // index space stays contiguous with what is actually rendered.
    await expect(rows).toHaveCount(5);
    const indices = await rows.evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute('data-row-index')))
    );
    expect(indices).toEqual([0, 1, 2, 3, 4]);

    // End must reach the last *visible* row, not index 5 of the old sequence.
    await rows.first().focus();
    await page.keyboard.press('End');
    await expect(rows.nth(4)).toBeFocused();
  });

  test('multi-select toggles rows, the count, and the select-all header', async ({ page }) => {
    await setupPage(page);

    const selection = page.getByTestId('table-selection');
    const rows = selection.locator('tr[data-row-index]');
    const count = page.getByTestId('selection-count');
    const secondRow = selection.locator('[data-testid="table-row-1"]');
    const selectAllHeader = selection.locator('[data-testid="selection-header"]');
    const selectAllInput = selectAllHeader.locator('input[type="checkbox"]');

    await expect(rows).toHaveCount(6);
    await expect(count).toHaveText('0');
    await expect(secondRow).toHaveAttribute('aria-selected', 'false');

    // Select one row: aria-selected flips, the count rises, and the select-all
    // header goes indeterminate (some-but-not-all selected).
    await secondRow.locator('label').first().click();
    await expect(secondRow).toHaveAttribute('aria-selected', 'true');
    await expect(count).toHaveText('1');
    await expect(selectAllInput).toHaveAttribute('aria-checked', 'mixed');

    // The select-all header selects every row in the set.
    await selectAllHeader.locator('label').first().click();
    await expect(count).toHaveText('6');
    await expect(selection.locator('tr[data-row-index][aria-selected="true"]')).toHaveCount(6);
    await expect(selectAllInput).not.toHaveAttribute('aria-checked', 'mixed');
    expect(await selectAllInput.isChecked()).toBe(true);

    // Toggling the header again clears the whole selection.
    await selectAllHeader.locator('label').first().click();
    await expect(count).toHaveText('0');
    await expect(selection.locator('tr[data-row-index][aria-selected="true"]')).toHaveCount(0);
  });

  test('activeRowId marks the shown row without turning on selection', async ({ page }) => {
    await setupPage(page);

    const active = page.getByTestId('table-active-row');
    const rows = active.locator('tr[data-row-index]');
    const shown = page.getByTestId('active-row-name');
    // id 0 on purpose: a truthy `activeRowId` guard would never mark this row.
    const firstRow = active.locator('[data-testid="table-row-0"]');
    const secondRow = active.locator('[data-testid="table-row-1"]');

    await expect(rows).toHaveCount(6);
    await expect(shown).toHaveText('none');
    await expect(active.locator('tr[aria-current="true"]')).toHaveCount(0);

    // The mark follows the click — and lands on the row whose id is 0.
    await firstRow.click();
    await expect(shown).toHaveText('Item 0000');
    await expect(firstRow).toHaveAttribute('aria-current', 'true');
    await expect(firstRow).toHaveAttribute('data-active', '');

    // Exactly one row is current at a time.
    await secondRow.click();
    await expect(shown).toHaveText('Item 0001');
    await expect(active.locator('tr[aria-current="true"]')).toHaveCount(1);
    await expect(secondRow).toHaveAttribute('aria-current', 'true');
    await expect(firstRow).not.toHaveAttribute('aria-current', 'true');

    // The whole point of the prop: no selection column, and no row claims to be
    // selected. Before it existed, marking a row required `selectionMode`.
    await expect(active.locator('[data-testid="selection-header"]')).toHaveCount(0);
    await expect(active.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(active.locator('tr[aria-selected]')).toHaveCount(0);
  });

  test('keyboard Shift+Arrow reorders columns and round-trips', async ({ page }) => {
    await setupPage(page);

    const reorder = page.getByTestId('table-reorder');
    const headerOrder = () =>
      reorder
        .locator('[data-testid^="column-header-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));

    expect(await headerOrder()).toEqual([
      'column-header-name',
      'column-header-category',
      'column-header-score'
    ]);

    // Shift+ArrowRight on the first header moves it one slot to the right. The
    // handler lives on the <th>; the focusable sort control bubbles the key up.
    await reorder
      .getByTestId('column-header-name')
      .locator('[role="button"]')
      .press('Shift+ArrowRight');
    await expect
      .poll(headerOrder)
      .toEqual(['column-header-category', 'column-header-name', 'column-header-score']);

    // Shift+ArrowLeft moves it back — the reorder round-trips.
    await reorder
      .getByTestId('column-header-name')
      .locator('[role="button"]')
      .press('Shift+ArrowLeft');
    await expect
      .poll(headerOrder)
      .toEqual(['column-header-name', 'column-header-category', 'column-header-score']);
  });

  test('server mode issues a request per interaction and renders the fresh result', async ({
    page
  }) => {
    await setupPage(page);

    const remote = page.getByTestId('table-remote');
    const rows = remote.locator('tr[data-row-index]');
    const requestCount = page.getByTestId('remote-request-count');
    const total = page.getByTestId('remote-total');
    const search = remote.locator('input[type="search"]');
    const firstCell = rows.first().locator('td').first();
    const readCount = async () => Number.parseInt((await requestCount.textContent()) ?? '0', 10);

    // The on-mount managed fetch renders the first page of the 40-row backend and
    // the request counter — the visible activity indicator — reaches at least 1.
    await expect.poll(readCount).toBeGreaterThanOrEqual(1);
    await expect(rows).toHaveCount(10);
    await expect(total).toHaveText('40');
    await expect(firstCell).toHaveText('Item 0000');

    // A search issues a new request (counter climbs) and the rendered rows + total
    // reflect the filtered backend result. "0007" matches exactly one name.
    const beforeSearch = await readCount();
    await search.fill('0007');
    await expect.poll(readCount).toBeGreaterThan(beforeSearch);
    await expect(rows).toHaveCount(1);
    await expect(total).toHaveText('1');
    await expect(firstCell).toHaveText('Item 0007');

    // Clearing restores the full backend.
    await search.fill('');
    await expect(total).toHaveText('40');

    // Sorting issues yet another request; descending score puts Item 0030
    // (score 100, the deterministic max over i∈[0,39]) first.
    const beforeSort = await readCount();
    const scoreSort = remote.getByTestId('column-header-score').locator('[role="button"]');
    await scoreSort.click(); // ascending
    await scoreSort.click(); // descending
    await expect.poll(readCount).toBeGreaterThan(beforeSort);
    await expect(remote.getByTestId('column-header-score')).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    await expect(firstCell).toHaveText('Item 0030');
  });
});
