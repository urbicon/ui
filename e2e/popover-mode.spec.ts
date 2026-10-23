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
  const trigger = page.getByRole('button', { name: 'Open', exact: true });
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

  test('a pick that locks the panel leaves the open listbox painted above it', async ({ page }) => {
    await openPanel(page, '?s=tags');
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'auto');
    const combobox = page.getByRole('combobox', { name: 'Fruit' });
    await combobox.click();
    await expect(page.getByRole('listbox')).toBeVisible();

    // A multi-select pick keeps the listbox open and locks the panel
    // (`closeOnClickOutside` off), so the panel is shown again under it.
    await page.getByRole('option', { name: 'Banana' }).click();
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'manual');
    await expect(page.getByRole('listbox')).toBeVisible();

    // What is painted at each option's centre. The panel is tall enough to lie
    // under the whole listbox, so a panel shown above it covers every option.
    const hits = await page.evaluate((selector) => {
      const panel = document.querySelector(selector) as HTMLElement;
      const box = panel.getBoundingClientRect();
      return [...document.querySelectorAll('[role="option"]')].map((option) => {
        const r = option.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          overPanel: x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
          onTop: !!hit && option.contains(hit)
        };
      });
    }, PANEL);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.overPanel)).toBe(true);
    expect(hits.filter((h) => !h.onTop).length, 'options painted under the panel').toBe(0);
    await expectStillOpen(page);
    await expect(combobox).toBeFocused();
  });

  test('a mode change during the enter transition lets it run out', async ({ page }) => {
    await page.goto(`${URL}?duration=1000`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-hydrated]');

    // Open, then flip 100ms into the 1s enter. Driven from the page so the
    // flip cannot miss the transition it is about to meet.
    const run = await page.evaluate(async (selector) => {
      const panel = document.querySelector(selector) as HTMLElement;
      const trigger = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Open'
      ) as HTMLElement;
      trigger.click();
      await new Promise((r) => setTimeout(r, 100));
      const enterRunning = panel.getAnimations().length > 0;
      (panel.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
      const opacities: number[] = [];
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          opacities.push(Number(getComputedStyle(panel).opacity));
          if (now - start < 300) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return { enterRunning, attribute: panel.getAttribute('popover'), opacities };
    }, PANEL);

    expect(run.enterRunning).toBe(true);
    expect(run.attribute).toBe('manual');
    // Still fading in after the flip, not cut to its end.
    expect(run.opacities[0]).toBeLessThan(1);
    expect(run.opacities.filter((o) => o < 1).length).toBeGreaterThan(1);
  });

  test('a mode change leaves a panel hidden for its lost anchor hidden', async ({ page }) => {
    await page.goto(`${URL}?s=anchor`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-hydrated]');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page.locator(PANEL)).toBeVisible();
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'manual');

    // Locked, so a click outside does not dismiss; the anchor goes, and
    // `useFloatingPanel` hides the still-open panel.
    await page.getByRole('button', { name: 'Remove anchor' }).click();
    await expect.poll(() => isShowing(page)).toBe(false);
    await expect(page.getByTestId('popover-mode-open')).toHaveText('true');

    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.locator(PANEL)).toHaveAttribute('popover', 'auto');
    await settle(page);
    expect(await isShowing(page)).toBe(false);
  });
});
