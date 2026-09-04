import { expect, test } from '@playwright/test';

/**
 * A button's box holds its label.
 *
 * The defect this guards (#393): `overflow-hidden` on the button base. It made
 * the button a scroll container, which does two things a unit test on the
 * class string cannot see. A scroll container has no automatic minimum size,
 * so a consumer's `min-w-0` — the one way to let a button shrink in a flex row
 * — shrank it straight through its label, and `justify-center` then pushed the
 * overflow out on BOTH sides, where the clip cut the first glyph off
 * ("Interaktionsmodell" → "nteraktionsmodell", measured at a 390px viewport).
 * And the content slot, a flex item of its own, kept `min-width: auto`, so a
 * truncating child never got to shrink and never showed an ellipsis.
 *
 * Nothing needed the clip: the overlay spinner sits inside the padding box,
 * measured at 2× on every variant — 0 pixels differ with and without it.
 *
 * The fourth probe is the guard the clip's removal must not undo: without a
 * clip, a flex item's automatic minimum is `min-content` — under
 * `whitespace-nowrap`, the label — so a `justify-between` row that would like
 * the button narrower gets the row to overflow, never the label.
 *
 * Geometry only, no pixels: whether the first glyph starts inside the box is
 * `Range.getBoundingClientRect()` against the button's box, and an ellipsis is
 * `scrollWidth > clientWidth` on the element that owns `text-overflow`.
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
  clipper: { scrollWidth: number; clientWidth: number; textOverflow: string };
  overflow: string;
}

function measure(page: import('@playwright/test').Page, probe: string): Promise<Probe> {
  return page.evaluate((name) => {
    const button = document.querySelector<HTMLButtonElement>(`[data-probe="${name}"]`);
    if (!button) throw new Error(`no button for probe "${name}"`);
    const content = button.querySelector<HTMLElement>(':scope > span:last-of-type');
    if (!content) throw new Error(`probe "${name}" has no content slot`);
    const clipper = content.querySelector<HTMLElement>('.truncate') ?? content;

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent?.trim()) node = walker.nextNode();
    if (!node?.textContent) throw new Error(`probe "${name}" has no label text`);
    const start = node.textContent.search(/\S/);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 1);

    const box = (r: DOMRect): Box => ({ left: r.left, right: r.right });
    return {
      button: box(button.getBoundingClientRect()),
      content: box(content.getBoundingClientRect()),
      glyph: box(range.getBoundingClientRect()),
      clipper: {
        scrollWidth: clipper.scrollWidth,
        clientWidth: clipper.clientWidth,
        textOverflow: getComputedStyle(clipper).textOverflow
      },
      overflow: getComputedStyle(button).overflow
    };
  }, probe);
}

/** Sub-pixel layout: a glyph at 15.98 on a box at 16 is inside. */
const EPSILON = 0.5;

async function open(page: import('@playwright/test').Page) {
  // `networkidle`, not `load`: Vite's first-visit dependency optimisation
  // reloads the page, which would destroy the evaluation context mid-measure
  // (the same reason as in tab-focus-ring.spec.ts).
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="button-overflow-fixtures"]');
  await page.evaluate(() => document.fonts.ready);
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

test('the content slot truncates when asked, inside the box', async ({ page }) => {
  await open(page);
  const t = await measure(page, 'truncate');

  expect(t.clipper.textOverflow).toBe('ellipsis');
  expect(t.clipper.scrollWidth, 'the label is wider than what the slot shows').toBeGreaterThan(
    t.clipper.clientWidth
  );
  expect(t.content.left).toBeGreaterThanOrEqual(t.button.left - EPSILON);
  expect(t.content.right).toBeLessThanOrEqual(t.button.right + EPSILON);
  expect(t.glyph.left).toBeGreaterThanOrEqual(t.button.left - EPSILON);
});

test("a consumer's own truncating child reaches its ellipsis", async ({ page }) => {
  await open(page);
  const t = await measure(page, 'truncate-child');

  // The child can only clip if the content slot lets it shrink — a slot with
  // `min-width: auto` is as wide as the label and the child never overflows.
  expect(t.clipper.textOverflow).toBe('ellipsis');
  expect(t.clipper.scrollWidth).toBeGreaterThan(t.clipper.clientWidth);
  expect(t.content.right).toBeLessThanOrEqual(t.button.right + EPSILON);
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
