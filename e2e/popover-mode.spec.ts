import { expect, type Page, test } from '@playwright/test';

/**
 * A Popover whose `popover` attribute changes state while it is open. The
 * fixture flips `closeOnEscape` from a checkbox inside the panel, which moves
 * the panel between `popover="auto"` and `"manual"`. Writing the attribute
 * makes the browser hide the panel, which the jsdom Popover stub does not
 * model, so this spec is the oracle for it.
 */

const URL = '/test-fixtures/popover-mode';
const PANEL = '[data-testid="popover-mode-panel"]';

interface Frame {
  showing: boolean;
  display: string;
  transitions: number;
}
type FrameStore = { __popoverModeFrames?: Promise<Frame[]> };

const isShowing = (page: Page) => page.locator(PANEL).evaluate((el) => el.matches(':popover-open'));

/**
 * Waits two frames before an assertion that nothing happened: a dismiss the
 * browser performs reaches the Popover through a queued `toggle` task, not
 * within the key press.
 */
const settle = (page: Page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  );

/**
 * Samples the panel once per frame for `ms`. Returns the reader, which waits
 * for the window to close. rAF callbacks run before paint, so a panel that is
 * hidden in any painted frame shows up as a `showing: false` sample.
 */
async function recordFrames(page: Page, ms: number) {
  await page.evaluate(
    ({ selector, windowMs }) => {
      const el = document.querySelector(selector) as HTMLElement;
      const frames: Frame[] = [];
      (window as FrameStore).__popoverModeFrames = new Promise((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          frames.push({
            showing: el.matches(':popover-open'),
            display: getComputedStyle(el).display,
            transitions: el.getAnimations().length
          });
          if (now - start < windowMs) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      });
    },
    { selector: PANEL, windowMs: ms }
  );
  return () => page.evaluate(() => (window as FrameStore).__popoverModeFrames as Promise<Frame[]>);
}

const hidden = (f: Frame) => !f.showing || f.display === 'none';
const transitioning = (f: Frame) => f.transitions > 0;

async function openPanel(page: Page, query: string) {
  await page.goto(`${URL}${query}`, { waitUntil: 'load' });
  const trigger = page.getByRole('button', { name: 'Open' });
  // aria-expanded is stamped by a client effect: its presence proves hydration.
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(page.locator(PANEL)).toBeVisible();
  // The enter transition has run out, so any transition sampled later was
  // started by the mode change.
  await expect.poll(() => page.locator(PANEL).evaluate((el) => el.getAnimations().length)).toBe(0);
  return trigger;
}

/** Flips `closeOnEscape` from the checkbox inside the panel, with focus on it. */
async function flipFromInside(page: Page) {
  const checkbox = page.getByRole('checkbox', { name: 'Close on Escape' });
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  // Longer than the panel's 150ms exit transition, which is what would carry
  // a hidden panel to `display: none`.
  const frames = await recordFrames(page, 400);
  await page.keyboard.press('Space');
  return { checkbox, frames: await frames() };
}

async function expectStillOpen(page: Page) {
  expect(await isShowing(page)).toBe(true);
  await expect(page.locator(PANEL)).toBeVisible();
  await expect(page.locator(PANEL)).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('popover-mode-open')).toHaveText('true');
  await expect(page.getByTestId('popover-mode-calls')).toHaveText('openChange:true');
}

test.describe('Popover mode change while open', () => {
  test('auto → manual keeps the panel shown, and Escape follows closeOnEscape=false', async ({
    page
  }) => {
    await openPanel(page, '');
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'auto');

    const { checkbox, frames } = await flipFromInside(page);
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'manual');

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter(hidden).length, 'frames with the panel hidden').toBe(0);
    expect(frames.filter(transitioning).length, 'frames with a transition running').toBe(0);
    await expectStillOpen(page);
    await expect(checkbox).not.toBeChecked();
    // A panel shown as `auto` hands focus back to the trigger when the browser
    // hides it; the user was on the checkbox and stays there.
    await expect(checkbox).toBeFocused();

    await page.keyboard.press('Escape');
    await settle(page);
    await expectStillOpen(page);
    await expect(checkbox).toBeFocused();
  });

  test('manual → auto keeps the panel shown, reports nothing, and Escape then closes it', async ({
    page
  }) => {
    const trigger = await openPanel(page, '?closeOnEscape=false');
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'manual');

    const { checkbox, frames } = await flipFromInside(page);
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'auto');

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter(hidden).length, 'frames with the panel hidden').toBe(0);
    expect(frames.filter(transitioning).length, 'frames with a transition running').toBe(0);
    // 400ms of frames have passed: a `toggle` the hide queued has been
    // dispatched, so a dismiss it was read as would be in the log by now.
    await expectStillOpen(page);
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('popover-mode-open')).toHaveText('false');
    await expect(page.getByTestId('popover-mode-calls')).toHaveText(
      'openChange:true openChange:false escape'
    );
    expect(await isShowing(page)).toBe(false);
    await expect(trigger).toBeFocused();
  });
});
