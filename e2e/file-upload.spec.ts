import { expect, type Page, test } from '@playwright/test';

/**
 * Focusing a FileUpload scrolls the scroller it sits in, and nothing else.
 *
 * The focusable control is a visually hidden file input — `sr-only`, so absolutely positioned
 * — and focus scrolls the input's containing-block chain into view. With the FileUpload root
 * unpositioned, that chain skips any unpositioned scroller in between: Tab left the scroller at
 * 0 and jumped the page instead, and inside a Dialog it scrolled the `overflow-hidden` panel
 * until header and body left it. The root's `relative` (kept under `unstyled`, which strips
 * the tv() classes) is what keeps the input inside its scroller. jsdom has no layout, so only
 * a browser can see where focus scrolls.
 */

const FIXTURE_URL = '/test-fixtures/file-upload';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  // A label click opens the native picker; intercepting it keeps the run headless-safe.
  page.on('filechooser', () => {});
  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="file-upload-fixtures"]', { timeout: 30_000 });
}

/** Tab from wherever focus is until the case's file input has it (Firefox stops on scrollers). */
async function tabInto(page: Page, testid: string) {
  const input = page.getByTestId(testid).locator('input[type="file"]');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    if (await input.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab from the "${testid}" anchor never reached its file input`);
}

/**
 * Wait until no scroll position on the page changes between samples. The docs app sets
 * `scroll-behavior: smooth` on <html>, so a page scroll caused by focus animates.
 */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const sample = () =>
      [window.scrollY, ...[...document.querySelectorAll('*')].map((el) => el.scrollTop)].join();
    let last = sample();
    for (let stable = 0, i = 0; stable < 2 && i < 40; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const next = sample();
      stable = next === last ? stable + 1 : 0;
      last = next;
    }
  });
}

/**
 * Where the dropzone sits after focus: how much of it the viewport and every clipping ancestor
 * leave visible, and which `overflow: hidden | clip` ancestors were scrolled — a box the user
 * cannot scroll back.
 */
function report(page: Page, testid: string) {
  return page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`)!;
    const dropzone = root.querySelector('[data-blocks-dropzone-state]')!;
    const box = dropzone.getBoundingClientRect();
    let top = 0;
    let bottom = window.innerHeight;
    const hiddenScrolled: string[] = [];
    for (let el = dropzone.parentElement; el && el !== document.body; el = el.parentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === 'visible') continue;
      const clip = el.getBoundingClientRect();
      top = Math.max(top, clip.top);
      bottom = Math.min(bottom, clip.bottom);
      if ((overflowY === 'hidden' || overflowY === 'clip') && el.scrollTop !== 0) {
        hiddenScrolled.push(`${el.tagName.toLowerCase()}.${el.className}: ${el.scrollTop}px`);
      }
    }
    return {
      visible: Math.round(Math.max(0, Math.min(box.bottom, bottom) - Math.max(box.top, top))),
      height: Math.round(box.height),
      hiddenScrolled,
      pageY: Math.round(window.scrollY)
    };
  }, testid);
}

test.describe('FileUpload focus scroll', () => {
  for (const testid of ['in-scroller', 'in-scroller-unstyled']) {
    test(`Tab into an upload inside an overflow-auto box scrolls that box (${testid})`, async ({
      page
    }) => {
      await setupPage(page);
      const scroller = page.getByTestId(`scroller-${testid}`);
      // The whole box on screen first, so the viewport cannot be what clips the dropzone.
      await scroller.evaluate((el) => {
        el.parentElement!.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
      await page.locator(`[data-anchor="${testid}"]`).focus();
      await settle(page);
      const pageYBefore = await page.evaluate(() => Math.round(window.scrollY));

      await tabInto(page, testid);
      await settle(page);

      const after = await report(page, testid);
      expect(after.height).toBeGreaterThan(0);
      expect(after.visible).toBe(after.height);
      expect(after.pageY).toBe(pageYBefore);
      expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(after.hiddenScrolled).toEqual([]);
    });
  }

  test('Tab into an upload in a long Dialog body keeps the panel in place', async ({ page }) => {
    await setupPage(page);
    await page.getByTestId('dialog-trigger').click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByTestId('in-dialog')).toBeAttached();
    const panelTop = () => dialog.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    await dialog.locator('[data-anchor="in-dialog"]').focus();
    await settle(page);
    const topBefore = await panelTop();

    await tabInto(page, 'in-dialog');
    await settle(page);

    const after = await report(page, 'in-dialog');
    expect(after.visible).toBe(after.height);
    expect(after.hiddenScrolled).toEqual([]);
    expect(await panelTop()).toBe(topBefore);
  });

  test('a label click focuses the input without moving the label', async ({ page }) => {
    await setupPage(page);
    const label = page.getByTestId('scroller-in-scroller').locator('label');
    await label.scrollIntoViewIfNeeded();
    await settle(page);
    const labelTop = () => label.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const topBefore = await labelTop();

    await label.click();
    await expect(page.getByTestId('in-scroller').locator('input[type="file"]')).toBeFocused();
    await settle(page);

    expect(await labelTop()).toBe(topBefore);
    expect((await report(page, 'in-scroller')).hiddenScrolled).toEqual([]);
  });
});
