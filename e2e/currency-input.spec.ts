import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Browser guard for the CurrencyInput mask. The field re-formats on every
 * keystroke, so the caret has to be carried across a text that changes under it
 * — and where the caret lands is not something jsdom can answer: it has no key
 * handling, so a unit test has to hand-write the edit it believes a browser
 * performs. Only here do the edit and the caret come from the same place.
 *
 * The two defects this locks down, both reported from a phone:
 * deleting twice from the end walked the caret in front of the decimal
 * separator (and nothing could put it back behind), and deleting the separator
 * itself moved every cent digit into the integer part — a silent ×100 that left
 * a plausible-looking amount on screen.
 */

const FIXTURE_URL = '/test-fixtures/currency-input';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="currency-input-fixtures"]', { timeout: 30_000 });
}

/** The field as the user sees it — text and caret in one string. */
function field(input: Locator) {
  return input.evaluate(
    (el: HTMLInputElement) =>
      `${el.value.slice(0, el.selectionStart ?? 0)}|${el.value.slice(el.selectionStart ?? 0)}`
  );
}

test.describe('CurrencyInput mask', () => {
  test('deleting from the end walks through the fraction, not past the separator', async ({
    page
  }) => {
    await setupPage(page);
    const input = page.getByTestId('ci-de').getByRole('textbox');

    await input.click();
    await page.keyboard.press('End');
    await expect(input).toHaveValue('1.234,56');

    // A fraction slot is overwritten, never shifted: the separator stays put.
    await page.keyboard.press('Backspace');
    await expect.poll(() => field(input)).toBe('1.234,5|0');

    // This is the keystroke that used to leave the caret in front of the comma.
    await page.keyboard.press('Backspace');
    await expect.poll(() => field(input)).toBe('1.234,|00');
    await expect(page.getByTestId('ci-de-value')).toHaveText('123400');

    // Only now does it hop the separator — and the amount does not move with it.
    await page.keyboard.press('Backspace');
    await expect.poll(() => field(input)).toBe('1.234|,00');
    await expect(page.getByTestId('ci-de-value')).toHaveText('123400');

    // Behind the separator the integer part shifts, as an integer part should.
    await page.keyboard.press('Backspace');
    await expect.poll(() => field(input)).toBe('123|,00');
    await expect(page.getByTestId('ci-de-value')).toHaveText('12300');
  });

  test('the caret can sit directly behind the separator and type there', async ({ page }) => {
    await setupPage(page);
    const input = page.getByTestId('ci-de').getByRole('textbox');

    await input.click();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => field(input)).toBe('1.234,|56');

    // Typing there overwrites the slot the caret sits on and moves on by one.
    await page.keyboard.type('7');
    await expect.poll(() => field(input)).toBe('1.234,7|6');
    await expect(page.getByTestId('ci-de-value')).toHaveText('123476');
  });

  test('deleting the decimal separator leaves the amount alone', async ({ page }) => {
    await setupPage(page);
    const input = page.getByTestId('ci-de').getByRole('textbox');

    await input.click();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Backspace');

    await expect(input).toHaveValue('1.234,56');
    await expect(page.getByTestId('ci-de-value')).toHaveText('123456');
  });

  test('typing keeps every digit and the caret while the grouping shifts', async ({ page }) => {
    await setupPage(page);
    const input = page.getByTestId('ci-de').getByRole('textbox');

    await input.click();
    await page.keyboard.press('Home');
    // Typed at speed, and each digit lands in front of one just like it — the
    // case where a caret carried as a character offset drifts a group at a time.
    await page.keyboard.type('2222', { delay: 0 });

    await expect.poll(() => field(input)).toBe('22.22|1.234,56');
    await expect(page.getByTestId('ci-de-value')).toHaveText('2222123456');
  });

  test('a zero-decimal currency has no fraction to walk into', async ({ page }) => {
    await setupPage(page);
    const input = page.getByTestId('ci-jpy').getByRole('textbox');

    await input.click();
    await page.keyboard.press('End');
    await expect(input).toHaveValue('15,000');

    await page.keyboard.press('Backspace');
    await expect.poll(() => field(input)).toBe('1,500|');
    await expect(page.getByTestId('ci-jpy-value')).toHaveText('1500');
  });
});

test.describe('CurrencyInput writes that are not keystrokes', () => {
  test('the clear button empties the amount, not just the text', async ({ page }) => {
    // The field's text can also be written by something that raises no `input`
    // event at all. Reading it back has to wait for the keystroke path to have
    // its chance — and a browser runs microtasks *between* listeners, which is
    // why that wait is a task and why only this suite can prove it: jsdom
    // dispatches its listeners in one uninterrupted turn.
    await setupPage(page);
    const scope = page.getByTestId('ci-clearable');
    const input = scope.getByRole('textbox');

    await expect(input).toHaveValue('42,00');

    await scope.getByRole('button').click();

    await expect(input).toHaveValue('');
    await expect(page.getByTestId('ci-clearable-value')).toHaveText('null');
    await expect(page.locator('input[type="hidden"][name="donation"]')).toHaveValue('');
  });

  test('typing still wins over the read-back it schedules', async ({ page }) => {
    await setupPage(page);
    const input = page.getByTestId('ci-clearable').getByRole('textbox');

    await input.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');

    // The keystroke reading — the one with a caret in it — is what stands.
    await expect.poll(() => field(input)).toBe('42,|00');
    await expect(page.getByTestId('ci-clearable-value')).toHaveText('4200');
  });
});
