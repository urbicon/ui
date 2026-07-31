import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Behaviour + a11y + visual coverage for the Guide system, against the dedicated fixture
 * at /test-fixtures/guide. This is the component-mount coverage deferred from Guide phases
 * 4/5/6 (the `blocks` package runs vitest in `node`, with no DOM harness) plus the Phase-8
 * lazy-target hardening, an axe scan, and light/dark visual snapshots of the three richest
 * surfaces (panel / hint / tour).
 */

const URL = '/test-fixtures/guide';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function setup(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="guide-fixtures"]');
}

// ─── Bidirectional link ───────────────────────────────────────────────────────

test.describe('Guide — bidirectional link (Marker ↔ Mention)', () => {
  test('a marker opens the non-modal panel at its article', async ({ page }) => {
    await setup(page);
    const panel = page.locator('aside[data-placement]');
    await expect(panel).toHaveAttribute('data-state', 'closed');

    await page.locator('[data-guide-marker]').click();

    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toContainText('Saving your work'); // the article header + body
    // Non-modal: the underlying page stays interactive (no backdrop intercepts clicks).
    await expect(page.getByTestId('start-tour')).toBeEnabled();
  });

  test('marker is keyboard-operable and returns focus to it on close', async ({ page }) => {
    await setup(page);
    const marker = page.locator('[data-guide-marker]');
    await marker.focus();
    await page.keyboard.press('Enter');

    const panel = page.locator('aside[data-placement]');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(marker).toHaveAttribute('aria-expanded', 'true');

    // Close from within the panel → focus must return to the opening marker (Phase-8 fix).
    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect(marker).toBeFocused();
  });

  test('a mention highlights its target on hover and on focus (keyboard parity)', async ({
    page
  }) => {
    await setup(page);
    await page.locator('[data-guide-marker]').click(); // reveal the article (mention lives in it)

    const target = page.locator('[data-guide="fx-save"]');
    const mention = page.locator('[data-guide-mention]');

    await mention.hover();
    await expect(target).toHaveAttribute('data-guide-highlight', '');
    await page.locator('h1').hover(); // move away
    await expect(target).not.toHaveAttribute('data-guide-highlight');

    await mention.focus();
    await expect(target).toHaveAttribute('data-guide-highlight', '');
    await mention.blur();
    await expect(target).not.toHaveAttribute('data-guide-highlight');
  });
});

// ─── Panel navigation: focus management + filter reset ──────────────────────

test.describe('Guide — panel navigation', () => {
  // An article switch unmounts the focused control (list item / back button / GuideRef in the
  // body), which would strand focus on <body>. The panel redirects it to the heading — verified
  // across all three navigation paths. Navigation starts from the marker (opens into "saving")
  // and reaches the list via the back button, so the fixture needs no extra visible trigger.
  test('focus moves to the heading when opening an article from the list', async ({ page }) => {
    await setup(page);
    await page.locator('[data-guide-marker]').click(); // into "saving"
    const panel = page.locator('aside[data-placement]');
    const heading = panel.getByRole('heading', { level: 2 });
    await panel.getByRole('button', { name: 'All topics' }).click(); // back to the list
    await expect(heading).toHaveText('Help');

    await panel.getByRole('button', { name: 'Saving your work' }).click(); // list → article
    await expect(heading).toHaveText('Saving your work');
    await expect(heading).toBeFocused();
  });

  test('focus moves to the heading when returning to the list via the back button', async ({
    page
  }) => {
    await setup(page);
    await page.locator('[data-guide-marker]').click(); // opens straight into "saving"
    const panel = page.locator('aside[data-placement]');
    const heading = panel.getByRole('heading', { level: 2 });
    await expect(heading).toHaveText('Saving your work');

    await panel.getByRole('button', { name: 'All topics' }).click(); // back button
    await expect(heading).toHaveText('Help');
    await expect(heading).toBeFocused();
  });

  test('focus moves to the heading when following a GuideRef to another article', async ({
    page
  }) => {
    await setup(page);
    await page.locator('[data-guide-marker]').click(); // into "saving"
    const panel = page.locator('aside[data-placement]');
    const heading = panel.getByRole('heading', { level: 2 });
    await panel.getByRole('button', { name: 'All topics' }).click(); // back to the list

    await panel.getByRole('button', { name: 'Exporting data' }).click(); // list → exporting
    await expect(heading).toHaveText('Exporting data');

    await panel.getByRole('button', { name: 'Saving your work' }).click(); // GuideRef → saving
    await expect(heading).toHaveText('Saving your work');
    await expect(heading).toBeFocused();
  });

  test('the search filter resets on a full close + reopen', async ({ page }) => {
    await setup(page);
    await page.locator('[data-guide-marker]').click(); // into "saving"
    const panel = page.locator('aside[data-placement]');
    await panel.getByRole('button', { name: 'All topics' }).click(); // back to the list
    const search = panel.getByRole('searchbox');

    await search.fill('Export');
    await expect(panel.getByRole('button', { name: 'Saving your work' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Close' }).click(); // full close
    await expect(panel).toHaveAttribute('data-state', 'closed');

    await page.locator('[data-guide-marker]').click(); // reopen into "saving"
    await panel.getByRole('button', { name: 'All topics' }).click(); // back to the list
    await expect(search).toHaveValue(''); // fresh start — full index
    await expect(panel.getByRole('button', { name: 'Saving your work' })).toBeVisible();
  });

  test('the search filter survives a back-to-list within the open panel', async ({ page }) => {
    await setup(page);
    await page.locator('[data-guide-marker]').click(); // into "saving"
    const panel = page.locator('aside[data-placement]');
    await panel.getByRole('button', { name: 'All topics' }).click(); // back to the list
    const search = panel.getByRole('searchbox');

    await search.fill('Export');
    await panel.getByRole('button', { name: 'Exporting data' }).click(); // into the article
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Exporting data');

    await panel.getByRole('button', { name: 'All topics' }).click(); // back to list
    await expect(search).toHaveValue('Export'); // in-session narrowing kept (#26)
  });
});

// ─── Guided tour ────────────────────────────────────────────────────────────

test.describe('Guide — guided tour', () => {
  test('shows the scrim + bubble, advances steps, and ends on Escape', async ({ page }) => {
    await setup(page);
    await page.getByTestId('start-tour').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Welcome');
    await expect(dialog).toContainText('Step 1 of 3');
    await expect(page.locator('.guide-tour > svg')).toBeVisible(); // spotlight scrim (direct child)

    // Step 2: anchored + non-interactive → the engine paints the ring on the target.
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog).toContainText('Step 2 of 3');
    await expect(page.locator('[data-guide="fx-save"]')).toHaveAttribute(
      'data-guide-highlight',
      ''
    );

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The exit fade holds the bubble briefly; once the transition ends it unmounts (Phase-8).
    await expect(dialog).toHaveCount(0, { timeout: 2000 });
  });

  test('non-interactive step blocks the hole; interactive step leaves it click-through', async ({
    page
  }) => {
    await setup(page);
    await page.getByTestId('start-tour').click();
    const dialog = page.locator('[role="dialog"]');
    const blocker = page.locator('.guide-tour svg rect'); // transparent pointer blocker

    await dialog.getByRole('button', { name: 'Next' }).click(); // step 2 — non-interactive
    await expect(dialog).toContainText('Step 2 of 3');
    await expect(blocker).toHaveCount(1);

    await dialog.getByRole('button', { name: 'Next' }).click(); // step 3 — interactive
    await expect(dialog).toContainText('Step 3 of 3');
    await expect(blocker).toHaveCount(0); // hole is click-through
  });

  test('an advance:"action" step gates Next — only the real action advances', async ({ page }) => {
    await setup(page);
    await page.getByTestId('start-gated-tour').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Do it yourself');

    // Next is rendered, focusable, and announced as disabled with the SR hint.
    const next = dialog.getByRole('button', { name: 'Next' });
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toHaveAccessibleDescription('Complete the highlighted action to continue');

    // Neither click nor ArrowRight advance a gated step. force:true bypasses Playwright's
    // actionability check (which already refuses aria-disabled targets) so the click really
    // lands and the no-op handler is what's being proven.
    await next.click({ force: true });
    await expect(dialog).toContainText('Step 1 of 2');
    await page.keyboard.press('ArrowRight');
    await expect(dialog).toContainText('Step 1 of 2');
    // …but Back/Skip semantics stay intact (Skip is still rendered and enabled).
    await expect(dialog.getByRole('button', { name: 'Skip tour' })).toBeEnabled();

    // The real action (interactive spotlit target → app calls controller.next()) advances.
    await page.getByTestId('target-filter').click();
    await expect(dialog).toContainText('Done');
    await expect(dialog).toContainText('Step 2 of 2');

    // The gate is per-step: the final step's button works normally again.
    const done = dialog.getByRole('button', { name: 'Done' });
    await expect(done).not.toHaveAttribute('aria-disabled', 'true');
  });
});

// ─── Lazy / vanishing target (Phase-8 hardening) ────────────────────────────

test.describe('Guide — lazy target', () => {
  test('a step whose target renders late gets anchored + spotlit once it appears', async ({
    page
  }) => {
    await setup(page);
    await page.getByTestId('start-lazy-tour').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Lazy target');
    // Absent at step start — the engine's initial highlight finds nothing (full scrim, centered).
    await expect(page.locator('[data-guide="fx-lazy"]')).toHaveCount(0);

    // The fixture renders it ~500ms later (simulated async). The surface's MutationObserver must
    // then re-anchor and re-apply the engine ring — the highlight appearing proves the hardening.
    await expect(page.locator('[data-guide="fx-lazy"]')).toHaveAttribute(
      'data-guide-highlight',
      ''
    );
  });
});

// ─── Beacon + hint ──────────────────────────────────────────────────────────

test.describe('Guide — beacon & hint', () => {
  test('the beacon hides while its tour runs', async ({ page }) => {
    await setup(page);
    const beacon = page.locator('.guide-beacon');
    await expect(beacon).toBeVisible();
    await beacon.click();
    await expect(beacon).toBeHidden(); // running → gated out
  });

  test('a manual hint shows and dismisses', async ({ page }) => {
    await setup(page);
    const hint = page.locator('.guide-hint');

    await page.getByTestId('toggle-hint').click();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Export hint');

    await hint.getByRole('button', { name: 'Dismiss hint' }).click();
    await expect(hint).toBeHidden();
  });
});

// ─── axe (WCAG 2.1 AA) ──────────────────────────────────────────────────────

test.describe('Guide — axe scan', () => {
  test('the surfaces pass axe in their default and panel-open states', async ({ page }) => {
    await setup(page);
    const scope = '[data-testid="guide-fixtures"]';

    const initial = await new AxeBuilder({ page }).include(scope).withTags(WCAG_TAGS).analyze();
    expect(initial.violations).toEqual([]);

    await page.locator('[data-guide-marker]').click();
    await expect(page.locator('aside[data-placement]')).toHaveAttribute('data-state', 'open');
    const opened = await new AxeBuilder({ page }).include(scope).withTags(WCAG_TAGS).analyze();
    expect(opened.violations).toEqual([]);
  });
});

// ─── Visual regression (light / dark) ───────────────────────────────────────

test.describe('Guide — visual', { tag: '@pixel' }, () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`panel — ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await setup(page);
      await page.locator('[data-guide-marker]').click();
      await expect(page.locator('aside[data-placement]')).toHaveAttribute('data-state', 'open');
      await expect(page.locator('aside[data-placement]')).toHaveScreenshot(`panel-${scheme}.png`);
    });

    test(`hint — ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await setup(page);
      await page.getByTestId('toggle-hint').click();
      const hint = page.locator('.guide-hint');
      await expect(hint).toBeVisible();
      await expect(hint).toHaveScreenshot(`hint-${scheme}.png`);
    });

    test(`tour — ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await setup(page);
      await page.getByTestId('start-tour').click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      // Step 2 anchors the bubble + cuts the spotlight hole — the richest visual state.
      await dialog.getByRole('button', { name: 'Next' }).click();
      await expect(dialog).toContainText('Step 2 of 3');
      await expect(page).toHaveScreenshot(`tour-${scheme}.png`, { fullPage: false });
    });
  }
});
