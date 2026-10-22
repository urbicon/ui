import { expect, type Locator, type Page, test } from '@playwright/test';

// An in-place panel (`usePortal={false}`) inside a scroll box is cut off at the
// box's edge however much room the viewport has, so `flip`, `shift` and `size`
// measure against that edge (`clippingBoundary` in utils/floating.ts). The
// other cases are the ones the boundary must NOT narrow: a top-layer listbox in
// a transformed scroll box, and fixed listboxes inside a modal dialog that sits
// in a transformed, clipping box or holds a size container. jsdom has no
// layout, so this is where the geometry is asserted.

const FIXTURE_URL = '/test-fixtures/floating-clip';

async function gotoFixture(page: Page) {
  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.getByTestId('floating-clip-fixture').waitFor();
}

async function open(page: Page, name: string) {
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

/** Below the trigger and aligned with it — where the list opens with room to spare. */
async function expectBelowAndAligned(trigger: Locator, listbox: Locator) {
  await expect
    .poll(async () => {
      const t = await trigger.boundingBox();
      const l = await listbox.boundingBox();
      if (!t || !l) return null;
      return { below: l.y >= t.y + t.height - 1, aligned: Math.abs(l.x - t.x) <= 1 };
    })
    .toEqual({ below: true, aligned: true });
}

test.describe('floating panel inside a clipping box', () => {
  test.use({ viewport: { width: 1200, height: 900 } });

  test('a trigger at the box bottom flips its list up, every option reachable', async ({
    page
  }) => {
    await gotoFixture(page);
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
    await gotoFixture(page);
    const { trigger, listbox } = await open(page, 'First');

    await expectBelowAndAligned(trigger, listbox);
    expect(await reachableOptions(page)).toEqual([true, true, true, true]);
  });

  test('a top-layer listbox is not narrowed by the transformed box it was declared in', async ({
    page
  }) => {
    await gotoFixture(page);
    const { trigger, listbox } = await open(page, 'Portalled');

    await expectBelowAndAligned(trigger, listbox);
    expect(await reachableOptions(page)).toEqual([true, true, true, true]);
  });

  test('a dialog escapes the transformed box around it, and its listbox stays on its trigger', async ({
    page
  }) => {
    await gotoFixture(page);
    await page.getByRole('button', { name: 'Open dialog' }).click();
    await page.getByRole('dialog', { name: 'Clip fixture dialog' }).waitFor();
    const { trigger, listbox } = await open(page, 'In dialog');

    await expectBelowAndAligned(trigger, listbox);
  });

  test('a size container does not hold a fixed listbox inside its clipping box', async ({
    page
  }) => {
    await gotoFixture(page);
    await page.getByRole('button', { name: 'Open dialog' }).click();
    await page.getByRole('dialog', { name: 'Clip fixture dialog' }).waitFor();
    const { trigger, listbox } = await open(page, 'In container');

    await expectBelowAndAligned(trigger, listbox);
    expect(await reachableOptions(page)).toEqual([true, true, true, true]);
  });
});
