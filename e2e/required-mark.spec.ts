import { expect, test } from '@playwright/test';

/**
 * The required marker is what the browser paints, not what the class says.
 *
 * `internal/field-required-mark.svelte.test.ts` already asserts the markup: one
 * `aria-hidden` span per required field, the glyph class on it and nowhere
 * else, the label's text free of `*`. This file asks the two questions jsdom
 * cannot:
 *
 * - **Does `after:content-['*']` paint?** The glyph's whole visible existence is
 *   one stylesheet rule; a class the scanner never emitted fails silently, and
 *   the marker would simply be gone on every required field.
 * - **Does the glyph stay out of the accessible name?** Generated content joins
 *   name-from-content, so `aria-hidden` on the span is what keeps it out. The
 *   control at the bottom is the same span without it, and its name ends in `*`.
 */

const URL = '/test-fixtures/required-mark';

/** The nine fields that draw the marker, by fixture probe. */
const FIELDS = [
  'input',
  'textarea',
  'select',
  'combobox',
  'radio-group',
  'checkbox',
  'pin-input',
  'time-input',
  'form-field'
];

test.use({ channel: 'chromium' });

/** What the marker span computes: the painted glyph and the text it does not carry. */
async function painted(page: import('@playwright/test').Page, probe: string) {
  const mark = page.locator(
    `[data-probe="${probe}"] span[aria-hidden="true"][class*="after:content-"]`
  );
  await expect(mark).toHaveCount(1);
  return mark.evaluate((el) => ({
    content: getComputedStyle(el, '::after').content,
    text: el.textContent,
    labelText: el.closest('label')?.textContent?.trim() ?? el.parentElement?.textContent?.trim()
  }));
}

test.describe('required marker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByTestId('required-mark-fixtures')).toBeVisible();
  });

  for (const probe of FIELDS) {
    test(`${probe}: paints a * from CSS and keeps it out of the label text`, async ({ page }) => {
      const result = await painted(page, probe);
      expect(result.content).toBe('"*"');
      expect(result.text).toBe('');
      expect(result.labelText).toBe('Email');
    });
  }

  test('the glyph is not part of the accessible name', async ({ page }) => {
    await expect(
      page.locator('[data-probe="input"]').getByRole('textbox', { name: 'Email', exact: true })
    ).toHaveCount(1);
    await expect(page.locator('[data-probe="input"] input')).toHaveAccessibleName('Email');
  });

  test('control: the same generated content on an exposed span joins the name', async ({
    page
  }) => {
    await expect(page.locator('[data-probe="control-exposed"] input')).toHaveAccessibleName(
      'Email*'
    );
  });

  test('under unstyled the consumer content class paints the glyph', async ({ page }) => {
    const result = await painted(page, 'input-unstyled');
    expect(result.content).toBe('"*"');
    expect(result.labelText).toBe('Email');
  });

  test('a wording instead of a glyph is the same shape', async ({ page }) => {
    const result = await painted(page, 'input-wording');
    expect(result.content).toBe('"(required)"');
    expect(result.labelText).toBe('Email');
  });
});
