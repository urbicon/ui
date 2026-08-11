import { expect, type Page, test } from '@playwright/test';

/**
 * The docs shell's geometry, measured against the tokens that define it.
 *
 * WHY THIS IS NOT A SCREENSHOT. The defect this suite exists for is a geometric
 * one: on 2026-08-07 the reading measure was capped on `section` while `main`
 * stayed `flex-1 max-w-none`, so `main` swallowed every pixel the table of
 * contents did not take and the difference became a corridor of nothing — 208px
 * at 1440, 568px at 1920 — with the API table scrolling sideways inside 736px
 * right beside it. A pixel baseline would have gone red and said "something
 * moved"; these assertions say "the corridor is 208px where the token says 64".
 *
 * It also costs nothing to keep: no baseline, so nothing to regenerate, nothing
 * that drifts on font rasterisation, and no host or architecture to pin. That is
 * why it runs in CI while the `@pixel` suite needs a container to be meaningful
 * — the two cover different things and neither replaces the other. Colour,
 * shadow, type and z-order remain the screenshots' job.
 *
 * WHY IT READS THE TOKENS. Every expected number is measured from the custom
 * property that produces it (`--docs-column`, `--docs-gutter`, `--docs-rail-gap`,
 * `--docs-measure`), never written out here. A spec with its own copy of "60rem"
 * passes happily after someone retunes the layout and changes nothing else —
 * it would assert that the old design is still implemented. Reading the token
 * asserts the only thing that stays true across a retune: that the rendered box
 * is the one the token asked for.
 *
 * Tokens are resolved through a probe element rather than by parsing the
 * declaration: `getComputedStyle().getPropertyValue()` hands back the specified
 * text ("60rem"), and converting that here would bake in an assumption about the
 * root font size. A div sized `width: var(--token)` is measured by the same
 * engine that lays out the page.
 */

// A component page: two columns, a table of contents, an API table wide enough
// to reach the exhibit edge, and prose narrow enough to sit at the measure.
const URL = '/blocks/primitives/button';

// The lg breakpoint (64rem) is where the app sidebar and the TOC rail appear and
// where `--docs-gutter` steps up. Three widths, one on each side of it plus one
// wide enough that the shell hits its cap and centres:
//
//   1600 — shell capped, wrapper centred inside the content area
//   1200 — above lg, shell fills the content area (no centring margin)
//    820 — below lg: no sidebar, no TOC rail, narrow gutter
const WIDTHS = { capped: 1600, filled: 1200, narrow: 820 } as const;

type Box = { x: number; right: number; width: number };
type Geometry = {
  tokens: { column: number; gutter: number; railGap: number; measure: number };
  wrapper: Box;
  section: Box;
  prose: Box;
  h1x: number;
  crumbX: number;
  tocVisible: boolean;
  toc: Box | null;
  pageOverflow: number;
};

async function setup(page: Page, width: number) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-docs-header] h1');
  // The measure and the prose scale come from the rooms skin; the self-hosted
  // faces decide how wide a paragraph's line boxes are, so a shot taken before
  // they land measures the fallback font's layout.
  await page.evaluate(() => document.fonts.ready);
}

async function measure(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), right: Math.round(r.right), width: Math.round(r.width) };
    };

    const section = document.querySelector('#main-content section:not(#playground)');
    if (!section) throw new Error('no content section on the page');

    // The TOC aside is a direct child of DocsLayout's `wrapper`, which carries
    // the shell cap and both gutters. It stays in the DOM below lg (hidden, not
    // removed), so this resolves at every width.
    const toc = document.querySelector('#main-content aside[aria-label]');
    if (!toc) throw new Error('no table-of-contents aside — page has no sidebar layout');
    const wrapper = toc.parentElement;
    if (!wrapper) throw new Error('TOC aside has no wrapper parent');

    // Body copy, not a caption or a stage label: long enough to have wrapped, and
    // outside any stage, which owns its own inner width.
    const prose = [...document.querySelectorAll('#main-content section:not(#playground) p')].find(
      (p) => (p.textContent ?? '').trim().length > 80 && !p.closest('[data-docs-stage]')
    );
    if (!prose) throw new Error('no body paragraph found on the page');

    // Resolve each token by laying it out, not by parsing its declaration. The
    // probe sits inside the wrapper so it inherits the same cascade the real
    // boxes do — including the responsive step on `--docs-gutter`.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:0';
    wrapper.appendChild(probe);
    const resolve = (token: string) => {
      probe.style.width = `var(${token})`;
      return probe.getBoundingClientRect().width;
    };
    const tokens = {
      column: resolve('--docs-column'),
      gutter: resolve('--docs-gutter'),
      railGap: resolve('--docs-rail-gap'),
      measure: resolve('--docs-measure')
    };
    probe.remove();

    const h1 = document.querySelector('[data-docs-header] h1');
    const crumb = document.querySelector('[data-docs-sticky-bar] nav');
    if (!h1 || !crumb) throw new Error('page header or breadcrumb missing');

    const doc = document.documentElement;
    return {
      tokens,
      wrapper: box(wrapper),
      section: box(section),
      prose: box(prose),
      h1x: Math.round(h1.getBoundingClientRect().x),
      crumbX: Math.round(crumb.getBoundingClientRect().x),
      tocVisible: getComputedStyle(toc).display !== 'none',
      toc: getComputedStyle(toc).display !== 'none' ? box(toc) : null,
      pageOverflow: doc.scrollWidth - doc.clientWidth
    };
  });
}

// Sub-pixel layout rounds differently per box; 1px of slack keeps that from
// reading as a defect without hiding one (the failures this guards against are
// tens to hundreds of pixels).
const SLACK = 1;

test.describe('Docs layout geometry', () => {
  for (const [name, width] of Object.entries(WIDTHS)) {
    test(`${name} (${width}px): prose and exhibits sit on their own edges`, async ({ page }) => {
      await setup(page, width);
      const g = await measure(page);

      // The exhibit edge. `section` is the box a table, a code panel or a stage
      // fills; it may be squeezed narrower than the token when the viewport is,
      // but it must never exceed it.
      expect(g.section.width).toBeLessThanOrEqual(g.tokens.column + SLACK);

      // The reading edge, inside the exhibit edge. Equal to the measure when
      // there is room for it, squeezed with the column when there is not.
      expect(g.prose.width).toBeLessThanOrEqual(g.tokens.measure + SLACK);
      expect(g.prose.width).toBeCloseTo(Math.min(g.tokens.measure, g.section.width), -0.5);

      // Nothing may push the page itself sideways. This is the symptom a reader
      // notices first, and the one the old `section` cap produced.
      expect(g.pageOverflow).toBe(0);
    });

    test(`${name} (${width}px): the title, the breadcrumb and the body share one left edge`, async ({
      page
    }) => {
      await setup(page, width);
      const g = await measure(page);

      // `wrapper`, `headerInner` and `stickyBarInner` centre their border box in
      // the same parent with the same cap and the same gutter. That is the only
      // reason these three land together, and it is invisible in a unit test of
      // any one slot — change one of the three and this is what catches it.
      expect(g.h1x).toBeCloseTo(g.prose.x, -0.5);
      expect(g.crumbX).toBeCloseTo(g.prose.x, -0.5);

      // The gutter is measured against the WRAPPER, not the viewport: above the
      // shell cap the wrapper is centred, so its distance from the sidebar is a
      // centring margin plus the gutter, and only the inner distance is the
      // token's business.
      expect(g.section.x - g.wrapper.x).toBeCloseTo(g.tokens.gutter, -0.5);
    });
  }

  test(`${WIDTHS.capped}px: the TOC docks to the exhibit edge, one rail-gap away`, async ({
    page
  }) => {
    await setup(page, WIDTHS.capped);
    const g = await measure(page);

    expect(g.tocVisible).toBe(true);
    if (!g.toc) throw new Error('TOC reported visible but has no box');

    // The two edges are actually two. `section.width <= column` alone is not
    // enough and was green through the whole regression: a section capped at the
    // measure satisfies it just as well as one filling the column. At this width
    // there is demonstrably room for both edges, so the exhibit edge has to be
    // the wider of them — which is the entire design, and the single assertion
    // that fails if someone caps `section` at the measure again.
    expect(g.section.width).toBeGreaterThan(g.tokens.measure);

    // THE regression this file was written for. The corridor between the exhibit
    // edge and the rail is the rail-gap and nothing else — it must not grow with
    // the viewport, which is exactly what it did when `main` was `max-w-none`.
    expect(g.toc.x - g.section.right).toBeCloseTo(g.tokens.railGap, -0.5);

    // And the far side: the rail keeps the same gutter from the wrapper's edge
    // that the body keeps on the left, so the two columns sit in a symmetric box.
    expect(g.wrapper.right - g.toc.right).toBeCloseTo(g.tokens.gutter, -0.5);
  });

  test(`${WIDTHS.narrow}px: the rail is gone and the body keeps the narrow gutter`, async ({
    page
  }) => {
    await setup(page, WIDTHS.narrow);
    const g = await measure(page);

    // Below lg the rail hides and `--docs-gutter` steps down. Asserting the step
    // rather than a number keeps this true if either value is retuned; asserting
    // that it IS smaller is what proves the responsive declaration still applies
    // at all, which a bare token read would not.
    expect(g.tocVisible).toBe(false);
    expect(g.section.x - g.wrapper.x).toBeCloseTo(g.tokens.gutter, -0.5);
  });

  test('the gutter steps up at the lg breakpoint', async ({ page }) => {
    // Two viewports, one assertion: the responsive `lg:[--docs-gutter:…]` is a
    // declaration that can be dropped without any single-width test noticing —
    // each would still find the box matching whatever the token then said.
    await setup(page, WIDTHS.narrow);
    const narrow = await measure(page);
    await setup(page, WIDTHS.filled);
    const wide = await measure(page);

    expect(wide.tokens.gutter).toBeGreaterThan(narrow.tokens.gutter);
  });
});

/**
 * Anchor jumps land clear of the pinned chrome.
 *
 * The defect: a table-of-contents link scrolled its section to the very top of
 * the viewport, where the pinned breadcrumb strip covered the heading. It had
 * gone unnoticed because the strip's height existed only as a rendered
 * consequence of its padding — five places in the repo carried a hand-guessed
 * copy of it and all five disagreed.
 *
 * Why this belongs here and not in a unit test: the fix is a chain across three
 * files that no single one of them can see. `docslayout.variants` declares the
 * height and derives `--docs-anchor-offset`; the strip's markup turns that
 * number into its real height with `min-h-`; `section.variants` reads the offset
 * as `scroll-mt`. Unit tests over the tv configs assert the two ends and cannot
 * see the middle — delete the `min-h-` and the row collapses to `height: auto`
 * with every one of them still green. The browser is the only thing that knows
 * whether the heading is visible, so it is what gets asked.
 *
 * The assertion is a relation, never a number: the section's top edge against
 * the bottom of whatever is actually pinned at that width. Below `lg` that is
 * the mobile header plus the strip stacked on it, above `lg` the strip alone —
 * no viewport-specific constant needed, and a retune of either moves both sides
 * of the comparison together.
 */
test.describe('Anchor jumps clear the pinned chrome', () => {
  for (const [name, width] of Object.entries(WIDTHS)) {
    test(`${name} (${width}px): every in-page target lands below the pinned chrome`, async ({
      page
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(URL);
      // `scroll-behavior: smooth` is set site-wide; without this a click has to
      // be waited out rather than measured, and the wait is what would flake.
      await page.addStyleTag({ content: 'html, * { scroll-behavior: auto !important; }' });

      const ids: string[] = await page.evaluate(() => {
        const pinned = [...document.querySelectorAll('body *')].filter((el) => {
          const p = getComputedStyle(el).position;
          return p === 'sticky' || p === 'fixed';
        });
        return [...document.querySelectorAll('a[href^="#"]')]
          .map((a) => a.getAttribute('href')!.slice(1))
          .filter((id, i, all) => id && all.indexOf(id) === i)
          .filter((id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            // Skip the skip-link's target. It is the content landmark, which
            // CONTAINS the pinned chrome, so its top edge sits above the strip
            // by construction — and a skip link moves focus rather than
            // clearing a heading, so there is nothing here for it to honour.
            return !pinned.some((p) => el.contains(p));
          });
      });
      expect(ids.length, 'the page under test has in-page anchors').toBeGreaterThan(0);

      for (const id of ids) {
        await page.evaluate(() => window.scrollTo(0, 0));
        // A real click on the real anchor: the browser applies `scroll-margin`
        // itself, so this exercises the contract rather than re-implementing it.
        // The rail is `display:none` below lg — the default action still fires,
        // and it is the same jump the strip's popover link performs.
        await page.evaluate(
          (i) => document.querySelector<HTMLElement>(`a[href="#${i}"]`)?.click(),
          id
        );
        await page.waitForFunction(() => {
          const y = window.scrollY;
          const settled = (window as unknown as { __y?: number }).__y === y;
          (window as unknown as { __y?: number }).__y = y;
          return settled;
        });

        const landing = await page.evaluate((i) => {
          const target = document.getElementById(i)!;
          // Whatever is pinned across the top at this width, found by asking
          // the layout rather than by naming the elements: full-width, stuck to
          // the upper edge, and actually painted. Below lg two of them stack.
          const pinned = [...document.querySelectorAll('body *')]
            .filter((el) => {
              const cs = getComputedStyle(el);
              if (cs.position !== 'sticky' && cs.position !== 'fixed') return false;
              const r = el.getBoundingClientRect();
              return (
                r.height > 0 &&
                r.width > window.innerWidth * 0.5 &&
                r.top <= window.innerHeight * 0.25 &&
                cs.visibility !== 'hidden'
              );
            })
            .map((el) => el.getBoundingClientRect().bottom);
          const maxY = document.documentElement.scrollHeight - window.innerHeight;
          return {
            clearance: Math.round(
              target.getBoundingClientRect().top - (pinned.length ? Math.max(...pinned) : 0)
            ),
            // The last section cannot honour the offset — the page runs out of
            // height to scroll. Nothing is covered there either, so it is not a
            // failure; excluding it keeps the assertion exact for the rest.
            atPageEnd: Math.abs(window.scrollY - maxY) < 2
          };
        }, id);

        if (landing.atPageEnd) continue;
        // A range, not `toBe(0)`: the strip's real height carries a subpixel
        // fraction, so a perfect landing rounds to -0 as often as to 0 — and
        // `toBe(0)` rejects -0, which is a fact about `Object.is`, not about
        // whether the reader can see the heading. The two bounds are the whole
        // contract: nothing of the section hides behind the chrome, and it does
        // not stop a visible gap below it either (the breathing room is
        // `Section`'s own `mt-8`, inside the box being measured).
        expect(
          landing.clearance,
          `#${id} landed ${-landing.clearance}px under the pinned chrome`
        ).toBeGreaterThanOrEqual(0);
        expect(
          landing.clearance,
          `#${id} stopped ${landing.clearance}px below the chrome instead of against it`
        ).toBeLessThan(4);
      }
    });
  }
});
