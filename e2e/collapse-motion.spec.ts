import { expect, type Locator, test } from '@playwright/test';

/**
 * ACC-3 per-instance collapse motion. Verifies the runtime contract the variants + `style:`
 * bindings rely on: the default resolves the `--blocks-collapse-*` token, per-instance props set
 * the vars inline, an Accordion propagates them to items via CSS-variable inheritance (which
 * hinges on Svelte's `style:{undefined}` leaving the property unset on the inner Collapsible), and
 * a `motion-reduce` guard beats an inline override under reduced motion.
 */

const URL = '/test-fixtures/collapse-motion';

const duration = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transitionDuration);
const easing = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transitionTimingFunction);

test.describe('Collapse motion (ACC-3)', () => {
  test('default resolves the token; props override duration + easing; accordion inherits', async ({
    page
  }) => {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="collapse-motion-fixtures"]');

    // Default → --blocks-collapse-duration = --blocks-duration-normal (250ms). Proves the unset
    // props leave the token in place (Svelte drops the `style:` property when it is undefined).
    expect(await duration(page.locator('#cm-default-content'))).toBe('0.25s');

    // Per-instance props set the shared vars inline on the Collapsible root.
    expect(await duration(page.locator('#cm-prop-content'))).toBe('0.6s');
    expect(await easing(page.locator('#cm-prop-content'))).toBe('linear');

    // Accordion sets the vars on its root; the unstyled inner Collapsible leaves them unset, so
    // the item's content inherits 700ms. Guards the style:{undefined} == "unset" assumption.
    expect(await duration(page.locator('#accordion-a1-content'))).toBe('0.7s');
  });

  test('reduced motion collapses an inline-overridden duration to near-instant', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="collapse-motion-fixtures"]');

    // The `motion-reduce:duration-[1ms]` guard must beat the inline 600ms — an inline duration
    // can't see the media query, so without the guard reduced-motion would be violated.
    expect(await duration(page.locator('#cm-prop-content'))).toBe('0.001s');
  });
});
