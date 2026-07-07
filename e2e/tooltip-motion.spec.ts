import { expect, type Locator, test } from '@playwright/test';

/**
 * Tooltip fade motion (ACC-3 follow-up). Verifies the runtime contract the tooltip variants +
 * `style:` bindings rely on: the default resolves the `--blocks-tooltip-*` token (deliberately the
 * fast/150ms value, not the 200ms panel-overlay duration), per-instance props set the vars inline
 * on the panel, and a `motion-reduce` guard beats an inline override under reduced motion. The
 * panel carries the transition class regardless of open state (popover manual → display:none until
 * shown), so the computed style resolves without hovering.
 */

const URL = '/test-fixtures/tooltip-motion';

const duration = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transitionDuration);
const easing = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transitionTimingFunction);

test.describe('Tooltip motion (ACC-3 follow-up)', () => {
  test('default resolves the fast token; props override duration + easing', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="tooltip-motion-fixtures"]');

    // Default → --blocks-tooltip-duration = --blocks-duration-fast (150ms). Deliberately faster
    // than the 200ms panel overlays — a hint should feel instant, not staged.
    expect(await duration(page.locator('[data-testid="tt-default"]'))).toBe('0.15s');

    // Default easing resolves to `--blocks-ease-confident` = cubic-bezier(0.4,0,0.2,1), which is
    // exactly Tailwind's implicit transition curve the fade used before it had an explicit
    // `ease-*` — so the token migration leaves the resting fade byte-for-byte unchanged.
    expect(await easing(page.locator('[data-testid="tt-default"]'))).toBe(
      'cubic-bezier(0.4, 0, 0.2, 1)'
    );

    // Per-instance props set the shared tooltip vars inline on the panel.
    expect(await duration(page.locator('[data-testid="tt-prop"]'))).toBe('0.6s');
    expect(await easing(page.locator('[data-testid="tt-prop"]'))).toBe('linear');
  });

  test('reduced motion collapses both the token and an inline override to near-instant', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="tooltip-motion-fixtures"]');

    // The default token chases --blocks-duration-fast → 1ms under reduced motion.
    expect(await duration(page.locator('[data-testid="tt-default"]'))).toBe('0.001s');
    // The `motion-reduce:duration-[1ms]` guard must beat the inline 600ms — an inline duration
    // can't see the media query, so without the guard reduced motion would be violated.
    expect(await duration(page.locator('[data-testid="tt-prop"]'))).toBe('0.001s');
  });
});
