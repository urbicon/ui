import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Standing guard for Dialog/Drawer top-layer promotion. The showModal call is deferred
 * behind a tick() so it runs after `bind:this` assigns the <dialog> ref — a silent
 * regression there (bc10fbc) leaves the overlay rendered but never modal: no `:modal`
 * match, no initial focus, no backdrop. jsdom has no top layer, so only a real browser
 * can verify the promotion. Assertions are DOM/behavioral only (CI-portable, no
 * screenshots): `:modal`, initial focus inside the panel, ESC close, focus restore to
 * the trigger, plus a nested Dialog→ConfirmDialog stack closing one layer at a time.
 */

const FIXTURE_URL = '/test-fixtures/dialog';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="dialog-fixtures"]', { timeout: 30_000 });
}

const isModal = (dialog: Locator) => dialog.evaluate((el) => el.matches(':modal'));
const containsFocus = (dialog: Locator) =>
  dialog.evaluate((el) => el.contains(document.activeElement));

test.describe('Dialog modal promotion', () => {
  test('open promotes to top layer, focuses the panel, ESC closes, focus restores', async ({
    page
  }) => {
    await setupPage(page);

    const trigger = page.getByTestId('dialog-trigger');
    await trigger.click();

    const dialog = page.getByTestId('dialog-el');
    await expect(dialog).toBeVisible();

    // Top-layer promotion happens a tick after render (deferred showModal) — poll it.
    await expect.poll(() => isModal(dialog)).toBe(true);

    // Initial focus moved into the panel (focusFirstElement after showModal).
    expect(await containsFocus(dialog)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Focus restored onto the element focused before opening — the trigger.
    await expect(trigger).toBeFocused();
  });

  test('nested ConfirmDialog stacks a second modal and ESC unwinds one layer at a time', async ({
    page
  }) => {
    await setupPage(page);

    await page.getByTestId('dialog-trigger').click();
    const dialog = page.getByTestId('dialog-el');
    await expect.poll(() => isModal(dialog)).toBe(true);

    const nestedTrigger = page.getByTestId('nested-trigger');
    await nestedTrigger.click();

    const confirm = page.locator('dialog').filter({ hasText: 'Delete item?' });
    await expect(confirm).toBeVisible();
    await expect.poll(() => isModal(confirm)).toBe(true);

    // Both layers modal at once; focus sits in the top-most (confirm) panel.
    expect(await isModal(dialog)).toBe(true);
    expect(await containsFocus(confirm)).toBe(true);

    // First ESC closes only the top layer; the outer dialog stays modal and focus
    // returns to the nested trigger inside it.
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(dialog).toBeVisible();
    expect(await isModal(dialog)).toBe(true);
    await expect(nestedTrigger).toBeFocused();

    // Second ESC closes the outer dialog and restores focus to the page trigger.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('dialog-trigger')).toBeFocused();
  });

  test('confirm action resolves the nested dialog without tearing down the outer one', async ({
    page
  }) => {
    await setupPage(page);

    await page.getByTestId('dialog-trigger').click();
    const dialog = page.getByTestId('dialog-el');
    await expect.poll(() => isModal(dialog)).toBe(true);

    await page.getByTestId('nested-trigger').click();
    const confirm = page.locator('dialog').filter({ hasText: 'Delete item?' });
    await expect(confirm).toBeVisible();

    // Footer order is cancel, confirm — click by position, not i18n label.
    await confirm.locator('footer button').nth(1).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByTestId('confirm-count')).toHaveText('1');

    // The outer dialog survives the nested close and is still modal.
    await expect(dialog).toBeVisible();
    expect(await isModal(dialog)).toBe(true);
  });
});

test.describe('Drawer modal promotion', () => {
  test('open promotes to top layer, focuses the panel, ESC closes, focus restores', async ({
    page
  }) => {
    await setupPage(page);

    const trigger = page.getByTestId('drawer-trigger');
    await trigger.click();

    const drawer = page.getByTestId('drawer-el');
    await expect(drawer).toBeVisible();

    await expect.poll(() => isModal(drawer)).toBe(true);
    expect(await containsFocus(drawer)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
