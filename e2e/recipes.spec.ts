import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Recipe live previews in a real browser — the interactive flows the recipe
 * pages promise actually work end-to-end: login (validation, failure, success
 * with fake latency), settings (tabs, switches, save feedback), wizard
 * (step gating, summary round-trip, submit), filter-sidebar (deterministic
 * 10-listing dataset: facet narrowing, empty state, reset) and the
 * unsaved-changes guard (ConfirmDialog only when dirty, save-and-leave).
 *
 * No snapshots — assertions are structural/ARIA-based, so the suite runs on
 * Linux CI unlike the darwin-pinned visual layer. Every test gates on
 * `html[data-hydrated]` (stamped in the root layout's onMount): clicking the
 * SSR-inert markup before hydration silently no-ops — the generalized form of
 * the aria-expanded workaround popover-motion.spec uses.
 */

async function gotoRecipe(page: Page, slug: string) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.goto(`/recipes/${slug}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-hydrated]', { timeout: 30_000 });
}

// Every recipe page renders its interactive demo inside <Section id="preview">;
// scoping there keeps queries away from code panels quoting the same strings.
const preview = (page: Page) => page.locator('#preview');

// Checkbox/RadioItem/Toggle render an sr-only input behind a styled
// `label[for=id]` that intercepts pointer events — Playwright's check() on
// the input fails actionability. Click the label, like a user does.
async function toggleViaLabel(page: Page, input: Locator) {
  const id = await input.getAttribute('id');
  if (!id) throw new Error('styled control has no id to resolve its label');
  await page.locator(`label[for="${id}"]`).click();
}

test.describe('Recipe: login', () => {
  test('flags an invalid email and refuses to submit', async ({ page }) => {
    await gotoRecipe(page, 'login');
    const p = preview(page);

    await p.getByLabel('Email').fill('not-an-email');
    await expect(p.getByText('Please enter a valid email')).toBeVisible();

    // canSubmit stays false → the handler bails; no loading, no alert.
    await p.getByRole('button', { name: 'Sign in' }).click();
    await expect(p.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  test('rejects wrong credentials with a dismissible danger alert', async ({ page }) => {
    await gotoRecipe(page, 'login');
    const p = preview(page);

    await p.getByLabel('Email').fill('demo@example.com');
    await p.getByLabel('Password').fill('wrong-password');
    await p.getByRole('button', { name: 'Sign in' }).click();

    // 1.5 s fake latency sits inside the default expect timeout.
    const alert = p.getByRole('alert').filter({ hasText: 'Invalid email or password' });
    await expect(alert).toBeVisible();
  });

  test('logs in with the demo credentials through the loading state', async ({ page }) => {
    await gotoRecipe(page, 'login');
    const p = preview(page);

    await p.getByLabel('Email').fill('demo@example.com');
    await p.getByLabel('Password').fill('password123');
    const submit = p.getByRole('button', { name: 'Sign in' });
    await submit.click();

    // The fake latency window renders the busy state first…
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    // …then the success branch replaces the form.
    await expect(p.getByText('Logged in successfully! Redirecting...')).toBeVisible();
    await expect(p.getByRole('button', { name: 'Sign in' })).toBeHidden();
  });

  test('the visibility toggle flips the password input type', async ({ page }) => {
    await gotoRecipe(page, 'login');
    const p = preview(page);

    const password = p.getByLabel('Password');
    await password.fill('secret123');
    await expect(password).toHaveAttribute('type', 'password');

    // The eye toggle is the only plain (icon-only, nameless) button next to the field.
    await p.locator('div.relative > button[type="button"]').click();
    await expect(p.getByLabel('Password')).toHaveAttribute('type', 'text');
  });
});

test.describe('Recipe: settings', () => {
  test('switches tabs and flips a notification switch', async ({ page }) => {
    await gotoRecipe(page, 'settings');
    const p = preview(page);

    await expect(p.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');

    await p.getByRole('tab', { name: 'Notifications' }).click();
    await expect(p.getByRole('tab', { name: 'Notifications' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Email notifications starts on, push starts off — flip both and assert
    // the switches actually track state (not just render).
    const switches = p.getByRole('switch');
    await expect(switches.first()).toBeChecked();
    await expect(switches.nth(1)).not.toBeChecked();
    await toggleViaLabel(page, switches.nth(1));
    await expect(switches.nth(1)).toBeChecked();
  });

  test('security tab: the 2FA badge tracks its toggle', async ({ page }) => {
    await gotoRecipe(page, 'settings');
    const p = preview(page);

    await p.getByRole('tab', { name: 'Security' }).click();
    // The 2FA accordion item is expanded by default? Open it if needed, then
    // read the badge next to the toggle.
    const twoFa = p.getByRole('button', { name: 'Two-Factor Authentication' });
    if ((await twoFa.getAttribute('aria-expanded')) === 'false') await twoFa.click();

    await expect(p.getByText('Enabled', { exact: true })).toBeVisible();
    await toggleViaLabel(page, p.getByRole('switch').first());
    await expect(p.getByText('Disabled', { exact: true })).toBeVisible();
  });

  test('save shows the success alert and auto-hides it again', async ({ page }) => {
    await gotoRecipe(page, 'settings');
    const p = preview(page);

    await p.getByRole('button', { name: 'Save Changes' }).click();
    const alert = p.getByRole('alert').filter({ hasText: 'Settings saved successfully.' });
    await expect(alert).toBeVisible();
    // handleSave clears `saved` after 3 s.
    await expect(alert).toBeHidden({ timeout: 6_000 });
  });
});

test.describe('Recipe: wizard', () => {
  test('walks all three steps with gating, summary round-trip and submit', async ({ page }) => {
    await gotoRecipe(page, 'wizard');
    const p = preview(page);

    const next = p.getByRole('button', { name: 'Next' });
    const back = p.getByRole('button', { name: 'Back' });

    // Step 0: empty → gated; Back is dead at the left edge.
    await expect(next).toBeDisabled();
    await expect(back).toBeDisabled();
    await p.getByLabel('Full Name').fill('Jane Doe');
    await p.getByLabel('Email').fill('jane@example.com');
    await expect(next).toBeEnabled();
    await next.click();

    // Step 1: plan + region required.
    await expect(next).toBeDisabled();
    await toggleViaLabel(page, p.getByRole('radio', { name: 'Professional' }));
    // getByLabel would be ambiguous: trigger AND listbox carry the label id.
    await p.getByRole('combobox', { name: 'Region' }).click();
    await page.getByRole('option', { name: 'Europe', exact: true }).click();
    await expect(next).toBeEnabled();
    await next.click();

    // Step 2: the summary reflects the entered values; submit is gated on terms.
    await expect(p.getByText('Summary')).toBeVisible();
    await expect(p.getByText('Jane Doe')).toBeVisible();
    await expect(p.getByText('Professional')).toBeVisible();
    await expect(p.getByText('Europe', { exact: true })).toBeVisible();

    const submit = p.getByRole('button', { name: 'Submit' });
    await expect(submit).toBeDisabled();
    await toggleViaLabel(
      page,
      p.getByRole('checkbox', { name: 'I agree to the terms and conditions' })
    );
    await submit.click();

    await expect(p.getByText('All done!')).toBeVisible();

    // Start Over resets to a gated step 0.
    await p.getByRole('button', { name: 'Start Over' }).click();
    await expect(p.getByLabel('Full Name')).toHaveValue('');
    await expect(p.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  test('back preserves earlier input', async ({ page }) => {
    await gotoRecipe(page, 'wizard');
    const p = preview(page);

    await p.getByLabel('Full Name').fill('Jane Doe');
    await p.getByLabel('Email').fill('jane@example.com');
    await p.getByRole('button', { name: 'Next' }).click();
    await p.getByRole('button', { name: 'Back' }).click();

    await expect(p.getByLabel('Full Name')).toHaveValue('Jane Doe');
    await expect(p.getByLabel('Email')).toHaveValue('jane@example.com');
  });
});

test.describe('Recipe: filter-sidebar', () => {
  // Deterministic dataset: 10 listings — 6 apartments, 2 houses, 2 studios.
  test('facet filters narrow the deterministic listing set and reset restores it', async ({
    page
  }) => {
    await gotoRecipe(page, 'filter-sidebar');
    const p = preview(page);

    await expect(p.getByRole('heading', { name: '10 homes' })).toBeVisible();

    await toggleViaLabel(page, p.getByRole('radio', { name: 'House' }));
    await expect(p.getByRole('heading', { name: '2 homes' })).toBeVisible();
    // Both surviving cards are houses (the card badge carries the type label).
    await expect(p.getByText('House', { exact: true })).toHaveCount(3); // 2 badges + the radio label
    await expect(p.getByText('Family house with a yard')).toBeVisible();

    await p.getByRole('button', { name: /^Reset/ }).click();
    await expect(p.getByRole('heading', { name: '10 homes' })).toBeVisible();
  });

  test('search narrows across title + neighborhood, and the empty state offers reset', async ({
    page
  }) => {
    await gotoRecipe(page, 'filter-sidebar');
    const p = preview(page);

    const search = p.getByLabel('Search listings');
    await search.fill('Köpenick');
    await expect(p.getByRole('heading', { name: '1 homes' })).toBeVisible();
    await expect(p.getByText('Family house with a yard')).toBeVisible();

    await search.fill('zzz-no-match');
    await expect(p.getByText('No homes match these filters')).toBeVisible();

    await p.getByRole('button', { name: 'Reset filters' }).click();
    await expect(p.getByRole('heading', { name: '10 homes' })).toBeVisible();
  });
});

test.describe('Recipe: unsaved-changes-guard', () => {
  test('clean state leaves without the dialog; dirty state gates on it', async ({ page }) => {
    await gotoRecipe(page, 'unsaved-changes-guard');
    const p = preview(page);

    // The mock navigation is a window.alert; capture instead of hanging on it.
    const alerts: string[] = [];
    page.on('dialog', async (nativeDialog) => {
      alerts.push(nativeDialog.message());
      await nativeDialog.accept();
    });

    // Clean → straight through, no ConfirmDialog.
    await expect(p.getByText('No changes')).toBeVisible();
    await p.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect.poll(() => alerts).toEqual(['Navigated away (mock)']);
    await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toBeHidden();

    // Dirty → the guard intercepts.
    await p.getByLabel('Property name').fill('Sunset Heights II');
    await expect(p.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Leave', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Unsaved changes' });
    await expect(dialog).toBeVisible();
    expect(alerts).toHaveLength(1); // no second mock navigation yet

    // Cancel keeps the edit and stays.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(p.getByLabel('Property name')).toHaveValue('Sunset Heights II');

    // Save and leave: commits the edit, then performs the pending navigation.
    await p.getByRole('button', { name: 'Leave', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Unsaved changes' })
      .getByRole('button', { name: 'Save and leave' })
      .click();
    await expect.poll(() => alerts).toHaveLength(2);
    await expect(p.getByText('No changes')).toBeVisible(); // saved: no longer dirty
  });
});
