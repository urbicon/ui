import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Scroll-engine coverage for ChatMessageList against the dedicated fixture at
 * /test-fixtures/chat — the P2 exit criterion (stick-to-bottom / interrupt /
 * prepend anchor) that vitest+jsdom cannot cover for real (no layout).
 */

const URL = '/test-fixtures/chat';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function setup(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.goto(URL, { waitUntil: 'load' });
  // data-hydrated appears once the client runtime (and with it the scroll
  // engine's effects) is live — SSR markup alone races the first assertions.
  await page.waitForSelector('[data-testid="chat-fixtures"][data-hydrated]');
}

function viewport(page: Page) {
  return page.getByRole('region', { name: 'Conversation' });
}

async function distanceFromBottom(page: Page): Promise<number> {
  return viewport(page).evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
}

test.describe('ChatMessageList — stick-to-bottom', () => {
  test('opens at the newest message and follows appends while stuck', async ({ page }) => {
    await setup(page);
    await expect.poll(() => distanceFromBottom(page)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('stick-state')).toHaveText('stuck');

    await page.getByTestId('append-one').click();
    await expect(page.locator('[data-fixture-id="m11"]')).toBeInViewport();
    await expect.poll(() => distanceFromBottom(page)).toBeLessThanOrEqual(1);
  });

  test('upward scroll interrupts following; appends count on the jump button', async ({ page }) => {
    await setup(page);
    await viewport(page).hover();
    await page.mouse.wheel(0, -400);
    await expect(page.getByTestId('stick-state')).toHaveText('unstuck');

    const before = await viewport(page).evaluate((el) => el.scrollTop);
    await page.getByTestId('append-burst').click();
    // no follow: the reading position stays put
    const after = await viewport(page).evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);

    const jump = page.getByRole('button', { name: '3 New messages' });
    await expect(jump).toBeVisible();

    await jump.click();
    await expect(page.getByTestId('stick-state')).toHaveText('stuck');
    await expect.poll(() => distanceFromBottom(page)).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: /New messages|Scroll to bottom/ })).toHaveCount(
      0
    );
  });

  test('scrolling back to the bottom re-sticks without the button', async ({ page }) => {
    await setup(page);
    await viewport(page).hover();
    await page.mouse.wheel(0, -400);
    await expect(page.getByTestId('stick-state')).toHaveText('unstuck');

    await page.mouse.wheel(0, 4000);
    await expect(page.getByTestId('stick-state')).toHaveText('stuck');
  });
});

test.describe('ChatMessageList — streaming follow', () => {
  test('follows growing streamed content while stuck, not after interrupting', async ({ page }) => {
    await setup(page);
    await page.getByTestId('start-stream').click();

    // while stuck the viewport keeps hugging the bottom as content grows
    await page.waitForTimeout(300);
    await expect.poll(() => distanceFromBottom(page)).toBeLessThanOrEqual(1);

    await viewport(page).hover();
    await page.mouse.wheel(0, -400);
    await expect(page.getByTestId('stick-state')).toHaveText('unstuck');
    const frozen = await viewport(page).evaluate((el) => el.scrollTop);
    await page.waitForTimeout(300);
    const later = await viewport(page).evaluate((el) => el.scrollTop);
    expect(Math.abs(later - frozen)).toBeLessThanOrEqual(1);
  });

  test('announces generation start and the completed text once', async ({ page }) => {
    await setup(page);
    const status = page.locator('[role="status"]');
    await page.getByTestId('start-stream').click();
    await expect(status).toHaveText('Generating response…');
    await expect(status).toContainText('Streamed sentence 12.', { timeout: 5_000 });
  });
});

test.describe('ChatMessageList — prepend anchor', () => {
  test('loading older history keeps the visible message visually still', async ({ page }) => {
    await setup(page);
    await viewport(page).hover();
    await page.mouse.wheel(0, -600);
    await expect(page.getByTestId('stick-state')).toHaveText('unstuck');

    // pick a message currently in the viewport and pin its screen position
    const anchor = page.locator('[data-fixture-id="m6"]');
    const before = await anchor.boundingBox();
    expect(before).not.toBeNull();

    await page.getByTestId('prepend-history').click();
    await expect(page.locator('[data-fixture-id="h1-1"]')).toHaveCount(1);

    const after = await anchor.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2);

    // and the prepended batch did not count as new messages
    await expect(page.getByRole('button', { name: /New messages/ })).toHaveCount(0);
  });
});

test.describe('ChatMessageList — a11y', () => {
  test('axe scan of the chat fixture region is clean', async ({ page }) => {
    await setup(page);
    // Scoped to the fixture: the docs-app shell around it has known baseline
    // findings (see a11y.spec.ts) that are not this component's to fix.
    const results = await new AxeBuilder({ page })
      .include('[data-testid="chat-fixtures"]')
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
