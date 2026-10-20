import { expect, type Page, test } from '@playwright/test';

// An in-place panel (`usePortal={false}`) inside a scroll box is cut off at the
// box's edge however much room the viewport has. `flip`, `shift` and `size`
// measure against that edge (`clippingBoundary` in utils/floating.ts); before,
// they measured against the viewport alone, and the last operator select of the
// filter popover opened downward into the box's edge with three of its four
// options unreachable (#93). jsdom has no layout, so this is where the geometry
// is asserted.

const FIXTURE_URL = '/test-fixtures/floating-clip';

async function open(page: Page, name: string) {
  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.getByTestId('floating-clip-fixture').waitFor();
  const trigger = page.getByRole('combobox', { name });
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await listbox.waitFor({ state: 'visible' });
  return { trigger, listbox };
}

/** Which options a pointer can actually reach — a clipped one hits the box instead. */
async function reachableOptions(page: Page): Promise<boolean[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((option) => {
      const r = option.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && option.contains(hit);
    })
  );
}

test.describe('floating panel inside a scroll box', () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test('a trigger at the box bottom flips its list up, every option reachable', async ({
    page
  }) => {
    const { trigger, listbox } = await open(page, 'Last');

    await expect
      .poll(async () => {
        const t = await trigger.boundingBox();
        const l = await listbox.boundingBox();
        return t && l ? l.y + l.height <= t.y + 1 : null;
      })
      .toBe(true);
    expect(await reachableOptions(page)).toEqual([true, true, true, true]);
  });

  test('positive control: a trigger with room below still opens downward', async ({ page }) => {
    const { trigger, listbox } = await open(page, 'First');

    await expect
      .poll(async () => {
        const t = await trigger.boundingBox();
        const l = await listbox.boundingBox();
        return t && l ? l.y >= t.y + t.height - 1 : null;
      })
      .toBe(true);
    expect(await reachableOptions(page)).toEqual([true, true, true, true]);
  });
});
