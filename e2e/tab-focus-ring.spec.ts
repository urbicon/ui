import { expect, test } from '@playwright/test';
import { forceWithin, openCdp } from './helpers/force-state';

/**
 * A scroll container must not clip its children's focus ring.
 *
 * The defect this guards, found on Tab: `orientation="horizontal"` makes the
 * tab list a scroll container (`overflow-x-auto`, so a long strip can scroll),
 * and a scroll container clips at its PADDING box. The trigger's ring is drawn
 * OUTSIDE its border box, so with the trigger flush against that padding box
 * the ring is cut off top and bottom — measured on `line` and `enclosed`: 0px
 * of room for a ring reaching 4px. Half a keyboard focus indicator is a WCAG
 * 2.4.11 failure, and it shipped, because nothing looked: the DOM suites cannot
 * measure layout and the pixel suite that DID show it was excluded from CI.
 *
 * It is written over a LIST of containers rather than over Tab alone because
 * the shape recurs — Scroller already documents the same 4px and the reason for
 * it (scroller.variants.ts), and Toolbar is the third. A new horizontal scroll
 * container belongs in `PROBES` with a fixture beside it.
 *
 * Why the numbers come from the page rather than from here: `reach` is read off
 * the child's own computed `box-shadow`, so retuning `ring-offset-2` to
 * something wider makes this test demand the extra room by itself. A hardcoded
 * 4 would silently stop matching the ring it is supposed to protect.
 *
 * The `reach > 0` assertion is not decoration. Without it the whole spec passes
 * when the ring is gone entirely — room ≥ 0 holds trivially — which is the exact
 * shape of a guard that stays green for the wrong reason.
 */

const URL = '/test-fixtures/tabs';
const TAB_VARIANTS = ['line', 'pills', 'enclosed', 'solid'] as const;
const TOOLBAR_PADDINGS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/** `host` is the fixture wrapper; `container` scrolls, `child` carries the ring. */
const PROBES = [
  ...TAB_VARIANTS.map((v) => ({
    name: `tab · ${v}`,
    host: `${v}-horizontal`,
    container: '[role="tablist"]',
    child: '[role="tab"]'
  })),
  ...TOOLBAR_PADDINGS.map((p) => ({
    name: `toolbar · padding ${p}`,
    host: `toolbar-${p}`,
    container: '[role="toolbar"]',
    child: 'button'
  }))
];

test.use({ channel: 'chromium' });

/**
 * `networkidle` is doing real work here, not padding a timeout. The web server
 * is a DEV server, so Vite optimises a route's dependencies on its FIRST visit
 * and hard-reloads the page when it finishes — which destroys every execution
 * context and CDP node id opened before it, reported as the unhelpful
 * "Execution context was destroyed, most likely because of a navigation".
 *
 * That makes it a deterministic first-run failure rather than a flake: it hits
 * whichever spec reaches a new route first, and CI's `retries: 2` then hides it
 * by passing on attempt two. Waiting for the network to go quiet lets the
 * reload happen BEFORE the session is opened.
 */
async function open(page: Parameters<typeof openCdp>[0]) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="tab-fixtures"]');
}

test('horizontal scroll containers leave room for their focus ring', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.fonts.ready);

  const cdp = await openCdp(page);
  try {
    await forceWithin(cdp, 'tab-fixtures', ['focus', 'focus-visible']);

    for (const probe of PROBES) {
      const g = await page.evaluate((p) => {
        const host = document.querySelector(`[data-probe="${p.host}"]`);
        if (!host) throw new Error(`no fixture for ${p.host}`);
        const container = host.querySelector(p.container) as HTMLElement;
        const child = container.querySelector(p.child) as HTMLElement;

        // The ring is a stack of spread-only shadows; its outer edge is the
        // largest spread radius. Tailwind emits `<x> <y> <blur> <spread>` per
        // layer, and the layers are comma-separated — but colours can contain
        // commas too (`oklab(… / .5)`), so split on commas OUTSIDE parens.
        const layers = getComputedStyle(child).boxShadow.split(/,(?![^(]*\))/);
        const reach = Math.max(
          0,
          ...layers.map((layer) => {
            const lengths = layer.match(/-?\d*\.?\d+px/g) ?? [];
            return lengths.length >= 4 ? Number.parseFloat(lengths[3]) : 0;
          })
        );

        const box = container.getBoundingClientRect();
        const cs = getComputedStyle(container);
        const border = (side: 'Top' | 'Bottom') =>
          Number.parseFloat(cs[`border${side}Width` as 'borderTopWidth']);
        const childBox = child.getBoundingClientRect();

        return {
          reach,
          // Distance from the child's border box to the clip edge, which is the
          // container's padding box — inside its own border.
          roomTop: childBox.top - (box.top + border('Top')),
          roomBottom: box.bottom - border('Bottom') - childBox.bottom,
          overflowY: cs.overflowY
        };
      }, probe);

      expect(
        g.reach,
        `${probe.name}: no ring to protect — the rest of this test would pass vacuously`
      ).toBeGreaterThan(0);

      // `visible` means nothing clips, so the room is irrelevant. Stating the
      // invariant this way tracks the defect rather than one particular remedy:
      // dropping the scroll container is also a valid fix.
      if (g.overflowY === 'visible') continue;

      expect(g.roomTop, `${probe.name}: ring clipped at the top`).toBeGreaterThanOrEqual(g.reach);
      expect(g.roomBottom, `${probe.name}: ring clipped at the bottom`).toBeGreaterThanOrEqual(
        g.reach
      );
    }
  } finally {
    await cdp.detach();
  }
});

test('the vertical tab strip clips nothing', async ({ page }) => {
  // Documents why the fix is gated on `orientation`: this axis has no scroll
  // container, so the ring is free and the strip pays no padding for it. If
  // that ever changes, the spec above needs a vertical twin rather than a
  // silently-passing one.
  await open(page);

  for (const variant of TAB_VARIANTS) {
    const overflow = await page.evaluate((probe) => {
      const list = document.querySelector(
        `[data-probe="${probe}"] [role="tablist"]`
      ) as HTMLElement;
      const cs = getComputedStyle(list);
      return { x: cs.overflowX, y: cs.overflowY };
    }, `${variant}-vertical`);

    expect(overflow, `${variant} vertical`).toEqual({ x: 'visible', y: 'visible' });
  }
});
