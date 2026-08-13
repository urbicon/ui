import { expect, test } from '@playwright/test';
import { forceWithin, openCdp } from './helpers/force-state';

/**
 * Resolved-value gate for hover fills — the half a screenshot cannot prove.
 *
 * Screenshots are the obvious tool for "did the interaction layer change", and
 * they are the wrong one for this bug class. The suite's `threshold: 0.15` is a
 * per-pixel colour tolerance, and neighbouring rungs of the neutral ramp
 * (neutral-50 vs neutral-100) sit under it: reverting the `surface-subtle` fix
 * left all 48 interaction shots GREEN, and only dropping the threshold to 0.005
 * turned them red. Lowering it globally is not the answer either — that is what
 * antialiasing tolerance is for, and the resting suite's 52 baselines depend on
 * it. So the pixel suite covers layout, rings and strong colour changes, and
 * this suite covers the exact question the pixels blur:
 *
 *   Does a hover fill actually produce a visible colour?
 *
 * Two assertions per element carrying a `hover:bg-*` / `group-hover:bg-*` class:
 *
 *   1. hover ≠ rest      — the fill resolves at all (not shadowed or dead)
 *   2. hover ≠ backdrop  — the fill is DISTINGUISHABLE from what is actually
 *                          behind it, walking up to the nearest non-transparent
 *                          ancestor. This is the one that matters: a `ghost`
 *                          field rests on `bg-transparent`, so (1) alone passes
 *                          trivially while the user sees nothing, which is
 *                          exactly how `hover:bg-surface-subtle` survived on
 *                          every elevated surface.
 *
 * The fixture renders each group on `surface-base` AND inside an elevated Card,
 * so both backdrops are exercised in one pass.
 *
 * Deliberately hover-only. `focus-visible:bg-surface-base` legitimately matches
 * its backdrop on a base surface — the focus affordance there is the ring and
 * border, not the fill — so the same rule would produce false positives.
 * Focus rings are high-contrast enough for the pixel suite to hold.
 */

/**
 * The press cue is the same bug class one axis over, and it bit twice (#192):
 *
 *   1. `active:scale-*` written as a literal, so `prefers-reduced-motion` could
 *      not reach it and no button could opt out.
 *   2. `active:shadow-sm` on a variant that ALREADY rests at `sm` — a class that
 *      is present, compiles, and changes nothing. A unit test on the class
 *      string is green either way; only the resolved value tells them apart,
 *      which is why this lives here rather than in `button.variants.test.ts`.
 *
 * The second one mattered because `mint="none"` (every ButtonGroup child, and
 * `outlined` is the group default) removes the sink: with a dead shadow step
 * next to it, an outlined button reported a press with nothing at all on any
 * pointer-less path.
 */
const PRESS_URL = '/test-fixtures/primitives';
const PRESSABLE = ['Primary', 'Outlined', 'Ghost', 'Text'] as const;

test.describe('Press cue resolves to a visible step', () => {
  for (const label of PRESSABLE) {
    test(`${label} button: a press changes depth or fill`, async ({ page }) => {
      await page.goto(PRESS_URL, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="vr-button"]');

      const button = page.getByRole('button', { name: label, exact: true });
      const paint = () =>
        button.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { shadow: cs.boxShadow, fill: cs.backgroundColor };
        });

      const rest = await paint();
      await button.hover();
      const hovered = await paint();
      await page.mouse.down();
      const pressed = await paint();
      await page.mouse.up();

      // Depth OR fill: `filled` reports a press by darkening its fill and leaves
      // the shadow where it rests, which is legible and deliberate. The flat
      // variants have no fill, so for them the shadow is the whole signal.
      // Touch and keyboard never pass through hover, so rest → pressed is the
      // comparison most presses actually show.
      expect(
        `${pressed.shadow}|${pressed.fill}`,
        `${label}: a press changes neither the box-shadow nor the fill — it reports nothing ` +
          `on any path that does not pass through hover.`
      ).not.toEqual(`${rest.shadow}|${rest.fill}`);

      expect(
        `${pressed.shadow}|${pressed.fill}`,
        `${label}: a press looks exactly like a hover.`
      ).not.toEqual(`${hovered.shadow}|${hovered.fill}`);
    });
  }
});

test.describe('Press sink resolves, and mint="none" flattens it', () => {
  test('a plain button sinks on press', async ({ page }) => {
    await page.goto(PRESS_URL, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="vr-button"]');

    const button = page.getByRole('button', { name: 'Primary', exact: true });
    await button.hover();
    await page.mouse.down();
    const pressed = await button.evaluate((el) => getComputedStyle(el).scale);
    await page.mouse.up();

    // `scale: var(--blocks-press-scale)` resolving to the token's 0.98. A typo in
    // the variable name would resolve to nothing and compute as `none` — the
    // failure mode no lint catches, since the reference is inside an arbitrary
    // value.
    expect(pressed, 'the press sink does not resolve — check the token name').toBe('0.98');
  });

  test('a ButtonGroup child does not — its mint is off', async ({ page }) => {
    await page.goto('/blocks/primitives/button-group', { waitUntil: 'load' });
    // Scoped to the preview stage: the configurator's own Tier knob is a
    // `role="radiogroup"` too, so a bare `.first()` would depend on the page
    // putting the preview above the controls.
    const group = page
      .locator('[data-docs-stage="playground"]')
      .locator('[role="radiogroup"], [role="group"]')
      .first();
    await group.waitFor();

    // By tag, not by role: the playground group is a radiogroup by default, so
    // its children carry `role="radio"` rather than `button`.
    const button = group.locator('button').first();
    await button.waitFor();
    await button.hover();
    await page.mouse.down();
    // Past the 150ms scale transition: this page, unlike the fixture above, has
    // motion on. Reading mid-flight would still catch a broken flatten (the value
    // is on its way to 0.98 and not 1), just with a less legible number.
    await page.waitForTimeout(300);
    const pressed = await button.evaluate((el) => getComputedStyle(el).scale);
    await page.mouse.up();

    // Button flattens the token on itself with an arbitrary-property utility
    // (`[--blocks-press-scale:1]`) written in Button.svelte, NOT in a tv() config
    // — so `variants:lint` never sees it and this is the only check that it
    // compiles to a rule at all.
    expect(pressed, 'mint="none" did not flatten the sink — did the utility compile?').toBe('1');
  });
});

const URL = '/test-fixtures/interaction';
const GROUPS = ['field', 'choice', 'nav', 'action'] as const;
const SCHEMES = ['light', 'dark'] as const;
const THEMES = ['library', 'rooms'] as const;

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent']);

type Probe = {
  label: string;
  rest: string;
  hover: string;
  backdrop: string;
};

/**
 * Read, for every element with a hover background utility, its own resolved
 * background plus the nearest non-transparent one behind it. Runs once per
 * state; the caller pairs the two passes up by index (the fixture is static,
 * so the element order is stable).
 */
const PROBE = (testId: string) => `
  (() => {
    const host = document.querySelector('[data-testid="${testId}"]');
    if (!host) return [];
    const els = [...host.querySelectorAll('[class*="hover:bg-"]')].filter((el) => {
      // A selected element legitimately pins its own background — an active
      // Tab trigger carries \`data-[state=active]:bg-surface-base\` so it reads
      // as a continuation of the panel below it, and must NOT light up on
      // hover. Its hover utility being inert is the design, not a defect.
      if (el.matches('[data-state="active"], [aria-selected="true"], [aria-current]')) return false;
      // \`hover:bg-transparent\` is an explicit "no fill on hover" (Button's
      // \`text\` variant answers hover with colour, not a surface). Asserting a
      // visible fill there would be asserting against the design.
      if ([...el.classList].some((c) => c.endsWith('hover:bg-transparent'))) return false;
      return true;
    });
    const backdropOf = (el) => {
      let p = el.parentElement;
      while (p) {
        const bg = getComputedStyle(p).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        p = p.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    return els.map((el) => ({
      // Enough to point a human at the offending element without depending on
      // generated ids: the tag, the hover utilities it carries, and its text.
      label: el.tagName.toLowerCase() + ' [' +
        [...el.classList].filter((c) => c.includes('hover:bg-')).join(' ') + ']' +
        (el.textContent ? ' "' + el.textContent.trim().slice(0, 24) + '"' : ''),
      bg: getComputedStyle(el).backgroundColor,
      backdrop: backdropOf(el)
    }));
  })()
`;

test.use({ channel: 'chromium' });

test.describe('Hover fills resolve to a visible colour', () => {
  for (const scheme of SCHEMES) {
    for (const theme of THEMES) {
      test(`${scheme} · ${theme}`, async ({ page }) => {
        page.on('pageerror', (err) => {
          throw new Error(`Uncaught page error: ${err.message}`);
        });

        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(URL, { waitUntil: 'load' });
        await page.waitForSelector('[data-testid="interaction-fixtures"]');
        await page.evaluate((rooms) => {
          document.documentElement.classList.toggle('docs-rooms', rooms);
        }, theme === 'rooms');
        await page.evaluate(() => document.fonts.ready);

        const cdp = await openCdp(page);
        try {
          for (const group of GROUPS) {
            const testId = `vr-ix-${group}`;

            const rest = (await page.evaluate(PROBE(testId))) as { bg: string; label: string }[];
            expect(
              rest.length,
              `no hover-fill elements found in ${testId} — this gate would be a silent no-op`
            ).toBeGreaterThan(0);

            await forceWithin(cdp, testId, ['hover']);
            const hovered = (await page.evaluate(PROBE(testId))) as {
              bg: string;
              backdrop: string;
              label: string;
            }[];
            await forceWithin(cdp, testId, []);

            const probes: Probe[] = hovered.map((h, i) => ({
              label: h.label,
              rest: rest[i].bg,
              hover: h.bg,
              backdrop: h.backdrop
            }));

            for (const p of probes) {
              // Soft, so one run reports every offending element instead of
              // stopping at the first — a hard expect here hid three findings
              // behind one while this suite was being built.
              expect
                .soft(
                  p.hover,
                  `${group}: hover fill does not resolve — background is unchanged from rest ` +
                    `(${p.rest}). The utility is dead or shadowed.\n    ${p.label}`
                )
                .not.toEqual(p.rest);

              // The load-bearing one. A fill equal to its backdrop is no fill.
              expect
                .soft(
                  TRANSPARENT.has(p.hover) ? p.backdrop : p.hover,
                  `${group}: hover fill is invisible — it resolves to ${p.hover}, which is ` +
                    `exactly what is behind it. Use an interaction step ` +
                    `(surface-hover / surface-interactive-hover / an intent's -hover rung), ` +
                    `not a resting surface.\n    ${p.label}`
                )
                .not.toEqual(p.backdrop);
            }
          }
        } finally {
          await cdp.detach();
        }
      });
    }
  }
});
