import { expect, test } from '@playwright/test';

/**
 * A button's box holds its label, and its icon keeps its size.
 *
 * What this guards, and why a class-string test cannot: the button base
 * carries no `overflow-hidden` and no `min-w-min`, and the content slot carries
 * `min-w-0` and `[&>svg]:shrink-0` — four classes whose effect is all layout.
 *
 * - A clip would make the button a scroll container, whose automatic minimum
 *   size is 0: a consumer's `min-w-0` (the one way to let a button shrink in a
 *   flex row) would then shrink it through its label, and `justify-center`
 *   would push the overflow out on BOTH sides, cutting the first glyph off.
 * - Without `min-w-0` on the content slot a truncating child never shrinks and
 *   never reaches its ellipsis.
 * - Without `shrink-0` on an svg, Chromium shrinks the icon WITH the slot once
 *   the slot may shrink — a 16px icon drawn at a fraction of its size in a box
 *   too narrow for icon + padding, which nobody can see is a padding mistake.
 * - Without a floor of its own, an unclipped flex item's automatic minimum is
 *   still `min-content` — under `whitespace-nowrap`, the label — so a
 *   `justify-between` row that would like the button narrower gets the row to
 *   overflow, never the label. That is the guard the clip's removal must not
 *   undo.
 *
 * Geometry only, no pixels. An ellipsis is a paint effect with one layout
 * footprint: Chromium ends the text's painted fragment where the ellipsis
 * starts, so `Range.getClientRects()` over the whole text gains a rect that
 * stops short of the clipper's edge. A flat cut has no such rect — the twin
 * probe without `text-overflow` is the control that proves the assertion can
 * tell the two apart.
 */

const URL = '/test-fixtures/button-overflow';

test.use({ channel: 'chromium', viewport: { width: 390, height: 800 } });

type Box = { left: number; right: number };

interface Probe {
  button: Box;
  content: Box;
  /** The label's first non-space character. */
  glyph: Box;
  /** Whatever owns `text-overflow` under the content slot, else the content slot. */
  clipper: { left: number; right: number; scrollWidth: number; clientWidth: number };
  /** Every fragment rect of the whole label text, relative to the clipper's left edge. */
  textRects: Box[];
  overflow: string;
}

function measure(page: import('@playwright/test').Page, probe: string): Promise<Probe> {
  return page.evaluate((name) => {
    const button = document.querySelector<HTMLButtonElement>(`[data-probe="${name}"]`);
    if (!button) throw new Error(`no button for probe "${name}"`);
    const content = button.querySelector<HTMLElement>(':scope > span:last-of-type');
    if (!content) throw new Error(`probe "${name}" has no content slot`);
    const clipper = content.querySelector<HTMLElement>('span') ?? content;

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent?.trim()) node = walker.nextNode();
    if (!node?.textContent) throw new Error(`probe "${name}" has no label text`);
    const start = node.textContent.search(/\S/);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 1);
    const whole = document.createRange();
    whole.selectNodeContents(node);

    const box = (r: DOMRect): Box => ({ left: r.left, right: r.right });
    const cr = clipper.getBoundingClientRect();
    return {
      button: box(button.getBoundingClientRect()),
      content: box(content.getBoundingClientRect()),
      glyph: box(range.getBoundingClientRect()),
      clipper: {
        left: cr.left,
        right: cr.right,
        scrollWidth: clipper.scrollWidth,
        clientWidth: clipper.clientWidth
      },
      textRects: [...whole.getClientRects()].map((r) => ({
        left: r.left - cr.left,
        right: r.right - cr.left
      })),
      overflow: getComputedStyle(button).overflow
    };
  }, probe);
}

/** Sub-pixel layout: a glyph at 15.98 on a box at 16 is inside. */
const EPSILON = 0.5;

/**
 * The room an ellipsis needs. A `…` at the label's 16px is about 10px wide;
 * the painted fragment also stops before the glyph that no longer fits, so the
 * gap is larger still. Anything past a couple of pixels is not a rounding
 * artefact of a flat cut.
 */
const ELLIPSIS_MIN_PX = 4;

async function open(page: import('@playwright/test').Page) {
  // `networkidle`, not `load`: Vite's first-visit dependency optimisation
  // reloads the page, which would destroy the evaluation context mid-measure
  // (the same reason as in tab-focus-ring.spec.ts).
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="button-overflow-fixtures"]');
  await page.evaluate(() => document.fonts.ready);
}

/** A fragment that ends before the clipper's right edge, with room for a `…`. */
function paintedShort(p: Probe): Box | undefined {
  const width = p.clipper.right - p.clipper.left;
  return p.textRects.find((r) => r.right <= width - ELLIPSIS_MIN_PX);
}

test('the first glyph of a shrunk, padding-less label starts inside the box', async ({ page }) => {
  await open(page);
  const g = await measure(page, 'glyph');

  // The row is narrower than the label, so the label overflows — that is the
  // consumer's choice (`min-w-0`). What it must never do is overflow at the
  // START: an overflowing line is start-aligned, and a clip at the box edge
  // would take the first glyph with it.
  expect(g.overflow, 'the button clips nothing').toBe('visible');
  expect(g.glyph.left).toBeGreaterThanOrEqual(g.button.left - EPSILON);
});

test("a consumer's truncating child paints its ellipsis inside the box", async ({ page }) => {
  await open(page);
  const t = await measure(page, 'truncate-child');
  const flat = await measure(page, 'truncate-child-clip');

  // The child can only clip if the content slot lets it shrink — a slot with
  // `min-width: auto` is as wide as the label and the child never overflows.
  expect(t.clipper.scrollWidth).toBeGreaterThan(t.clipper.clientWidth);
  expect(t.content.right).toBeLessThanOrEqual(t.button.right + EPSILON);
  expect(t.glyph.left).toBeGreaterThanOrEqual(t.button.left - EPSILON);

  // The ellipsis itself, by its layout footprint — and the twin without
  // `text-overflow` is cut flat, so the same reading finds nothing there.
  expect(paintedShort(t), 'no painted fragment stops short of the edge').toBeDefined();
  expect(paintedShort(flat), 'the flat twin must not read as an ellipsis').toBeUndefined();
});

test('an icon keeps its size in a box too narrow for icon and padding', async ({ page }) => {
  await open(page);
  const icon = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-probe="icon"]');
    // The content slot's svg — the first svg in a Button is its hidden spinner.
    const svg = button?.querySelector(':scope > span:last-of-type svg');
    if (!button || !svg) throw new Error('the icon probe renders a <button> with an <svg>');
    const b = button.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    // The size the icon DECLARES is its `w-<step>` class — computed `width`
    // would only echo whatever the flex algorithm handed it.
    const step = [...svg.classList]
      .map((c) => /^w-(\d+(?:\.\d+)?)$/.exec(c)?.[1])
      .find((v) => v !== undefined);
    if (step === undefined) throw new Error('the icon probe declares its size with a w-* class');
    const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return {
      declared: (Number.parseFloat(step) / 4) * rootFontPx,
      width: s.width,
      height: s.height,
      offsetFromCentre: s.left + s.width / 2 - (b.left + b.width / 2)
    };
  });

  // `w-8` with `size="sm"` leaves a 16px icon a 6px content box. The icon
  // must not shrink into it: shrunk, it draws at a fraction of its size and
  // nothing shows the consumer that the padding is the mistake. Kept, it sits
  // off-centre — which is what a box narrower than icon + padding looks like,
  // and what `px-0` fixes.
  expect(icon.width).toBeCloseTo(icon.declared, 1);
  expect(icon.height).toBeCloseTo(icon.declared, 1);
  expect(Math.abs(icon.offsetFromCentre)).toBeGreaterThan(0);
});

test('a flex row cannot shrink a button below its label', async ({ page }) => {
  await open(page);
  const r = await measure(page, 'row');

  // No `min-w-0` here: the automatic minimum keeps the label in the box and
  // the row overflows instead. Both edges, because a centred overflow shows
  // on both.
  expect(r.content.left).toBeGreaterThanOrEqual(r.button.left - EPSILON);
  expect(r.content.right).toBeLessThanOrEqual(r.button.right + EPSILON);
  expect(r.clipper.scrollWidth, 'the label is not clipped either').toBeLessThanOrEqual(
    r.clipper.clientWidth
  );
});
