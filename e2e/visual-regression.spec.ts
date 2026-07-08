import { expect, type Page, test } from '@playwright/test';

/**
 * Visual-regression baseline for the ten core primitives, against the dedicated
 * fixture at /test-fixtures/primitives. Each primitive is snapped on its own
 * (`data-testid="vr-<name>"`) across the full theming matrix:
 *
 *   scheme ∈ {light, dark}  ×  theme ∈ {library, editorial}  ×  10 primitives = 40 shots.
 *
 * scheme is driven by `emulateMedia({ colorScheme })` — the library resolves dark
 * mode through the CSS `light-dark()` function off `color-scheme`, so this flips the
 * whole token system with no app-level toggle. `editorial` is the opt-in docs skin,
 * activated by `<html class="docs-editorial">` (see apps/docs/.../editorial.css), which
 * re-resolves the semantic ramps to the warm editorial palette.
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
  'select'
] as const;

const SCHEMES = ['light', 'dark'] as const;
const THEMES = ['library', 'editorial'] as const;

// Render with the full chromium build's "new headless" mode rather than the default
// headless-shell: the shell's font rasterisation drifts by ~1px from headed/CI chromium
// (see docs/technical-debt.md), which is exactly what a pixel-diff suite must avoid.
// Scoped to this spec so the existing floating/guide baselines are untouched.
test.use({ channel: 'chromium' });

async function setup(page: Page, scheme: (typeof SCHEMES)[number], theme: (typeof THEMES)[number]) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  // Set the media scheme before navigation so the first paint is already correct.
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="primitives-fixtures"]');

  // The docs app.html ships `<html class="docs-editorial">` as its DEFAULT skin, so
  // "library" must actively REMOVE the class (not merely skip adding it) to fall back to
  // the library defaults; "editorial" ensures it regardless of that default. A plain
  // `add`-on-editorial would leave every shot editorial (the bug this replaced).
  await page.evaluate((editorial) => {
    document.documentElement.classList.toggle('docs-editorial', editorial);
  }, theme === 'editorial');

  // Guard against font-load races (self-hosted fontsource faces + the editorial
  // display face), then a short settle for the editorial token re-resolution.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

test.describe('Primitive visual regression', () => {
  // Baselines are captured with chromium on macOS (`…-chromium-darwin.png`). On Linux
  // (CI) Playwright resolves `…-chromium-linux.png` and hard-fails on the missing files,
  // so the suite is gated to darwin until per-platform baselines exist — the "CI-optional
  // until stable" intent from the TODO. (The existing floating/guide visual specs are
  // darwin-only too; docs/technical-debt.md tracks generating Linux baselines for the
  // whole e2e-visual layer.)
  test.beforeEach(() => {
    test.skip(
      process.platform !== 'darwin',
      'chromium-darwin baselines only — regenerate on Linux (see docs/technical-debt.md) to enable in CI'
    );
  });

  for (const scheme of SCHEMES) {
    for (const theme of THEMES) {
      test(`${scheme} · ${theme}`, async ({ page }) => {
        await setup(page, scheme, theme);

        for (const name of PRIMITIVES) {
          const section = page.getByTestId(`vr-${name}`);
          await expect(section).toHaveScreenshot(`${name}-${scheme}-${theme}.png`);
        }
      });
    }
  }
});
