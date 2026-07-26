import { expect, type Page, test } from '@playwright/test';
import { type ForcedPseudoClass, force, nodeIdsWithin, openCdp } from './helpers/force-state';

/**
 * Visual-regression baseline for INTERACTION states, against the fixture at
 * /test-fixtures/interaction.
 *
 *   4 groups × 3 states × (2 schemes × 2 themes) = 48 shots.
 *
 * Why this exists as its own suite: the resting matrix
 * (visual-regression.spec.ts) renders every primitive at rest, so it is blind
 * to the entire interaction layer. The 2026-07-25 interaction-token wave
 * changed `--color-text-disabled`, Combobox's focus ring, two description
 * sizes and the filled-field hover fill — and moved 0 of its 52 shots. The
 * wave had to be verified by measuring computed styles in a throwaway probe.
 *
 * ── How the states are driven ────────────────────────────────────────────────
 *
 * Via CDP `CSS.forcePseudoState` (see e2e/helpers/force-state.ts), not a real
 * pointer or a real focus.
 *
 * The trade-off, stated plainly: every element in a group is hovered at once,
 * which no real user can do. That is intentional for a *token* baseline — the
 * question these shots answer is "is this state visibly different from rest,
 * and is it legible", not "what does the page look like under a real cursor".
 * Interaction *behaviour* is covered by the DOM suites, not here.
 *
 * ── What these shots CANNOT prove ────────────────────────────────────────────
 *
 * Colour changes smaller than the suite's per-pixel `threshold: 0.15`.
 * Measured, not assumed: reverting the `surface-subtle` fix left all 48 shots
 * green, because neutral-50 vs neutral-100 sits under that tolerance; only
 * dropping the threshold to 0.005 turned them red, and that trades the bug
 * class for antialiasing flake. So a neighbouring-rung collapse is invisible
 * here BY CONSTRUCTION, and `interaction-tokens.spec.ts` carries that half by
 * comparing resolved colours instead of pixels. These shots cover what it
 * cannot: layout, geometry, rings, and strong colour shifts.
 *
 * ── Why every group renders twice ────────────────────────────────────────────
 *
 * Once on `surface-base`, once inside an elevated Card. A hover fill that
 * collapses onto its backdrop is invisible only on the surface it collides
 * with, so a one-surface fixture cannot see it. `hover:bg-surface-subtle` read
 * correctly on the page and was dead on every elevated surface across 8
 * components for exactly that reason (fixed 2026-07-26). `semantic.test.ts`
 * guards the token values; these shots guard the composed result.
 */

const URL = '/test-fixtures/interaction';

const GROUPS = ['field', 'choice', 'nav', 'action'] as const;

/**
 * `rest` carries no forced class. `focus` forces both `focus` and
 * `focus-visible`: the library styles rings with `focus-visible:` throughout
 * (keyboard-only rings), while a few slots still key off plain `focus`.
 */
const STATES = {
  rest: [],
  hover: ['hover'],
  focus: ['focus', 'focus-visible']
} as const satisfies Record<string, readonly ForcedPseudoClass[]>;

const SCHEMES = ['light', 'dark'] as const;
const THEMES = ['library', 'rooms'] as const;

// Same renderer pin as the resting suite — headless_shell's font rasterisation
// drifts ~1px from the full build, which a pixel-diff suite must avoid.
test.use({ channel: 'chromium' });

async function setup(page: Page, scheme: (typeof SCHEMES)[number], theme: (typeof THEMES)[number]) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="interaction-fixtures"]');

  // The docs app.html ships `<html class="docs-rooms">` as its DEFAULT skin, so
  // "library" must actively REMOVE the class rather than merely skip adding it.
  await page.evaluate((rooms) => {
    document.documentElement.classList.toggle('docs-rooms', rooms);
  }, theme === 'rooms');

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

test.describe('Interaction-state visual regression', () => {
  for (const scheme of SCHEMES) {
    for (const theme of THEMES) {
      test(`${scheme} · ${theme}`, async ({ page }) => {
        await setup(page, scheme, theme);

        const cdp = await openCdp(page);

        try {
          for (const group of GROUPS) {
            const section = page.getByTestId(`vr-ix-${group}`);
            const nodeIds = await nodeIdsWithin(cdp, `vr-ix-${group}`);
            expect(
              nodeIds.length,
              `no nodes resolved for vr-ix-${group} — the forced-state pass would be a silent no-op`
            ).toBeGreaterThan(0);

            for (const [state, pseudoClasses] of Object.entries(STATES)) {
              await force(cdp, nodeIds, pseudoClasses);
              await expect(section).toHaveScreenshot(`${group}-${state}-${scheme}-${theme}.png`);
            }

            // Clear before moving on, so a group's state cannot leak into the
            // next one through a shared ancestor.
            await force(cdp, nodeIds, []);
          }
        } finally {
          await cdp.detach();
        }
      });
    }
  }
});
