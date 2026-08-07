import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Visual-regression baseline for the thirteen core primitives, against the dedicated
 * fixture at /test-fixtures/primitives. Each primitive is snapped on its own
 * (`data-testid="vr-<name>"`) across the full theming matrix:
 *
 *   scheme ∈ {light, dark}  ×  theme ∈ {library, rooms}  ×  13 primitives = 52 shots.
 *
 * scheme is driven by `emulateMedia({ colorScheme })` — the library resolves dark
 * mode through the CSS `light-dark()` function off `color-scheme`, so this flips the
 * whole token system with no app-level toggle. `rooms` is the shipped docs skin
 * (Color Rooms), activated by `<html class="docs-rooms">` (see
 * apps/docs/.../rooms-docs.css), which re-resolves the semantic ramps to the warm
 * cream palette with the section's room accent as primary.
 *
 * Determinism: the fixture is static (no interaction, no open overlays, Progress
 * carries an explicit value, Avatar uses initials — no image load); Playwright disables
 * animations; and we await `document.fonts.ready` so a snapshot never races self-hosted
 * font loading (the one flake source this kind of suite is prone to). Baselines are
 * committed as `-chromium-darwin`; regenerate with `bun run test:e2e:update` if the
 * rendering environment changes (see docs/technical-debt.md — CI may need one rebaseline).
 */

const URL = '/test-fixtures/primitives';

const PRIMITIVES = [
  'button',
  'input',
  'checkbox',
  'toggle',
  'badge',
  'alert',
  'card',
  'avatar',
  'progress',
  'select',
  'radio-group',
  'pin-input',
  'time-input'
] as const;

/**
 * Controls driven through hover and focus, one per `ix-<name>` wrapper in the
 * fixture. Deliberately a small set: these cover the interaction vocabulary the
 * library actually shares — the filled field fill (input, select), the canonical
 * press/focus surface (button) and the two check controls whose focus ring and
 * hover live in their own variants (checkbox, toggle).
 */
const INTERACTIVE = ['button', 'input', 'select', 'checkbox', 'toggle'] as const;

const SCHEMES = ['light', 'dark'] as const;
const THEMES = ['library', 'rooms'] as const;

// Render with the full chromium build's "new headless" mode rather than the default
// headless-shell: the shell's font rasterisation drifts by ~1px from headed/CI chromium
// (see docs/technical-debt.md), which is exactly what a pixel-diff suite must avoid.
// Scoped to this spec so the existing floating/guide baselines are untouched.
test.use({ channel: 'chromium' });

/**
 * Byte-exact comparison, overriding the project defaults (0.002 / 0.15) for this
 * suite only.
 *
 * The defaults were calibrated for the specs that shoot real docs pages, and they
 * make this suite nearly useless: measured 2026-07-26, changing
 * `--color-text-disabled` to pure red moved **zero** of the 52 shots, because a
 * label is ~98 pixels against a whole section and 98/section < 0.002. The
 * per-pixel `threshold: 0.15` hides the other half — a ΔL of 0.015 (the light
 * surface-ladder change) never trips it, so 24 shots silently kept showing
 * surfaces the library no longer had.
 *
 * This fixture can afford exactness where the docs-page specs cannot: it is
 * static, `transition: none`, no images, no time, and it waits on
 * `document.fonts.ready`. Verified: three consecutive runs at threshold 0 /
 * ratio 0 with zero diff, while the same settings applied globally leave five
 * docs-page shots permanently red.
 *
 * The cost is honest: a Chromium/font update will make these shots red rather
 * than silently stale, which is the trade this suite exists to make. Re-baseline
 * deliberately with `--update-snapshots=all`.
 */
const EXACT = { threshold: 0, maxDiffPixelRatio: 0 } as const;

async function setup(page: Page, scheme: (typeof SCHEMES)[number], theme: (typeof THEMES)[number]) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  // Set the media scheme before navigation so the first paint is already correct.
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="primitives-fixtures"]');

  // The docs app.html ships `<html class="docs-rooms">` as its DEFAULT skin, so
  // "library" must actively REMOVE the class (not merely skip adding it) to fall back to
  // the library defaults; "rooms" ensures it regardless of that default. A plain
  // `add`-on-rooms would leave every shot rooms (the bug this replaced).
  await page.evaluate((rooms) => {
    document.documentElement.classList.toggle('docs-rooms', rooms);
  }, theme === 'rooms');

  // Guard against font-load races (self-hosted fontsource faces + the Schibsted
  // display face), then a short settle for the rooms token re-resolution.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  await expectRoomStamped(page, theme);
}

/**
 * The shots cannot see this, so it is asserted instead.
 *
 * `/test-fixtures/*` has no area entry in the channel register, so it resolves
 * to `DEFAULT_CHANNEL` — and the default's accent is byte-identical to the
 * un-stamped fallback in rooms-channels.gen.css (both `oklch(0.67 0.21 40)`).
 * A room stamped correctly and a room never stamped at all therefore render the
 * same on this fixture: if `data-room` stopped being applied, every shot here
 * would stay green while the whole colour-room mechanism was dead.
 *
 * The `.docs-room-scope` wrapper is the one that matters — it carries the stamp
 * server-side and is what the content reads. The `<html>` mirror is for portaled
 * popovers and only lands after mount.
 */
async function expectRoomStamped(page: Page, theme: (typeof THEMES)[number]) {
  if (theme !== 'rooms') return;
  const room = await page.getAttribute('.docs-room-scope', 'data-room');
  expect(
    room,
    'no data-room on .docs-room-scope — the rooms skin would fall back to the un-stamped accent, ' +
      'which on this route is the same colour and so invisible in every shot below'
  ).toBeTruthy();
}

test.describe('Primitive visual regression', { tag: '@pixel' }, () => {
  // Both platforms now have baselines (`…-chromium-darwin.png` +
  // `…-chromium-linux.png`), generated 2026-07-26 — the Linux set on the deploy
  // host itself, which is the machine that will run them. The darwin-only skip
  // that used to sit here is gone with the reason for it.

  for (const scheme of SCHEMES) {
    for (const theme of THEMES) {
      test(`${scheme} · ${theme}`, async ({ page }) => {
        await setup(page, scheme, theme);

        for (const name of PRIMITIVES) {
          const section = page.getByTestId(`vr-${name}`);
          await expect(section).toHaveScreenshot(`${name}-${scheme}-${theme}.png`, EXACT);
        }
      });

      test(`${scheme} · ${theme} · interaction`, async ({ page }) => {
        await setup(page, scheme, theme);

        // Two committed frames. `hover()` and `focus()` only dispatch the event —
        // the style recalculation lands on the next frame, and a screenshot taken
        // in between catches the previous state. Playwright's own stability retry
        // does not save us here: it compares consecutive captures, and two
        // identical *pre-hover* frames look perfectly stable. This made
        // `ix-button-hover-light-rooms` fail in one run and pass in the next.
        const settle = () =>
          page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              )
          );

        // …and, before those frames, wait for the state to have ARRIVED. Two
        // committed frames are only enough while the machine is idle: under
        // `workers: 50%` the pointer move can still be in flight when they run,
        // and at zero tolerance a shot of a still-resting control fails hard
        // (~22 % of the image). Polling the state itself — `:hover` actually
        // matching, focus actually inside the wrapper — is what makes the
        // settle deterministic; the frames then only cover the style
        // recalculation, which is the job they were added for.
        const arrived = async (locator: Locator, state: (el: HTMLElement) => boolean) => {
          await expect
            .poll(() => locator.evaluate(state as (el: SVGElement | HTMLElement) => boolean), {
              timeout: 2000
            })
            .toBe(true);
          await settle();
        };

        // A neutral parking spot for the pointer: without it the mouse keeps
        // sitting on whatever it touched last, so the next control's shot would
        // silently carry a stale hover. Deliberately no click — clicking `body`
        // is itself an interaction (it can move focus and fire handlers);
        // blurring the active element is the part we actually want.
        const park = async () => {
          await page.mouse.move(0, 0);
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await settle();
        };

        for (const name of INTERACTIVE) {
          const wrapper = page.getByTestId(`ix-${name}`);
          // Focus goes to the real control — which for Checkbox and Toggle is a
          // visually-hidden <input> behind the label. That also means it cannot
          // be hovered (Playwright refuses to hover a zero-size element), so the
          // pointer targets the wrapper instead: it holds exactly one control,
          // so its centre lands on the visible part and drives the same
          // `group-hover:` styling a user would.
          const control = wrapper.locator('button, input, select').first();

          // Scroll BEFORE parking the pointer, not as part of hovering.
          // `hover()` scrolls the element into view and then moves the mouse to
          // where it computed the centre to be — but the scroll itself shifts the
          // page, so on the first control of this section (the one that actually
          // needs scrolling) the pointer landed next to the button instead of on
          // it. The shot then captured a resting button; ~30% of the image
          // differed, in one run out of three. Scroll, settle, then hover.
          await wrapper.scrollIntoViewIfNeeded();
          await settle();

          await park();
          await wrapper.hover();
          await arrived(wrapper, (el) => el.matches(':hover'));
          await expect(wrapper).toHaveScreenshot(`ix-${name}-hover-${scheme}-${theme}.png`, EXACT);

          await park();
          await control.focus();
          await arrived(wrapper, (el) => el.contains(document.activeElement));
          await expect(wrapper).toHaveScreenshot(`ix-${name}-focus-${scheme}-${theme}.png`, EXACT);
        }
      });
    }
  }
});
