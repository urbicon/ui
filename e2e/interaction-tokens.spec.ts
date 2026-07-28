import { expect, test } from '@playwright/test';
import { force, nodeIdsWithin, openCdp } from './helpers/force-state';

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
            const nodeIds = await nodeIdsWithin(cdp, testId);

            const rest = (await page.evaluate(PROBE(testId))) as { bg: string; label: string }[];
            expect(
              rest.length,
              `no hover-fill elements found in ${testId} — this gate would be a silent no-op`
            ).toBeGreaterThan(0);

            await force(cdp, nodeIds, ['hover']);
            const hovered = (await page.evaluate(PROBE(testId))) as {
              bg: string;
              backdrop: string;
              label: string;
            }[];
            await force(cdp, nodeIds, []);

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
