import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * A keyboard user scrolls the palette's list only through the highlight: focus
 * stays in the search input. At the first and the last command the list
 * scrolls to its own edge, so the info rows above the first command and below
 * the last come into view with them, and the command itself stays in view when
 * those rows are taller than the list. jsdom lays nothing out, so which rows a
 * key brings into view is asked of a browser.
 */

const FIXTURE_URL = '/test-fixtures/command-palette';

const TOP = { leading: true, trailing: false };
const BOTTOM = { leading: false, trailing: true };

async function openPalette(page: Page, trigger: string, name: string): Promise<Locator> {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  // The route renders on the client only, so the fixture appearing means it is live.
  await page.waitForSelector('[data-testid="command-palette-fixture"]', { timeout: 30_000 });
  await page.getByTestId(trigger).click();
  const input = page.getByRole('dialog', { name, exact: true }).getByRole('combobox');
  await expect(input).toBeFocused();
  return input;
}

/** Which of the list's own rows lie wholly inside its visible box. */
function rowsInView(input: Locator) {
  return input.evaluate((el) => {
    const list = document.getElementById(el.getAttribute('aria-controls') ?? '');
    if (!list) throw new Error('aria-controls names no element');
    const box = list.getBoundingClientRect();
    const inView = (row: Element | null) => {
      if (!row) throw new Error('no such row');
      const rect = row.getBoundingClientRect();
      return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
    };
    return {
      leading: inView(list.firstElementChild),
      trailing: inView(list.lastElementChild),
      highlight: inView(document.getElementById(el.getAttribute('aria-activedescendant') ?? ''))
    };
  });
}

test('Home, End and the wraps bring the info rows at both ends of the list into view', async ({
  page
}) => {
  const input = await openPalette(page, 'palette-trigger', 'Fixture commands');
  await expect
    .poll(() => rowsInView(input), { message: 'on open' })
    .toEqual({ ...TOP, highlight: true });

  // ArrowUp from the first command wraps to the last, ArrowDown back to the first.
  for (const [key, expected] of [
    ['End', BOTTOM],
    ['Home', TOP],
    ['ArrowUp', BOTTOM],
    ['ArrowDown', TOP]
  ] as const) {
    await input.press(key);
    await expect
      .poll(() => rowsInView(input), { message: key })
      .toEqual({ ...expected, highlight: true });
  }
});

test('Home keeps the first command in view below info rows taller than the list', async ({
  page
}) => {
  const input = await openPalette(
    page,
    'tall-palette-trigger',
    'Fixture commands below a tall preamble'
  );

  await input.press('End');
  await expect.poll(async () => (await rowsInView(input)).highlight, { message: 'End' }).toBe(true);
  await input.press('Home');
  await expect
    .poll(async () => (await rowsInView(input)).highlight, { message: 'Home' })
    .toBe(true);
});
