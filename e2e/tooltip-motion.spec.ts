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

  test('the fade actually plays in top-layer mode (@starting-style enter, discrete exit)', async ({
    page
  }) => {
    // Regression (2026-07-14): the transition classes resolved correctly but the
    // fade NEVER ran in top-layer mode — showPopover() revealed the chip with no
    // before-state (enter popped to opacity 1) and hidePopover() yanked it to
    // display:none in the same recalc (exit never painted a frame). Fixed with
    // the popoverMotion mechanism: `starting:opacity-0` + display/overlay in a
    // discrete transition list. The 600ms linear fixture makes mid-fade
    // sampling deterministic.
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="tooltip-motion-fixtures"]');

    const chip = page.locator('[data-testid="tt-prop"]');
    const trigger = page.getByRole('button', { name: 'Overridden trigger' });
    const isShown = () => chip.evaluate((el) => el.matches(':popover-open'));
    const opacity = () => chip.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    const display = () => chip.evaluate((el) => getComputedStyle(el).display);

    // Hydration-robust open: hovering an inert SSR span does nothing, so
    // re-hover until the show path (showDelay 200ms) actually fires.
    await expect
      .poll(
        async () => {
          await page.mouse.move(4, 4);
          await trigger.hover();
          await page.waitForTimeout(300);
          return isShown();
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    // Enter: sampled within the 600ms window the fade must be mid-flight —
    // without @starting-style it would already read 1.
    expect(await opacity()).toBeLessThan(1);
    await expect.poll(opacity).toBe(1);

    // Exit: after unhover (hideDelay 100ms) the discrete transition keeps the
    // chip painted while opacity ramps down…
    await page.mouse.move(4, 4);
    await expect
      .poll(async () => (await display()) === 'block' && (await opacity()) < 1, {
        timeout: 5_000
      })
      .toBe(true);
    // …and only after the fade does the UA display:none land.
    await expect.poll(display, { timeout: 5_000 }).toBe('none');
  });
});
