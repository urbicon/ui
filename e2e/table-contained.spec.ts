import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * The contained scroll model (`fit="viewport"`) in a real browser — the half of
 * the table's two scroll models that nothing in this repo executed until #277.
 *
 * What is here is what only a layout engine can answer: whether the box really
 * caps at `100dvh` minus its measured offset, which of the two layout roots is
 * actually displayed at a given container × viewport pair, whether the pinned
 * layers land flush against each other, and whether the page around the table
 * stays still. The write side of the same subsystem — which of the four
 * `--blocks-table-*` properties are set, with which values — is pinned in jsdom
 * by `packages/table/src/lib/core/Table.sticky.svelte.test.ts`.
 *
 * Two rigs, deliberately:
 *   - `/test-fixtures/table-contained` is the measurement rig. Its `?fit=` and
 *     `?box=` knobs exist because the questions here are PAIRS: the viewport
 *     half is Playwright's, and the container half has to move independently of
 *     it, which is the only way to show that the layout switch reads the box
 *     while the height cap reads the window.
 *   - `/table/sticky-pinning/contained` is the live demo a reader meets, framed
 *     on the sticky-pinning page. It is covered here because a demo that
 *     silently stops demonstrating its feature is exactly what #277 was filed
 *     about.
 *
 * No screenshots, so no `@pixel` tag: every assertion is a measurement.
 */

const FIXTURE = '/test-fixtures/table-contained';
const DEMO = '/table/sticky-pinning/contained';
const DOCS_PAGE = '/table/sticky-pinning';

/**
 * Everything one page tells us about the model, read in one pass so the numbers
 * describe the same layout state.
 *
 * `display` rather than presence: BOTH layout roots are in the DOM in every
 * configuration (pinned in the jsdom suite), so asking whether a node exists
 * answers a different question than which layout the reader sees.
 */
async function readModel(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-table-container]') as HTMLElement;
    const style = getComputedStyle(container);
    const desktop = container.querySelector('[data-table-layout="desktop"]') as HTMLElement;
    const mobile = container.querySelector('[data-testid="mobile-table"]') as HTMLElement;
    const doc = document.scrollingElement as HTMLElement;
    const box = container.getBoundingClientRect();
    const scrolls = (el: HTMLElement) => ({
      y: el.scrollHeight > el.clientHeight + 1,
      x: el.scrollWidth > el.clientWidth + 1
    });

    return {
      fit: container.dataset.fit,
      maxHeight: style.maxHeight,
      availTop: style.getPropertyValue('--blocks-table-avail-top'),
      boxHeight: box.height,
      boxWidth: box.width,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      desktopInDom: !!desktop,
      mobileInDom: !!mobile,
      desktopDisplay: getComputedStyle(desktop).display,
      mobileDisplay: getComputedStyle(mobile).display,
      desktopScrolls: scrolls(desktop),
      mobileScrolls: scrolls(mobile),
      pageScrolls: scrolls(doc)
    };
  });
}

const pxOf = (value: string) => Number.parseFloat(value.replace('px', ''));

async function open(page: Page, url: string, viewport: { width: number; height: number }) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'load' });
  // `html[data-hydrated]` is the root layout's own mount marker: the measuring
  // attachments are client-side, so a reading taken before it is a reading of
  // the inert SSR markup.
  await page.waitForSelector('html[data-hydrated]');
  await page.waitForSelector('[data-table-container]');
}

test.describe('fit="viewport" — the contained scroll model', () => {
  test('the box caps at the window minus its own measured offset, and the page stays still', async ({
    page
  }) => {
    await open(page, FIXTURE, { width: 1280, height: 800 });
    // The offset is written by a ResizeObserver-backed attachment, so it is the
    // last thing to land; polling it beats sleeping on it.
    await expect.poll(async () => (await readModel(page)).availTop.trim()).not.toBe('');

    const contained = await readModel(page);

    expect(contained.fit).toBe('viewport');
    // The app-shell bar plus the page's own top padding — measured, not
    // assumed, because the whole point of the property is that the component
    // works it out rather than being told.
    const availTop = pxOf(contained.availTop);
    expect(availTop).toBeGreaterThan(0);
    expect(pxOf(contained.maxHeight)).toBeCloseTo(contained.viewport.height - availTop, 0);
    expect(contained.boxHeight).toBeCloseTo(contained.viewport.height - availTop, 0);

    // Both axes are contained: the rows scroll inside the box, and the page
    // neither grows past the window nor scrolls sideways. The sideways half is
    // the reason the model exists.
    expect(contained.desktopScrolls).toEqual({ x: true, y: true });
    expect(contained.pageScrolls).toEqual({ x: false, y: false });

    // POSITIVE CONTROL, same rig, same readings: with the default model the box
    // is uncapped and the PAGE is what scrolls. Without this the assertions
    // above would also pass against a rig that measures nothing.
    await open(page, `${FIXTURE}?fit=content`, { width: 1280, height: 800 });
    const free = await readModel(page);

    expect(free.fit).toBe('content');
    expect(free.maxHeight).toBe('none');
    expect(free.availTop.trim()).toBe('');
    expect(free.boxHeight).toBeGreaterThan(free.viewport.height);
    expect(free.pageScrolls.y).toBe(true);
    expect(free.desktopScrolls.y).toBe(false);
  });

  test('the layout switch reads the box while the cap reads the window', async ({ page }) => {
    // Same window, two container widths. This pair is the one that cannot be
    // faked by a rig that only resizes the viewport: at 1280 the cap applies in
    // both, and only the layout changes.
    await open(page, FIXTURE, { width: 1280, height: 800 });
    const wideBox = await readModel(page);

    await open(page, `${FIXTURE}?box=narrow`, { width: 1280, height: 800 });
    const narrowBox = await readModel(page);

    // The grid renders in a box that has room for it…
    expect(wideBox.boxWidth).toBeGreaterThan(512);
    expect(wideBox.desktopDisplay).toBe('block');
    expect(wideBox.mobileDisplay).toBe('none');

    // …and the record cards in one that does not — at the SAME window width,
    // so the switch cannot be reading the window.
    expect(narrowBox.boxWidth).toBeLessThan(512);
    expect(narrowBox.desktopDisplay).toBe('none');
    expect(narrowBox.mobileDisplay).toBe('block');

    // Presence is not the answer, in either configuration.
    expect([wideBox.desktopInDom, wideBox.mobileInDom]).toEqual([true, true]);
    expect([narrowBox.desktopInDom, narrowBox.mobileInDom]).toEqual([true, true]);

    // The cap is unmoved by the layout switch: the narrow box is capped too,
    // and the card list scrolls INSIDE it rather than growing the page.
    expect(narrowBox.maxHeight).not.toBe('none');
    expect(narrowBox.boxHeight).toBeCloseTo(
      narrowBox.viewport.height - pxOf(narrowBox.availTop),
      0
    );
    expect(narrowBox.mobileScrolls.y).toBe(true);
    expect(narrowBox.pageScrolls).toEqual({ x: false, y: false });
  });

  test('a pinned group header lands against the bottom edge of the pinned column header', async ({
    page
  }) => {
    await open(page, FIXTURE, { width: 1280, height: 800 });

    const seam = await page.evaluate(async () => {
      const container = document.querySelector('[data-table-container]') as HTMLElement;
      const scroller = container.querySelector('[data-table-layout="desktop"]') as HTMLElement;
      // Far enough that the second group's header has reached its pin line and
      // is being held there by the first group's rows scrolling past.
      scroller.scrollTop = 1400;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const thead = container.querySelector('thead') as HTMLElement;
      const groupTops = [...container.querySelectorAll('tbody tr[data-testid^="grouped-row-"]')]
        .map((row) => row.getBoundingClientRect().top)
        .sort((a, b) => a - b);

      return {
        theadBottom: thead.getBoundingClientRect().bottom,
        theadHeight: thead.getBoundingClientRect().height,
        // The header of the group whose rows are on screen: the one pinned
        // directly under the column header.
        pinnedGroupTop: groupTops[0],
        // What CSS was asked to do: sticky-top + toolbar-h + thead-h.
        declaredTheadHeight: getComputedStyle(container).getPropertyValue('--blocks-table-thead-h')
      };
    });

    // Flush: the pinned group header's top edge IS the pinned column header's
    // bottom edge.
    //
    // The number the seam is made of is the third assertion: a pinned thead
    // carries no collapsed border (its underline is a shadow, which takes no
    // layout space), so it is exactly its cells' height — 40px at a 16px root,
    // `size="md"` — and that is what `--blocks-table-thead-h` has to publish,
    // unrounded. Written as an equality on purpose: a tolerance wide enough to
    // cover a half-pixel drift would report nothing when the seam moves again,
    // and half a pixel is what this is about (#272) — a gap of that size
    // between two opaque layers shows the scrolling content through it at DPR
    // 2 while an overlap of it does not.
    expect(seam.pinnedGroupTop - seam.theadBottom).toBeCloseTo(0, 1);
    expect(seam.theadHeight).toBeCloseTo(40, 1);
    expect(seam.declaredTheadHeight.trim()).toBe('40px');
  });

  test('at a phone width the table is contained rather than handed to the page', async ({
    page
  }) => {
    // `fit="viewport"` carries no width term of any kind: it is a consumer's
    // assertion that the table owns the page height, which no breakpoint can
    // check. A `md:` gate on the contained classes withheld the treatment
    // exactly where horizontal overflow hurts most — measured at 390 × 844 with
    // the gate in place: `max-height: none`, a box 4361px tall, `overflow:
    // visible` on the scroll area, and the whole page scrolling (#269).
    //
    // This is the assertion that gate has to get past to come back.
    await open(page, DEMO, { width: 390, height: 844 });
    await expect.poll(async () => (await readModel(page)).availTop.trim()).not.toBe('');

    const phone = await readModel(page);

    expect(phone.fit).toBe('viewport');
    expect(phone.maxHeight).not.toBe('none');
    expect(phone.boxHeight).toBeCloseTo(phone.viewport.height - pxOf(phone.availTop), 0);
    // The record cards are what renders at this width, and they scroll inside
    // the box; the page itself does not move.
    expect(phone.mobileDisplay).toBe('block');
    expect(phone.desktopDisplay).toBe('none');
    expect(phone.mobileScrolls.y).toBe(true);
    expect(phone.pageScrolls).toEqual({ x: false, y: false });

    // POSITIVE CONTROL for the same reading path at a width the model always
    // covered: if the phone assertions above ever fail because the rig stopped
    // measuring, these fail with them.
    await open(page, DEMO, { width: 1280, height: 800 });
    await expect.poll(async () => (await readModel(page)).availTop.trim()).not.toBe('');
    const desktop = await readModel(page);

    expect(desktop.fit).toBe('viewport');
    expect(desktop.maxHeight).not.toBe('none');
    expect(desktop.boxHeight).toBeCloseTo(desktop.viewport.height - pxOf(desktop.availTop), 0);
    expect(desktop.desktopDisplay).toBe('block');
    expect(desktop.pageScrolls).toEqual({ x: false, y: false });
  });
});

test.describe('the live demo on the sticky-pinning page', () => {
  test('the framed demo really renders the contained model', async ({ page }) => {
    // The page shipped a `<CodeExample code={…}>` with no rendered table for as
    // long as `fit` existed, which is why three defects in this model reached
    // the docs unseen (#277). This asserts the demo is a live contained table
    // and not a picture of one.
    //
    // It is also the phone assertion one level up: the docs article column is
    // 624px wide at a 1280px window, and the frame's width IS the demo's
    // viewport, so any width gate on the contained classes turns this demo back
    // into a picture — silently, which is how it stayed unseen the first time.
    await open(page, DOCS_PAGE, { width: 1280, height: 900 });

    const frame = page.locator('#contained-scroll iframe');
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toHaveAttribute('title', /contained scroll demo/i);

    const inner = page.frameLocator('#contained-scroll iframe');
    await expect(inner.locator('[data-table-container]')).toHaveAttribute('data-fit', 'viewport');

    const handle = await frame.elementHandle();
    const content = await handle?.contentFrame();
    if (!content) throw new Error('the demo frame never loaded');

    await expect
      .poll(async () =>
        content.evaluate(() => {
          const container = document.querySelector('[data-table-container]') as HTMLElement;
          return getComputedStyle(container).getPropertyValue('--blocks-table-avail-top').trim();
        })
      )
      .not.toBe('');

    const demo = await content.evaluate(() => {
      const container = document.querySelector('[data-table-container]') as HTMLElement;
      const style = getComputedStyle(container);
      const scroller = container.querySelector('[data-table-layout="desktop"]') as HTMLElement;
      const doc = document.scrollingElement as HTMLElement;
      return {
        frameHeight: window.innerHeight,
        availTop: Number.parseFloat(style.getPropertyValue('--blocks-table-avail-top')),
        boxHeight: container.getBoundingClientRect().height,
        scrollsY: scroller.scrollHeight > scroller.clientHeight + 1,
        scrollsX: scroller.scrollWidth > scroller.clientWidth + 1,
        frameDocScrollsY: doc.scrollHeight > doc.clientHeight + 1
      };
    });

    // The frame is the demo's window, so the cap is measured against it.
    expect(demo.boxHeight).toBeCloseTo(demo.frameHeight - demo.availTop, 0);
    expect(demo.scrollsY).toBe(true);
    expect(demo.scrollsX).toBe(true);
    expect(demo.frameDocScrollsY).toBe(false);

    // And the docs page around it is untouched — no sideways scroll, which is
    // the failure the model prevents.
    const outerScrollsX = await page.evaluate(() => {
      const doc = document.scrollingElement as HTMLElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(outerScrollsX).toBe(false);

    // The demo's own control is live, not a picture of a control: switching it
    // to the other model changes what the container reports, in the frame, on
    // the docs page.
    await inner.getByTestId('fit-content').click();
    await expect(inner.locator('[data-table-container]')).toHaveAttribute('data-fit', 'content');
    await inner.getByTestId('fit-viewport').click();
    await expect(inner.locator('[data-table-container]')).toHaveAttribute('data-fit', 'viewport');
  });
});

/**
 * One reading of the summary rig at a given scroll position, taken in one pass
 * so every number describes the same frame.
 *
 * The bottom edge is the SCROLLPORT's, not the element's box: a contained table
 * scrolls sideways, and a classic horizontal scrollbar sits between the two. A
 * `bottom: 0` sticky foot pins above the scrollbar, so comparing it with the
 * element's border box would measure the scrollbar's height and call it drift.
 */
async function readSummary(page: Page, at: number | 'max') {
  return page.evaluate(async (position) => {
    const scroller = document.querySelector('[data-table-layout="desktop"]') as HTMLElement;
    scroller.scrollTop = position === 'max' ? scroller.scrollHeight : (position as number);
    // Two frames: one for the scroll to land, one for the sticky layers to be
    // painted at their new offsets.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const box = scroller.getBoundingClientRect();
    const foot = scroller.querySelector('tfoot') as HTMLElement | null;
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const rows = [...scroller.querySelectorAll<HTMLElement>('tbody tr[data-row-index]')].map(
      (row) => ({ index: Number(row.dataset.rowIndex), ...rect(row)! })
    );

    return {
      scrollTop: scroller.scrollTop,
      windowHeight: window.innerHeight,
      scrollportLeft: box.left + scroller.clientLeft,
      scrollportBottom: box.top + scroller.clientTop + scroller.clientHeight,
      containerBottom: (
        document.querySelector('[data-table-container]') as HTMLElement
      ).getBoundingClientRect().bottom,
      footPosition: foot ? getComputedStyle(foot).position : null,
      foot: rect(foot),
      inBody: !!scroller.querySelector('tbody [data-testid="summary-row-total"]'),
      rows
    };
  }, at);
}

test.describe('fit="viewport" — the summary row pins to the bottom edge of the box', () => {
  const SUMMARY = `${FIXTURE}?summary=on`;

  test('the foot holds the bottom edge at rest, mid-list and at the far end', async ({ page }) => {
    await open(page, SUMMARY, { width: 1280, height: 800 });
    await page.waitForSelector('tfoot [data-testid="summary-row-total"]');

    for (const position of [0, 600, 'max'] as const) {
      const r = await readSummary(page, position);
      const label = `at scrollTop ${r.scrollTop}`;

      expect(r.foot, `foot ${label}`).not.toBeNull();
      // The totals are a `<tfoot>`, not the last row of the `<tbody>` — which
      // is what lets them pin at all.
      expect(r.inBody, `summary in the body ${label}`).toBe(false);
      expect(r.footPosition, `foot position ${label}`).toBe('sticky');
      expect(
        Math.abs(r.foot!.bottom - r.scrollportBottom),
        `foot bottom ${label}`
      ).toBeLessThanOrEqual(0.5);
      // And it stays inside the capped box rather than hanging out of it.
      expect(r.foot!.bottom).toBeLessThanOrEqual(r.containerBottom + 0.5);
    }

    // Mid-list the rows pass UNDER the foot: at least one rendered row's box
    // reaches into the band the foot covers. Without this the assertions above
    // also pass against a foot that is merely the last thing in a list short
    // enough never to reach it.
    const middle = await readSummary(page, 600);
    const covered = middle.rows.filter(
      (row) => row.bottom > middle.foot!.top + 1 && row.top < middle.foot!.bottom
    );
    expect(covered.length, 'rows passing under the pinned foot').toBeGreaterThan(0);

    // At the far end the last row stops at the foot's top edge instead of
    // disappearing behind it — the scroll extent has to account for the foot.
    const end = await readSummary(page, 'max');
    const last = end.rows.reduce((a, b) => (a.index > b.index ? a : b));
    expect(last.index, 'the last row is rendered at the far end').toBe(59);
    expect(last.bottom).toBeLessThanOrEqual(end.foot!.top + 1);
    expect(last.bottom).toBeGreaterThanOrEqual(end.foot!.top - 1);
  });

  test('the cap still holds with a pinned foot in the box', async ({ page }) => {
    await open(page, SUMMARY, { width: 1280, height: 800 });
    await expect.poll(async () => (await readSummary(page, 0)).foot).not.toBeNull();
    await expect.poll(async () => (await readModel(page)).availTop.trim()).not.toBe('');

    const model = await readModel(page);

    // The foot is a flow child of the scrolling table, so it costs scroll
    // length and not box height: the same cap as the grouped rig next door.
    expect(model.fit).toBe('viewport');
    expect(model.boxHeight).toBeCloseTo(model.viewport.height - pxOf(model.availTop), 0);
    expect(model.desktopScrolls).toEqual({ x: true, y: true });
    expect(model.pageScrolls).toEqual({ x: false, y: false });
  });

  test('the summary keeps its rule while pinned', async ({ page }) => {
    await open(page, SUMMARY, { width: 1280, height: 800 });
    await page.waitForSelector('tfoot [data-testid="summary-row-total"]');

    // Under `border-collapse` the table paints the borders at their static
    // positions, so a collapsed top border does not travel with a pinned
    // `<tfoot>`. The rule is therefore a shadow on the summary row, and this
    // reads the pixels of that seam at two scroll positions — through the first
    // column's left inset, where nothing but background sits under the line.
    // The clip starts SIX pixels above the foot's box. A `0 -2px 0 0` shadow
    // paints outside the element it is on, so the rule occupies [top−2, top):
    // indices 0-3 are the row above it, 4 and 5 are the rule, 6 onwards the
    // summary's own ground.
    const LEAD = 6;
    const seam = async (at: number | 'max') => {
      const r = await readSummary(page, at);
      const x = Math.round(r.scrollportLeft + 6);
      const y0 = Math.round(r.foot!.top) - LEAD;
      const shot = await page.screenshot({
        clip: { x, y: y0, width: 1, height: LEAD + 4 },
        scale: 'css'
      });
      return page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const px: number[][] = [];
        for (let y = 0; y < img.height; y++) {
          const d = ctx.getImageData(0, y, 1, 1).data;
          px.push([d[0], d[1], d[2]]);
        }
        return px;
      }, shot.toString('base64'));
    };

    // 620, deliberately NOT a multiple of the 40px row pitch: at 600 the rows
    // under the foot land on exactly the offsets they had at 0, so a foot that
    // let them through would still read identical at the two positions and the
    // equality below could not fail. Measured with both of the foot's grounds
    // deleted (`bg-surface-elevated` on the `<tfoot>`, `bg-summary-subtle` on
    // the row): 620 red, 600 green. Deleting either one alone stays green —
    // each is opaque by itself, and that is the point of stacking them.
    const rest = await seam(0);
    const scrolled = await seam(620);
    const luminance = (p: number[]) => (p[0] + p[1] + p[2]) / 3;

    for (const [label, column] of [
      ['at rest', rest],
      ['scrolled', scrolled]
    ] as const) {
      const darkest = column.reduce(
        (best, px, i) => (luminance(px) < luminance(column[best]) ? i : best),
        0
      );
      // The rule is where the shadow puts it — directly above the foot's top
      // edge, one index either way for a fractional edge — and it is darker
      // than the row it separates the totals from.
      expect(darkest, `${label}: where the rule sits`).toBeGreaterThanOrEqual(LEAD - 3);
      expect(darkest, `${label}: where the rule sits`).toBeLessThanOrEqual(LEAD - 1);
      expect(luminance(column[darkest]), `${label}: the rule is darker than the row`).toBeLessThan(
        luminance(column[0]) - 4
      );
    }
    // And it is the same line, with the same opaque ground under it: rows
    // passing beneath the foot change no pixel of this column.
    expect(scrolled).toEqual(rest);
  });

  test('the grid passes an axe scan with the summary out of the body', async ({ page }) => {
    // The totals row left the `<tbody>` for a `<tfoot>`, a row group of the same
    // table. Asked of axe rather than argued — a row group added between a
    // `<tbody>` and the table's accessible name is exactly what a reading
    // review waves through. This rig is not interactive, so the scan covers
    // the implicit `table` role; the same markup under `role="grid"` with
    // `aria-rowcount` is scanned by `table-virtualized.spec.ts`, whose fixture
    // is `selectionMode="multi"` and has a `<tfoot>` of its own.
    await open(page, SUMMARY, { width: 1280, height: 800 });
    await page.waitForSelector('tfoot [data-testid="summary-row-total"]');

    const results = await new AxeBuilder({ page })
      .include('[data-table-layout="desktop"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)
    ).toEqual([]);
  });

  test('a page-relative table with the same summary does not pin it', async ({ page }) => {
    // The control for every assertion above. `fit="content"` is the default
    // model: the table has no bottom edge of its own, the foot rides in the
    // flow behind the last row, and the page is what scrolls.
    await open(page, `${FIXTURE}?summary=on&fit=content`, { width: 1280, height: 800 });
    await page.waitForSelector('tfoot [data-testid="summary-row-total"]');

    const free = await readSummary(page, 0);

    expect(free.footPosition).toBe('static');
    expect(free.inBody).toBe(false);
    // Right behind the last row, and — with the page as the scroll context and
    // 60 rows above it — well below the fold: the totals are exactly as far out
    // of view as they were before any of this, which is the model's own answer
    // and not a regression of it.
    const last = free.rows.reduce((a, b) => (a.index > b.index ? a : b));
    expect(Math.abs(free.foot!.top - last.bottom)).toBeLessThanOrEqual(1);
    expect(free.foot!.top).toBeGreaterThan(free.windowHeight);

    const model = await readModel(page);
    expect(model.fit).toBe('content');
    expect(model.pageScrolls.y).toBe(true);
  });
});
