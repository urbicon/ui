import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * A CompositionBar segment's tooltip and focus ring reach past the bar, so
 * nothing between the segment and the page may clip them, and the bar's round
 * ends have to come from something other than a clip. jsdom computes no
 * layout, so this is where it is measured.
 *
 * Each check asks the browser for what a user gets rather than for the
 * mechanism, so it holds whichever way the bar is built:
 *
 * - a tooltip is visible where `elementFromPoint` at its centre returns it. Hit
 *   testing honours every clip; the tooltip is `pointer-events: none`, so the
 *   probe lifts that for the one call.
 * - a focus ring is visible where the pixels just outside the segment change
 *   when it takes focus. Sampled across the bar's thickness, where no
 *   neighbouring segment's dimming lands.
 * - an end is round where the pixel in the bar's corner is not a segment's
 *   fill, and an inner join is square where the pixels beside it are.
 * - a tooltip shows where its opacity is above 0, and the count runs over every
 *   tooltip on the page, so one that opens beside the right one is seen too.
 * - a part takes its share where its length along the bar matches the percent
 *   its name states, or for the rest the share the fixture computes from the
 *   probe's numbers (`data-rest-share`).
 *
 * The probes on the fixture cover what decides which element is first or last:
 * an item worth 0 renders no segment, a `total` above the sum appends the
 * dashed rest, `orientation`, a right-to-left row, and a consumer's radius on
 * the `bar` slot. One probe sits in a consumer element with Tailwind's unnamed
 * `group` class, which a `group-*:` variant inside the bar would also match.
 */

const URL = '/test-fixtures/composition-bar';

/** Max per-channel distance below which two pixels count as the same paint. */
const SAME = 24;

// See tab-focus-ring.spec.ts: the dev server optimises a route's dependencies
// on its first visit and reloads the page, destroying any handle taken before.
async function open(page: Page) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  await page.getByTestId('composition-bar-fixtures').waitFor();
}

async function probeIds(page: Page): Promise<string[]> {
  return page.$$eval('[data-probe]', (els) => els.map((el) => el.getAttribute('data-probe') ?? ''));
}

function barOf(page: Page, id: string): Locator {
  return page.locator(`[data-probe="${id}"] [role="group"]`);
}

/** RGB of the pixels at viewport points, read off one screenshot of `clip`. */
async function pixels(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  points: Array<[number, number]>
): Promise<number[][]> {
  const png = await page.screenshot({ clip, scale: 'css', animations: 'disabled' });
  return page.evaluate(
    async ({ b64, origin, at }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      return at.map(([x, y]) =>
        Array.from(
          ctx.getImageData(Math.floor(x - origin.x), Math.floor(y - origin.y), 1, 1).data
        ).slice(0, 3)
      );
    },
    { b64: png.toString('base64'), origin: clip, at: points }
  );
}

const distance = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

/** The clip around a bar with room for the ring outside it. */
async function around(bar: Locator) {
  const box = await bar.boundingBox();
  if (!box) throw new Error('bar not rendered');
  return {
    x: Math.floor(box.x) - 8,
    y: Math.floor(box.y) - 8,
    width: Math.ceil(box.width) + 16,
    height: Math.ceil(box.height) + 16
  };
}

/**
 * Where a segment's tooltip is, and whether it can be seen. Found by its text
 * among the bar's hidden elements, not by its place in the tree.
 */
async function tooltipOf(segment: Locator) {
  return segment.evaluate((seg) => {
    const label = (seg.getAttribute('aria-label') ?? '').split(':')[0];
    const bar = seg.closest('[role="group"]');
    const tip = Array.from(bar?.querySelectorAll<HTMLElement>('[aria-hidden="true"]') ?? []).find(
      (el) => el.textContent?.trim().startsWith(label)
    );
    if (!tip) return null;
    tip.style.pointerEvents = 'auto';
    const t = tip.getBoundingClientRect();
    const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
    tip.style.pointerEvents = '';
    const s = seg.getBoundingClientRect();
    return {
      opacity: getComputedStyle(tip).opacity,
      reached: hit !== null && tip.contains(hit),
      inViewport: t.top >= 0 && t.left >= 0 && t.bottom <= innerHeight && t.right <= innerWidth,
      above: t.bottom <= s.top,
      left: t.right <= s.left,
      right: t.left >= s.right,
      offCentreX: Math.abs(t.left + t.width / 2 - (s.left + s.width / 2)),
      offCentreY: Math.abs(t.top + t.height / 2 - (s.top + s.height / 2)),
      rtl: getComputedStyle(seg).direction === 'rtl'
    };
  });
}

type Tip = NonNullable<Awaited<ReturnType<typeof tooltipOf>>>;

/** Every segment tooltip on the page that shows, as `probe · segment name`. */
async function shownTooltips(page: Page): Promise<string[]> {
  return page.$$eval('[data-composition-segment]', (segments) =>
    segments.flatMap((seg) => {
      const name = seg.getAttribute('aria-label') ?? '';
      const where = `${seg.closest('[data-probe]')?.getAttribute('data-probe')} · ${name}`;
      const label = name.split(':')[0];
      const bar = seg.closest('[role="group"]');
      const tip = Array.from(bar?.querySelectorAll<HTMLElement>('[aria-hidden="true"]') ?? []).find(
        (el) => el.textContent?.trim().startsWith(label)
      );
      if (!tip) return [`${where} (no tooltip found)`];
      return Number(getComputedStyle(tip).opacity) > 0 ? [where] : [];
    })
  );
}

function expectShownBesideSegment(tip: Tip | null, where: string, vertical: boolean) {
  expect(tip, `${where}: no tooltip found`).not.toBeNull();
  const t = tip as Tip;
  expect.soft(t.opacity, `${where}: tooltip not shown`).toBe('1');
  expect.soft(t.reached, `${where}: tooltip clipped — its centre hits something else`).toBe(true);
  expect.soft(t.inViewport, `${where}: tooltip outside the viewport`).toBe(true);
  if (vertical) {
    // Beside the bar on the inline-start side, centred on the segment.
    expect
      .soft(t.rtl ? t.right : t.left, `${where}: tooltip not on the inline-start side`)
      .toBe(true);
    expect
      .soft(t.offCentreY, `${where}: tooltip not centred on the segment`)
      .toBeLessThanOrEqual(1);
  } else {
    expect.soft(t.above, `${where}: tooltip not above the segment`).toBe(true);
    expect
      .soft(t.offCentreX, `${where}: tooltip not centred on the segment`)
      .toBeLessThanOrEqual(1);
  }
}

async function isVertical(bar: Locator) {
  return bar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.height > r.width;
  });
}

test.describe('CompositionBar clips nothing it shows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('hovering a segment shows its tooltip beside it, unclipped', async ({ page }) => {
    await open(page);
    let probed = 0;
    for (const id of await probeIds(page)) {
      const bar = barOf(page, id);
      const vertical = await isVertical(bar);
      for (const segment of await bar.locator('[data-composition-segment]').all()) {
        await segment.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await segment.hover();
        expectShownBesideSegment(
          await tooltipOf(segment),
          `${id} · ${await segment.getAttribute('aria-label')}`,
          vertical
        );
        probed++;
      }
    }
    expect(probed, 'no segment was probed').toBeGreaterThan(0);
  });

  test('a segment focused by keyboard shows its tooltip and its whole ring', async ({ page }) => {
    await open(page);
    let probed = 0;
    for (const id of await probeIds(page)) {
      const bar = barOf(page, id);
      const segments = await bar.locator('[data-composition-segment]').all();
      if (segments.length === 0) continue;
      const vertical = await isVertical(bar);
      await page.mouse.move(0, 0);
      await bar.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const clip = await around(bar);

      // The ring band runs 2-4px outside the segment (ring-offset-2, ring-2).
      // Across the bar's thickness that band lies over the page, never over a
      // neighbouring segment.
      const band = async (segment: Locator): Promise<Array<[number, number]>> => {
        const s = await segment.boundingBox();
        if (!s) throw new Error(`${id}: segment not rendered`);
        return vertical
          ? [
              [s.x - 3, s.y + s.height / 2],
              [s.x + s.width + 3, s.y + s.height / 2]
            ]
          : [
              [s.x + s.width / 2, s.y - 3],
              [s.x + s.width / 2, s.y + s.height + 3]
            ];
      };
      const atRest: number[][][] = [];
      for (const segment of segments) atRest.push(await pixels(page, clip, await band(segment)));

      // A key press first, so the focus that follows counts as keyboard focus.
      await page.keyboard.press('Shift');
      await segments[0].focus();
      for (const [i, segment] of segments.entries()) {
        if (i > 0) await page.keyboard.press('ArrowRight');
        const where = `${id} · ${await segment.getAttribute('aria-label')}`;
        expect(
          await segment.evaluate(
            (el) => el === document.activeElement && el.matches(':focus-visible')
          ),
          `${where}: not keyboard-focused`
        ).toBe(true);

        expectShownBesideSegment(await tooltipOf(segment), where, vertical);

        const focused = await pixels(page, clip, await band(segment));
        focused.forEach((px, side) => {
          expect
            .soft(
              distance(px, atRest[i][side]),
              `${where}: ring missing on side ${side} — the pixels outside the segment did not change`
            )
            .toBeGreaterThan(SAME);
        });
        probed++;
      }
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    }
    expect(probed, 'no segment was probed').toBeGreaterThan(0);
  });

  test("a consumer's `group` around the bar opens no tooltip but the segment's own", async ({
    page
  }) => {
    await open(page);
    const probe = page.locator('[data-probe="in-group"]');
    expect(await probe.evaluate((el) => el.classList.contains('group'))).toBe(true);
    await probe.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const segment = probe.locator('[data-composition-segment]').nth(1);
    const own = [`in-group · ${await segment.getAttribute('aria-label')}`];

    await probe.locator('p').hover();
    expect.soft(await shownTooltips(page), 'hovering the caption above the bar').toEqual([]);
    await segment.hover();
    expect.soft(await shownTooltips(page), 'hovering a segment').toEqual(own);

    await page.mouse.move(0, 0);
    await page.keyboard.press('Shift');
    const row = probe.getByRole('listitem').first().getByRole('button');
    await row.focus();
    expect(await row.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    expect.soft(await shownTooltips(page), 'a legend row focused by keyboard').toEqual([]);
    await segment.focus();
    expect(await segment.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    expect.soft(await shownTooltips(page), 'a segment focused by keyboard').toEqual(own);
  });

  test('each part takes its share of the bar, and the rest dashes the side toward the segments', async ({
    page
  }) => {
    await open(page);
    let rests = 0;
    for (const id of await probeIds(page)) {
      const r = await barOf(page, id).evaluate((bar) => {
        const sides = ['top', 'right', 'bottom', 'left'] as const;
        const width = (el: Element, side: string) =>
          Number.parseFloat(getComputedStyle(el).getPropertyValue(`border-${side}-width`));
        const b = bar.getBoundingClientRect();
        const vertical = b.height > b.width;
        const [from, to] = vertical ? (['top', 'bottom'] as const) : (['left', 'right'] as const);
        // Along the bar, without the element's own border: the rest's dashed
        // line divides it from the segments and counts toward neither share.
        const length = (el: Element) => {
          const box = el.getBoundingClientRect();
          return (vertical ? box.height : box.width) - width(el, from) - width(el, to);
        };
        const restWant = Number(bar.closest('[data-probe]')?.getAttribute('data-rest-share'));
        const parts = Array.from(bar.children, (child) => {
          const segment = child.querySelector('[data-composition-segment]');
          const name = segment?.getAttribute('aria-label') ?? 'rest';
          // A segment's name ends in the percent it stands for.
          const stated = name.match(/([\d.,]+)\s*%$/)?.[1].replace(',', '.');
          return {
            name,
            want: segment ? Number(stated) : restWant,
            share: (100 * length(child)) / length(bar)
          };
        });

        const rest = Array.from(bar.children).find(
          (child) => !child.querySelector('[data-composition-segment]')
        );
        if (!rest) return { parts, restWant, rest: null };
        const s = rest.getBoundingClientRect();
        const segment = bar.querySelector('[data-composition-segment]')?.getBoundingClientRect();
        let toward: (typeof sides)[number] | null = null;
        if (segment) {
          toward = vertical
            ? segment.top + segment.height / 2 > s.top + s.height / 2
              ? 'bottom'
              : 'top'
            : segment.left + segment.width / 2 > s.left + s.width / 2
              ? 'right'
              : 'left';
        }
        return {
          parts,
          restWant,
          rest: { dashed: sides.filter((side) => width(rest, side) > 0), toward }
        };
      });
      for (const part of r.parts) {
        expect
          .soft(
            Math.abs(part.share - part.want),
            `${id} · ${part.name}: takes ${part.share}% of the bar for ${part.want}%`
          )
          .toBeLessThanOrEqual(0.5);
      }
      expect
        .soft(r.rest !== null, `${id}: a rest renders exactly when total exceeds the sum`)
        .toBe(r.restWant > 0);
      if (!r.rest) continue;
      expect
        .soft(r.rest.dashed, `${id}: the rest's dashes are not on the side toward the segments`)
        .toEqual(r.rest.toward ? [r.rest.toward] : []);
      rests++;
    }
    expect(rests, 'no rest was probed').toBeGreaterThan(0);
  });

  /** Corner pixels against the segment fills, and the pixels beside each join. */
  async function ends(page: Page, id: string) {
    const bar = barOf(page, id);
    await page.mouse.move(0, 0);
    await bar.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const plan = await bar.evaluate((el) => {
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      const border = Number.parseFloat(cs.borderTopWidth);
      const radius = Math.min(
        Number.parseFloat(cs.borderTopLeftRadius),
        Math.min(b.width, b.height) / 2
      );
      // Halfway from the inner edge of the border to the inner curve on the
      // diagonal: outside the curve, inside where a square corner would paint.
      const inset = Math.floor(border + ((radius - border) * (1 - Math.SQRT1_2)) / 2) + 0.5;
      const corners: Array<[number, number]> = [
        [b.left + inset, b.top + inset],
        [b.right - inset, b.top + inset],
        [b.left + inset, b.bottom - inset],
        [b.right - inset, b.bottom - inset]
      ];
      const parts = Array.from(el.children, (child) =>
        child.matches('[data-composition-segment]')
          ? child
          : (child.querySelector('[data-composition-segment]') ?? child)
      );
      const isSegment = parts.map((p) => p.matches('[data-composition-segment]'));
      const horizontal = b.width > b.height;
      // On the line the joins are sampled on, clear of a value printed in the
      // segment's middle.
      const fillAt = parts.map((p): [number, number] => {
        const r = p.getBoundingClientRect();
        return horizontal
          ? [r.left + r.width / 2, b.top + border + 0.5]
          : [b.left + border + 0.5, r.top + r.height / 2];
      });
      const joins = parts.slice(1).map((next, i): [[number, number], [number, number]] => {
        const a = parts[i].getBoundingClientRect();
        const n = next.getBoundingClientRect();
        if (!horizontal) {
          const x = b.left + border + 0.5;
          return [
            [x, a.top + 1.5],
            [x, a.top - 1.5]
          ];
        }
        const forward = n.left >= a.left;
        const x = forward ? a.right : a.left;
        const y = b.top + border + 0.5;
        return [
          [x + (forward ? -1.5 : 1.5), y],
          [x + (forward ? 1.5 : -1.5), y]
        ];
      });
      return { corners, isSegment, fillAt, joins };
    });
    const clip = await around(bar);
    const colours = await pixels(page, clip, [
      ...plan.corners,
      ...plan.fillAt,
      ...plan.joins.flat()
    ]);
    const corners = colours.slice(0, 4);
    const fills = colours.slice(4, 4 + plan.fillAt.length);
    const joins = colours.slice(4 + plan.fillAt.length);
    const segmentFills = fills.filter((_, i) => plan.isSegment[i]);
    return {
      squareCorners: corners.filter((c) => segmentFills.some((f) => distance(c, f) <= SAME)).length,
      // A join side counts when it is a segment's: the rest is transparent.
      roundedJoins: plan.joins.flatMap((_, j) =>
        [j, j + 1]
          .map((part, side) => ({ part, colour: joins[j * 2 + side] }))
          .filter(
            ({ part, colour }) => plan.isSegment[part] && distance(colour, fills[part]) > SAME
          )
          .map(({ part }) => `${j}:${part}`)
      ),
      segments: segmentFills.length
    };
  }

  test("the bar's first and last rendered element give it its round ends", async ({ page }) => {
    await open(page);
    for (const id of await probeIds(page)) {
      const r = await ends(page, id);
      expect
        .soft(r.squareCorners, `${id}: a corner of the bar shows a segment's square corner`)
        .toBe(0);
      expect.soft(r.roundedJoins, `${id}: a join between two elements is rounded`).toEqual([]);
    }
  });

  test('positive control: a square end is seen as square', async ({ page }) => {
    await open(page);
    // Without this the test above passes on any oracle that never reports a
    // segment colour in a corner, a misplaced sample included.
    await page.addStyleTag({
      content:
        '[data-probe="horizontal"] [role="group"] { overflow: visible !important } ' +
        '[data-probe="horizontal"] [role="group"] * { border-radius: 0 !important }'
    });
    const r = await ends(page, 'horizontal');
    expect(r.segments).toBe(3);
    expect(r.squareCorners).toBe(4);
  });
});
