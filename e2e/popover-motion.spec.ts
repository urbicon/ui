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

  test('a click on the fading panel does not fire ghost actions', async ({ page }) => {
    // The children stay mounted through the exit lag so the fade has content —
    // data-[state=closed]:pointer-events-none must keep them un-clickable, or
    // a quick click after dismiss would trigger actions from a visually
    // dismissed surface.
    await gotoHydrated(page);
    const probe = page.locator('[data-testid="ghost-probe"]');

    await page.getByRole('button', { name: 'Overridden' }).click();
    await probe.click();
    await expect(page.locator('[data-testid="ghost-clicks"]')).toHaveText('1');

    // Light-dismiss, then immediately click where the probe still fades.
    const box = await probe.boundingBox();
    if (!box) throw new Error('probe has no box');
    await page.mouse.click(4, 4);
    await expect(page.locator('[data-testid="pop-prop"]')).toHaveAttribute('data-state', 'closed');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.locator('[data-testid="ghost-clicks"]')).toHaveText('1');
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

/**
 * Where the motion and the anchoring meet. Both defects below were invisible to
 * the motion specs above (the transition plays correctly either way) and to the
 * `@pixel` fixtures (which disable transitions, so the panel is never measured
 * mid-enter).
 */
test.describe('Popover anchoring', () => {
  test('a panel opening from the enter scale still lands on its nominal offset (#197)', async ({
    page
  }) => {
    await gotoHydrated(page);
    await page.getByRole('button', { name: 'Menu' }).click();

    const panel = page.locator('[role="menu"]');
    await expect(panel).toBeVisible();
    // Long past the 150ms enter — the position is written once, so a wrong
    // first measurement stays wrong.
    await page.waitForTimeout(400);

    const geometry = await page.evaluate(() => {
      const trigger = document.querySelector('button[aria-haspopup="menu"]') as HTMLElement;
      const wrapper = (document.querySelector('[role="menu"]') as HTMLElement)
        .parentElement as HTMLElement;
      const t = trigger.getBoundingClientRect();
      const p = wrapper.getBoundingClientRect();
      return {
        gap: p.y - (t.y + t.height),
        cross: p.x - t.x,
        panelWidth: wrapper.offsetWidth,
        panelHeight: wrapper.offsetHeight
      };
    });

    // Menu anchors a commit-tier trigger at 8px, `bottom-start` (flush left).
    // The failure this guards is proportional to the panel's own size: the
    // enter transition opens from `scale(0.98)`, and measuring the painted box
    // instead of the layout box used to inset the origin by 1% of each
    // dimension — so the assertions below would come in at 8 - height/100 and
    // -width/100. Both are well outside this tolerance for any real panel.
    expect(geometry.gap).toBeCloseTo(8, 1);
    expect(geometry.cross).toBeCloseTo(0, 1);
  });

  test('the popover element paints no UA canvas behind a panel that owns its surface (#196)', async ({
    page
  }) => {
    await gotoHydrated(page);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('[role="menu"]')).toBeVisible();

    const paint = await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]') as HTMLElement;
      const unstyledWrapper = menu.parentElement as HTMLElement;
      const styledPanel = document.querySelector('[data-testid="pop-default"]') as HTMLElement;
      return {
        // Menu renders its Popover `unstyled`, so nothing of ours paints here —
        // and the UA `[popover]` rule used to fill it with `Canvas` (opaque
        // white), whose square corners showed behind the rounded menu panel.
        wrapperBg: getComputedStyle(unstyledWrapper).backgroundColor,
        menuBg: getComputedStyle(menu).backgroundColor,
        // The reset lives in `@layer base`, so a Popover that DOES paint its own
        // surface keeps it — that utility outranks every layered rule.
        styledBg: getComputedStyle(styledPanel).backgroundColor
      };
    });

    expect(paint.wrapperBg).toBe('rgba(0, 0, 0, 0)');
    expect(paint.menuBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(paint.styledBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(paint.styledBg).toBe(paint.menuBg);
  });
});
