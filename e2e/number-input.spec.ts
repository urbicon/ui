import { expect, type Page, test } from '@playwright/test';

/**
 * Browser guard for the NumberInput stepper. Input renders right-side adornments inside
 * a `pointer-events-none` decoration container; the stepper snippet re-enables pointer
 * events locally. jsdom dispatches clicks regardless of pointer-events, so only a real
 * browser catches a regression where the buttons go dead to the mouse. Also covers the
 * ArrowUp/ArrowDown keyboard contract and min/max clamping (disabled stepper at bound).
 */

const FIXTURE_URL = '/test-fixtures/number-input';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="number-input-fixtures"]', { timeout: 30_000 });
}

test.describe('NumberInput stepper', () => {
  test('mouse clicks on the stepper buttons change the value', async ({ page }) => {
    await setupPage(page);

    const basic = page.getByTestId('ni-basic');
    const input = basic.getByRole('spinbutton');
    const up = basic.locator('button').first();
    const down = basic.locator('button').nth(1);

    await expect(input).toHaveValue('5');

    // Real pointer click — this is exactly what jsdom cannot verify.
    await up.click();
    await expect(input).toHaveValue('6');
    await expect(basic.getByTestId('ni-basic-value')).toHaveText('6');

    await down.click();
    await down.click();
    await expect(input).toHaveValue('4');
    await expect(basic.getByTestId('ni-basic-value')).toHaveText('4');
  });

  test('stepper clamps at max and disables the up button', async ({ page }) => {
    await setupPage(page);

    const basic = page.getByTestId('ni-basic');
    const input = basic.getByRole('spinbutton');
    const up = basic.locator('button').first();

    // 5 → 10 (max), one click at a time.
    for (let i = 0; i < 5; i++) {
      await up.click();
    }
    await expect(input).toHaveValue('10');
    await expect(up).toBeDisabled();

    // Keyboard cannot exceed the bound either.
    await input.click();
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveValue('10');
  });

  test('ArrowUp/ArrowDown step the focused input', async ({ page }) => {
    await setupPage(page);

    const basic = page.getByTestId('ni-basic');
    const input = basic.getByRole('spinbutton');

    await input.click();
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveValue('6');
    await expect(basic.getByTestId('ni-basic-value')).toHaveText('6');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('4');
    await expect(basic.getByTestId('ni-basic-value')).toHaveText('4');
  });

  test('decimal step with precision stays on the 0.1 grid', async ({ page }) => {
    await setupPage(page);

    const decimal = page.getByTestId('ni-decimal');
    const input = decimal.getByRole('spinbutton');
    const up = decimal.locator('button').first();

    await expect(input).toHaveValue('0.5');

    // 0.5 + 0.1 must land on 0.6, not 0.6000000000000001.
    await up.click();
    await expect(input).toHaveValue('0.6');
    await expect(decimal.getByTestId('ni-decimal-value')).toHaveText('0.6');

    await input.click();
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('0.5');
  });
});
