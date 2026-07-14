import { expect, type Locator, test } from '@playwright/test';

/**
 * Popover enter/exit motion (ACC-3 rest). Two layers of contract:
 *
 * 1. Token plumbing (mirrors tooltip-motion.spec): the default resolves the
 *    `--blocks-popover-*` tokens, per-instance props set the vars inline on
 *    the panel, and the `motion-reduce` guard beats an inline override under
 *    reduced motion. Readable while closed — the panel element always exists.
 *
 * 2. The motion actually plays (the part jsdom can't verify): enter fades in
 *    from the `@starting-style` before-state after `showPopover()`, and exit
 *    keeps the panel painted through the native hide via
 *    `transition-behavior: allow-discrete` — including the children, whose
 *    teardown Popover lags to the computed transition duration.
 */

const URL = '/test-fixtures/popover-motion';

const duration = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transitionDuration);
const easing = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transitionTimingFunction);
const opacity = (l: Locator) => l.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
const display = (l: Locator) => l.evaluate((el) => getComputedStyle(el).display);

// The trigger's aria-expanded is stamped by a client-side effect after mount —
// its presence proves hydration finished. Clicking earlier hits the inert SSR
// button and the popover never opens.
async function gotoHydrated(page: import('@playwright/test').Page) {
  await page.goto(URL, { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: 'Default' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
}

test.describe('Popover motion (ACC-3 rest)', () => {
  test('default resolves the fast token; props override duration + easing', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="popover-motion-fixtures"]');

    const panel = page.locator('[data-testid="pop-default"]');
    // --blocks-popover-duration = --blocks-duration-fast (150ms): anchored
    // panels sit between the instant tooltip and the 200ms modal overlays.
    expect(await duration(panel)).toBe('0.15s');
    // --blocks-popover-easing = --blocks-ease-confident.
    expect(await easing(panel)).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    // The discrete pair is what keeps the exit painted through hidePopover().
    const property = await panel.evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(property).toContain('display');
    expect(property).toContain('overlay');
    const behavior = await panel.evaluate((el) => getComputedStyle(el).transitionBehavior);
    expect(behavior).toContain('allow-discrete');

    // Per-instance props set the shared popover vars inline on the panel.
    expect(await duration(page.locator('[data-testid="pop-prop"]'))).toBe('0.6s');
    expect(await easing(page.locator('[data-testid="pop-prop"]'))).toBe('linear');
  });

  test('menu panel inherits the motion fragment on its (unstyled) popover wrapper', async ({
    page
  }) => {
    await gotoHydrated(page);
    await page.getByRole('button', { name: 'Menu' }).click();
    const wrapper = page.locator('[role="menu"]');
    await expect(wrapper).toBeVisible();
    // Menu strips Popover's variants (unstyled) and re-applies exactly the
    // motion fragment via `class` — the transparent wrapper animates, which
    // fades the menu chrome inside it.
    const props = await wrapper.evaluate((el) => {
      const style = getComputedStyle(el.parentElement as HTMLElement);
      return { duration: style.transitionDuration, property: style.transitionProperty };
    });
    expect(props.duration).toBe('0.15s');
    expect(props.property).toContain('opacity');
  });

  test('enter fades in from the @starting-style before-state', async ({ page }) => {
    await gotoHydrated(page);
    const panel = page.locator('[data-testid="pop-prop"]');

    await page.getByRole('button', { name: 'Overridden' }).click();
    // 600ms linear fade: sampling right after the click must land mid-fade —
    // without @starting-style the panel pops in at opacity 1 instantly.
    expect(await opacity(panel)).toBeLessThan(1);
    await expect.poll(() => opacity(panel)).toBe(1);
    await expect(page.locator('[data-testid="pop-prop-content"]')).toBeVisible();
  });

  test('exit keeps panel and children painted while the discrete transition plays', async ({
    page
  }) => {
    await gotoHydrated(page);
    const panel = page.locator('[data-testid="pop-prop"]');
    const content = page.locator('[data-testid="pop-prop-content"]');

    await page.getByRole('button', { name: 'Overridden' }).click();
    await expect.poll(() => opacity(panel)).toBe(1);

    // Native light dismiss (auto mode): the browser hides the popover, the
    // allow-discrete transition keeps it painted while it fades.
    await page.mouse.click(4, 4);
    await expect(panel).toHaveAttribute('data-state', 'closed');
    expect(await display(panel)).not.toBe('none');
    expect(await opacity(panel)).toBeGreaterThan(0);
    // The children must outlive `open` for the fade to show anything — their
    // teardown lags by the computed transition duration.
    expect(await content.count()).toBe(1);

    // After the fade (600ms + teardown buffer) the panel is display:none and
    // the children are unmounted.
    await expect.poll(() => display(panel), { timeout: 3_000 }).toBe('none');
    await expect.poll(() => content.count(), { timeout: 3_000 }).toBe(0);
  });

  test('reduced motion collapses both the token and an inline override to near-instant', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="popover-motion-fixtures"]');

    // The default token chases --blocks-duration-fast → 1ms under reduced motion.
    expect(await duration(page.locator('[data-testid="pop-default"]'))).toBe('0.001s');
    // The `motion-reduce:duration-[1ms]` guard must beat the inline 600ms — an
    // inline duration can't see the media query.
    expect(await duration(page.locator('[data-testid="pop-prop"]'))).toBe('0.001s');
  });
});
