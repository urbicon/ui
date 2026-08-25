// @vitest-environment jsdom
//
// The writer side of sticky pinning: `variants/table.sticky.test.ts` pins the
// `top-[calc(var(…))]` strings that *read* these custom properties, and nothing
// pinned what gets written into them (#272).
//
// jsdom has no layout engine, so every reading is stubbed: `getBoundingClientRect`
// per element, a controllable `ResizeObserver`, `innerHeight` and `scrollY` on the
// window. That makes the rig itself the thing most likely to be wrong, so every
// assertion below is paired with a positive control run through the *same* rig.
// The controls are the three implementations this module has had, each the real
// formula of its version in an otherwise current body (bottom of the file), so a
// control exercises the defect it is there to show and not a paraphrase of it.
//
// What the browser holds and jsdom cannot: whether the cap survives a real scroll
// and a real reflow, and whether the observer's initial observation lands before
// the frame is painted. Both were measured in Chromium at 1200x900 for the change
// that introduced these tests; the numbers are in that change's description, not
// in a comment here.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { measureToCssVar, measureViewportOffsetTop } from './sticky-measure';

const PROP = '--blocks-table-thead-h';
const TOP_PROP = '--blocks-table-avail-top';
const VIEWPORT_HEIGHT = 768;

// ── rig ─────────────────────────────────────────────────────────────────────

type SizeEntry = { contentHeight: number; borderHeight?: number };

/** The stubbed boxes, so `observe()` can report the size the element "has". */
const BOXES = new WeakMap<Element, { top: number; height: number; contentHeight: number }>();

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
    // The spec's initial observation: `observe()` queues one for the target's
    // current size, delivered before the next paint. Without it the suite
    // measured a state no browser ever holds — the attach-time reading of the
    // pre-#272 implementation, which the initial observation overwrote in the
    // same frame (measured on the live `<thead>`: 41px at attach, 40px one
    // observation later, against a 40.5px border box).
    const box = BOXES.get(target);
    this.emit(target as HTMLElement, {
      contentHeight: box?.contentHeight ?? 0,
      borderHeight: box?.height ?? 0
    });
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    this.disconnected = true;
  }

  /** Deliver one entry for `target`, shaped like the real observer's. */
  emit(target: HTMLElement, size: SizeEntry) {
    const entry = {
      target,
      contentRect: {
        height: size.contentHeight,
        width: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: size.contentHeight,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRectReadOnly,
      ...(size.borderHeight === undefined
        ? {}
        : { borderBoxSize: [{ blockSize: size.borderHeight, inlineSize: 0 }] })
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }

  /** The observer instance watching `target`, or `undefined`. */
  static watching(target: Element) {
    return FakeResizeObserver.instances.find((instance) => instance.targets.has(target));
  }
}

/** Fix an element's box; only the numbers this module reads are meaningful. */
function stubBox(
  element: HTMLElement,
  box: { top?: number; height?: number; contentHeight?: number }
) {
  const top = box.top ?? 0;
  const height = box.height ?? 0;
  BOXES.set(element, { top, height, contentHeight: box.contentHeight ?? height });
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: top,
      top,
      left: 0,
      right: 0,
      bottom: top + height,
      width: 0,
      height,
      toJSON: () => ({})
    }) as DOMRect;
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
}

/** `<div data-table-container><div data-measured/></div>` inside `parent`. */
function buildRig(parent: HTMLElement = document.body) {
  const container = document.createElement('div');
  container.setAttribute('data-table-container', '');
  const measured = document.createElement('div');
  container.append(measured);
  parent.append(container);
  return { container, measured };
}

/** Put an ancestor with a computed style the ancestor walk reads around `element`. */
function wrapIn(
  element: HTMLElement,
  css: Record<string, string>,
  box: { top?: number; height?: number } = {}
) {
  const parent = element.parentElement as HTMLElement;
  const wrapper = document.createElement('div');
  for (const [name, value] of Object.entries(css)) wrapper.style.setProperty(name, value);
  parent.append(wrapper);
  wrapper.append(element);
  stubBox(wrapper, box);
  return wrapper;
}

let originalResizeObserver: typeof ResizeObserver;

beforeEach(() => {
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  FakeResizeObserver.instances = [];
  document.documentElement.style.overflowY = '';
  document.body.style.overflowY = '';
  document.body.replaceChildren();
  stubBox(document.body, { top: 0, height: VIEWPORT_HEIGHT });
  Object.defineProperty(window, 'innerHeight', {
    value: VIEWPORT_HEIGHT,
    configurable: true,
    writable: true
  });
  setScrollY(0);
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

// ── 1. measureToCssVar — the written height ─────────────────────────────────

describe('measureToCssVar — the written height', () => {
  it('writes a fractional border-box height unrounded', () => {
    // 40.5px is the measured `<thead>` height at the default 16px root,
    // `size="md"`: `border-collapse: collapse` gives the thead half of the
    // collapsed 1px border. Rounding it up moved the group header 0.5px below
    // the thead's bottom edge — a gap between two opaque layers, one device
    // pixel wide at DPR 2, with the scrolling rows visible through it.
    const { container, measured } = buildRig();
    stubBox(measured, { height: 40.5 });

    const cleanup = measureToCssVar(PROP)(measured);
    const written = container.style.getPropertyValue(PROP);
    cleanup();

    expect(written).toBe('40.5px');

    // Positive control: the implementation this replaced, same rig, same box —
    // if the rig could not see a rounded write, the assertion above would be
    // green for any implementation at all.
    const legacy = buildRig();
    stubBox(legacy.measured, { height: 40.5 });
    const legacyCleanup = priorMeasureToCssVar(PROP)(legacy.measured);
    const legacyWritten = legacy.container.style.getPropertyValue(PROP);
    legacyCleanup();

    expect(legacyWritten).toBe('41px');
    expect(legacyWritten).not.toBe(written);
  });

  it('leaves an integer height integral — the toolbar seam', () => {
    // The L1→L2 seam (toolbar → thead) measured 0px of gap in Chrome: the
    // toolbar has no collapsed border, so its border box is a whole number.
    // Dropping the rounding must not change that half of the stack.
    const { container, measured } = buildRig();
    stubBox(measured, { height: 40 });

    const cleanup = measureToCssVar('--blocks-table-toolbar-h')(measured);
    const written = container.style.getPropertyValue('--blocks-table-toolbar-h');
    cleanup();

    expect(written).toBe('40px');
  });
});

// ── 2. measureToCssVar — the measured box ───────────────────────────────────

describe('measureToCssVar — the measured box', () => {
  // The invariant, not two separate values: there is one reading, taken from
  // the observer, so there is no second one to disagree with it. They diverged
  // the moment a consumer put padding on the toolbar via `slotClasses.toolbar` —
  // first paint pinned the thead 32px too low, the next frame 32px too high.
  const CONTENT_HEIGHT = 100;
  const BORDER_HEIGHT = 132; // + p-4 on both sides

  it('takes its only reading from the observer, and it is the border box', () => {
    const { container, measured } = buildRig();
    stubBox(measured, { height: BORDER_HEIGHT, contentHeight: CONTENT_HEIGHT });

    const cleanup = measureToCssVar(PROP)(measured);
    const onAttach = container.style.getPropertyValue(PROP);

    FakeResizeObserver.watching(measured)?.emit(measured, {
      contentHeight: CONTENT_HEIGHT,
      borderHeight: BORDER_HEIGHT
    });
    const fromObserver = container.style.getPropertyValue(PROP);
    cleanup();

    expect(onAttach).toBe(`${BORDER_HEIGHT}px`);
    expect(fromObserver).toBe(onAttach);

    // Positive control: same rig, same box, the implementation this replaced —
    // it read the rounded rect at attach and the content box from the observer,
    // and the rig sees both that the two disagree and that the second one is
    // what survives the attach.
    const legacy = buildRig();
    stubBox(legacy.measured, { height: BORDER_HEIGHT, contentHeight: CONTENT_HEIGHT });
    const legacyCleanup = priorMeasureToCssVar(PROP)(legacy.measured);
    const legacyOnAttach = legacy.container.style.getPropertyValue(PROP);
    legacyCleanup();

    expect(legacyOnAttach).toBe(`${CONTENT_HEIGHT}px`);
    expect(legacyOnAttach).not.toBe(onAttach);
  });

  it('falls back to the rect when an entry carries no borderBoxSize', () => {
    const { container, measured } = buildRig();
    stubBox(measured, { height: BORDER_HEIGHT });

    const cleanup = measureToCssVar(PROP)(measured);

    // Positive control for the fallback path itself: move the box *before*
    // emitting, so a value that came from the initial observation instead of
    // from the fallback would still say 132px and fail here.
    stubBox(measured, { height: 148 });
    FakeResizeObserver.watching(measured)?.emit(measured, { contentHeight: CONTENT_HEIGHT });
    const written = container.style.getPropertyValue(PROP);
    cleanup();

    expect(written).toBe('148px');
  });

  it('writes to the closest container and clears the property on cleanup', () => {
    const { container, measured } = buildRig();
    stubBox(measured, { height: 40 });

    const cleanup = measureToCssVar(PROP)(measured);
    expect(container.style.getPropertyValue(PROP)).toBe('40px');
    expect(measured.style.getPropertyValue(PROP)).toBe('');

    cleanup();
    expect(container.style.getPropertyValue(PROP)).toBe('');
    expect(FakeResizeObserver.watching(measured)).toBeUndefined();
  });

  it('puts the property back after something rewrites the inline style', () => {
    // The property shares the `style` attribute the component owns. Dragging
    // `stickyOffset` re-set that attribute as a whole string and took both
    // measured properties with it; the thead then pinned at `sticky-top` alone,
    // on top of the toolbar it is supposed to sit below.
    const { container, measured } = buildRig();
    stubBox(measured, { height: 40.5 });

    const cleanup = measureToCssVar(PROP)(measured);
    container.setAttribute('style', '--blocks-table-sticky-top: 60px;');
    expect(container.style.getPropertyValue(PROP)).toBe('');

    FakeResizeObserver.watching(measured)?.emit(measured, {
      contentHeight: 40,
      borderHeight: 40.5
    });
    const restored = container.style.getPropertyValue(PROP);
    cleanup();

    expect(restored).toBe('40.5px');

    // Positive control: the same rig, the same clobber, an implementation that
    // skips a write it believes it has already made. Nothing puts it back.
    const dedupe = buildRig();
    stubBox(dedupe.measured, { height: 40.5 });
    const dedupeCleanup = dedupedMeasureToCssVar(PROP)(dedupe.measured);
    dedupe.container.setAttribute('style', '--blocks-table-sticky-top: 60px;');
    FakeResizeObserver.watching(dedupe.measured)?.emit(dedupe.measured, {
      contentHeight: 40,
      borderHeight: 40.5
    });
    const notRestored = dedupe.container.style.getPropertyValue(PROP);
    dedupeCleanup();

    expect(notRestored).toBe('');
  });
});

// ── 3. measureViewportOffsetTop — what is reserved ──────────────────────────

describe('measureViewportOffsetTop — the reserved space', () => {
  it('reserves nothing in the page flow, however far down the page the box sits', () => {
    // A table two screens below the fold: nothing above it is pinned, so the
    // reader can bring it to the top of the viewport and the whole viewport is
    // its to use. The cap has to say so before anyone has scrolled to it.
    const { container } = buildRig();
    stubBox(container, { top: 2000, height: 400 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(written).toBe('0px');

    // Positive control 1 — #304: a box that starts below the viewport bottom is
    // refused, and nothing is written at all. `var(…, 0px)` then leaves the cap
    // at `100dvh` while the box sits 2000px down: it reaches 2000px past the
    // viewport bottom and only an unrelated resize ever corrects it.
    const held = buildRig();
    stubBox(held.container, { top: 2000, height: 400 });
    const heldCleanup = priorMeasureViewportOffsetTop(TOP_PROP, VIEWPORT_RELATIVE)(held.container);
    const heldWritten = held.container.style.getPropertyValue(TOP_PROP);
    heldCleanup();
    expect(heldWritten).toBe('');

    // Positive control 2 — pre-#272: written, and `calc(100dvh - 2000px)` is
    // negative, which is the table collapsed to zero height.
    const document_ = buildRig();
    stubBox(document_.container, { top: 2000, height: 400 });
    const documentCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      DOCUMENT_RELATIVE
    )(document_.container);
    const documentWritten = document_.container.style.getPropertyValue(TOP_PROP);
    documentCleanup();
    expect(documentWritten).toBe('2000px');
    expect(Number.parseFloat(documentWritten)).toBeGreaterThan(VIEWPORT_HEIGHT);
  });

  it('reserves the space a clipping ancestor holds above the box', () => {
    // `overflow: hidden` clips without giving the reader a scrollbar, so the box
    // cannot be moved inside it: whatever sits above it there stays above it.
    const { container } = buildRig();
    stubBox(container, { top: 400, height: 400 });
    wrapIn(container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(written).toBe('400px');
  });

  it('reserves the pin line of a sticky ancestor, at every scroll position', () => {
    // Measured in Chrome with a `position: sticky; top: 0` ancestor: the
    // container's `rect.top` stayed 0 at every scroll position (that is the
    // ancestor being pinned), while the document-relative value followed
    // `scrollY` up to 2500 — at which point `calc(100dvh - 2500px)` is negative
    // and the table collapses to zero height (#272).
    const SCROLL_POSITIONS = [0, 500, 1500, 2500];
    const { container } = buildRig();
    stubBox(container, { top: 0, height: 400 });
    wrapIn(container, { position: 'sticky', top: '0px' }, { top: 0, height: 400 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written: string[] = [];
    for (const scrollY of SCROLL_POSITIONS) {
      setScrollY(scrollY);
      window.dispatchEvent(new Event('resize'));
      written.push(container.style.getPropertyValue(TOP_PROP));
    }
    cleanup();

    expect(written).toEqual(['0px', '0px', '0px', '0px']);

    // Positive control: same rig, same pinned box, the document-relative
    // implementation — the rig does see the value walk.
    const legacy = buildRig();
    stubBox(legacy.container, { top: 0, height: 400 });
    wrapIn(legacy.container, { position: 'sticky', top: '0px' }, { top: 0, height: 400 });
    const legacyCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      DOCUMENT_RELATIVE
    )(legacy.container);
    const legacyWritten: string[] = [];
    for (const scrollY of SCROLL_POSITIONS) {
      setScrollY(scrollY);
      window.dispatchEvent(new Event('resize'));
      legacyWritten.push(legacy.container.style.getPropertyValue(TOP_PROP));
    }
    legacyCleanup();

    expect(legacyWritten).toEqual(['0px', '500px', '1500px', '2500px']);
  });

  it('reserves a pinned ancestor offset below the top of the viewport', () => {
    const { container } = buildRig();
    stubBox(container, { top: 48, height: 400 });
    wrapIn(container, { position: 'sticky', top: '48px' }, { top: 48, height: 400 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(written).toBe('48px');
  });

  it('reserves what an app shell holds above its scroll pane, with no case of its own', () => {
    // `html, body { overflow: hidden }` + an inner `overflow: auto` pane is the
    // standard app shell. `body` is an ordinary ancestor to the walk, which is
    // what makes this come out right: the 64px above the pane never move, and
    // the 200px of content above the box INSIDE the pane scroll with it, not
    // away from it — so both are reserved, and the pane then does not scroll.
    document.documentElement.style.overflowY = 'hidden';
    document.body.style.overflowY = 'hidden';
    const pane = document.createElement('div');
    pane.style.setProperty('overflow-y', 'auto');
    document.body.append(pane);
    stubBox(pane, { top: 64, height: VIEWPORT_HEIGHT - 64 });
    const { container } = buildRig(pane);
    stubBox(container, { top: 264, height: 400 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(written).toBe('264px');
  });

  it('reads the same place in a scrollport at every scroll position', () => {
    // The box's place in a scrollport's content is `top - paneTop + scrollTop`,
    // the same number wherever the pane is scrolled to — and a clipping wrapper
    // inside the pane adds its inset like any other content above the box.
    // Here: 200px inside the wrapper, the wrapper 200px into the pane, the pane
    // 100px down the page → 500px, scrolled or not.
    const { container } = buildRig();
    stubBox(container, { top: 500, height: 200 });
    const clip = wrapIn(container, { 'overflow-y': 'hidden' }, { top: 300, height: 400 });
    wrapIn(clip, { 'overflow-y': 'auto' }, { top: 100, height: 600 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(written).toBe('500px');

    // Positive control through the same rig: scroll the pane by 150 — the two
    // boxes inside it move up by 150 and `scrollTop` says 150 — and the number
    // holds. The viewport-relative reading this replaced wrote the current top
    // instead, so the same rig makes it write 350 here.
    const scrolled = buildRig();
    stubBox(scrolled.container, { top: 350, height: 200 });
    const scrolledClip = wrapIn(
      scrolled.container,
      { 'overflow-y': 'hidden' },
      { top: 150, height: 400 }
    );
    const pane = wrapIn(scrolledClip, { 'overflow-y': 'auto' }, { top: 100, height: 600 });
    Object.defineProperty(pane, 'scrollTop', { value: 150, configurable: true });

    const scrolledCleanup = measureViewportOffsetTop(TOP_PROP)(scrolled.container);
    const scrolledWritten = scrolled.container.style.getPropertyValue(TOP_PROP);
    scrolledCleanup();
    const priorCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      VIEWPORT_RELATIVE
    )(scrolled.container);
    const priorWritten = scrolled.container.style.getPropertyValue(TOP_PROP);
    priorCleanup();

    expect(scrolledWritten).toBe('500px');
    expect(priorWritten).toBe('350px');
  });

  it('writes the reserved space unrounded', () => {
    // Real container tops are fractional — 765.71px on the library's own sticky
    // pinning page. The written value goes straight into `calc(100dvh - …)`, and
    // a fractional px is valid CSS there for the same reason it is for the layer
    // heights above.
    const { container } = buildRig();
    stubBox(container, { top: 400.71, height: 200 });
    wrapIn(container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(written).toBe('400.71px');

    // Positive control: the rounding implementation, same rig, same box.
    const rounded = buildRig();
    stubBox(rounded.container, { top: 400.71, height: 200 });
    wrapIn(rounded.container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });
    const roundedCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      DOCUMENT_RELATIVE
    )(rounded.container);
    const roundedWritten = rounded.container.style.getPropertyValue(TOP_PROP);
    roundedCleanup();

    expect(roundedWritten).toBe('401px');
    expect(roundedWritten).not.toBe(written);
  });

  it('can never write a value that makes the cap negative', () => {
    // The cap is `max-height: calc(100dvh - <written>)`, so anything at or past
    // the viewport height is a table of zero height. Sweeping the box through
    // and past the viewport bottom inside a clipping ancestor, which is the one
    // shape where the reserved space tracks the box's own offset.
    const TOPS = [0, 100, 400, 760, 768, 900, 2500];
    const { container } = buildRig();
    stubBox(container, { top: 0, height: 400 });
    wrapIn(container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const written: number[] = [];
    for (const top of TOPS) {
      stubBox(container, { top, height: 400 });
      window.dispatchEvent(new Event('resize'));
      written.push(Number.parseFloat(container.style.getPropertyValue(TOP_PROP)));
    }
    cleanup();

    for (const value of written) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(VIEWPORT_HEIGHT);
    }
    // Past the viewport height there is nothing left to reserve: what is above
    // the box is not chrome the reader keeps in view, it is content they scroll
    // away, so the box gets the whole viewport rather than none of it.
    expect(written).toEqual([0, 100, 400, 760, 0, 0, 0]);

    // Positive control: the same sweep through the document-relative
    // implementation, whose writes run straight past the viewport height.
    const legacy = buildRig();
    stubBox(legacy.container, { top: 0, height: 400 });
    wrapIn(legacy.container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });
    const legacyCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      DOCUMENT_RELATIVE
    )(legacy.container);
    const legacyWritten: number[] = [];
    for (const top of TOPS) {
      stubBox(legacy.container, { top, height: 400 });
      window.dispatchEvent(new Event('resize'));
      legacyWritten.push(Number.parseFloat(legacy.container.style.getPropertyValue(TOP_PROP)));
    }
    legacyCleanup();

    expect(legacyWritten.some((value) => value >= VIEWPORT_HEIGHT)).toBe(true);
  });
});

// ── 4. measureViewportOffsetTop — what re-measures ──────────────────────────

describe('measureViewportOffsetTop — what re-measures', () => {
  /** The box and its clipping pane, both moved up by `by` — a page scroll. */
  function scrollBy(container: HTMLElement, pane: HTMLElement, by: number) {
    stubBox(container, { top: 400 - by, height: 400 });
    stubBox(pane, { top: -by, height: VIEWPORT_HEIGHT });
    setScrollY(by);
  }

  it('holds the cap through a reflow that happens while the page is scrolled', () => {
    // Measured in Chromium: a sibling growing from 2000 to 2400px — no user
    // action, no viewport change — re-wrote the cap against the scrolled
    // position, and the box was still that height back at the top of the page,
    // reaching 300px past the viewport bottom.
    const { container } = buildRig();
    stubBox(container, { top: 400, height: 400 });
    const pane = wrapIn(container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const atRest = container.style.getPropertyValue(TOP_PROP);

    scrollBy(container, pane, 300);
    FakeResizeObserver.watching(document.body)?.emit(document.body, { contentHeight: 2400 });
    window.dispatchEvent(new Event('resize'));
    const afterReflow = container.style.getPropertyValue(TOP_PROP);

    // Back at the top of the page nothing fires — scrolling is not an event this
    // module listens to — so whatever the reflow wrote is what the box keeps.
    scrollBy(container, pane, 0);
    const backAtTop = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(atRest).toBe('400px');
    expect(afterReflow).toBe('400px');
    expect(backAtTop).toBe('400px');

    // Positive control: the same rig and the same reflow through the
    // viewport-relative implementation — 400px at rest, 100px after the reflow,
    // and still 100px back at the top of the page.
    const prior = buildRig();
    stubBox(prior.container, { top: 400, height: 400 });
    const priorPane = wrapIn(
      prior.container,
      { 'overflow-y': 'hidden' },
      { top: 0, height: VIEWPORT_HEIGHT }
    );
    const priorCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      VIEWPORT_RELATIVE
    )(prior.container);
    const priorAtRest = prior.container.style.getPropertyValue(TOP_PROP);
    scrollBy(prior.container, priorPane, 300);
    window.dispatchEvent(new Event('resize'));
    const priorAfterReflow = prior.container.style.getPropertyValue(TOP_PROP);
    scrollBy(prior.container, priorPane, 0);
    const priorBackAtTop = prior.container.style.getPropertyValue(TOP_PROP);
    priorCleanup();

    expect([priorAtRest, priorAfterReflow, priorBackAtTop]).toEqual(['400px', '100px', '100px']);
  });

  it('listens to no scroll, because nothing it measures can change on one', () => {
    // A nested scrollport inside a pane that cannot scroll: the box rises to the
    // scrollport's top edge and no further, wherever the scrollport happens to
    // be scrolled to right now.
    const { container } = buildRig();
    stubBox(container, { top: 300, height: 400 });
    const scrollport = wrapIn(container, { 'overflow-y': 'auto' }, { top: 300, height: 400 });
    wrapIn(scrollport, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    const before = container.style.getPropertyValue(TOP_PROP);

    stubBox(container, { top: 120, height: 400 });
    scrollport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
    const afterScrolling = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(before).toBe('300px');
    expect(afterScrolling).toBe('300px');

    // Positive control: the viewport-relative implementation subscribed to every
    // scrollable ancestor, and the rig sees that subscription fire.
    const prior = buildRig();
    stubBox(prior.container, { top: 300, height: 400 });
    const priorScrollport = wrapIn(
      prior.container,
      { 'overflow-y': 'auto' },
      { top: 300, height: 400 }
    );
    wrapIn(priorScrollport, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });
    const priorCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      VIEWPORT_RELATIVE
    )(prior.container);
    stubBox(prior.container, { top: 120, height: 400 });
    priorScrollport.dispatchEvent(new Event('scroll'));
    const priorAfter = prior.container.style.getPropertyValue(TOP_PROP);
    priorCleanup();

    expect(priorAfter).toBe('120px');
  });

  it('puts the property back after something rewrites the inline style', () => {
    const { container } = buildRig();
    stubBox(container, { top: 400, height: 400 });
    wrapIn(container, { 'overflow-y': 'hidden' }, { top: 0, height: VIEWPORT_HEIGHT });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    container.setAttribute('style', '--blocks-table-sticky-top: 0px;');
    expect(container.style.getPropertyValue(TOP_PROP)).toBe('');

    window.dispatchEvent(new Event('resize'));
    const restored = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(restored).toBe('400px');

    // Positive control: the same clobber under the write-if-changed guard, which
    // compares the next value against the one it believes it wrote and returns.
    const prior = buildRig();
    stubBox(prior.container, { top: 400, height: 400 });
    const priorCleanup = priorMeasureViewportOffsetTop(
      TOP_PROP,
      VIEWPORT_RELATIVE
    )(prior.container);
    prior.container.setAttribute('style', '--blocks-table-sticky-top: 0px;');
    window.dispatchEvent(new Event('resize'));
    const notRestored = prior.container.style.getPropertyValue(TOP_PROP);
    priorCleanup();

    expect(notRestored).toBe('');
  });

  it('observes both the body and the pane above it, and stops on cleanup', () => {
    // Chrome appearing above the table shows up in different boxes depending on
    // the shell: the body box grows in a document-scrolling page, while in a
    // shell whose pane is content-height the body never moves and the pane does.
    // Both are observed, which is what the two assertions below separate — the
    // rig has to hold the pane and the body apart, so the container is *not* a
    // child of the body here.
    const pane = document.createElement('div');
    pane.style.setProperty('overflow-y', 'hidden');
    document.body.append(pane);
    stubBox(pane, { top: 0, height: VIEWPORT_HEIGHT });
    const { container } = buildRig(pane);
    stubBox(container, { top: 300, height: 400 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    expect(container.style.getPropertyValue(TOP_PROP)).toBe('300px');

    // The container itself is not observed, so the instance is picked by count,
    // not by target — one attach, one observer.
    expect(FakeResizeObserver.instances).toHaveLength(1);
    const [observer] = FakeResizeObserver.instances;
    expect(observer?.targets.has(document.body)).toBe(true);
    expect(observer?.targets.has(pane)).toBe(true);
    // Positive control on those two: `targets` is a real record of what was
    // observed, not a set that answers yes to everything.
    expect(observer?.targets.has(container)).toBe(false);

    stubBox(container, { top: 380, height: 400 });
    observer?.emit(pane, { contentHeight: VIEWPORT_HEIGHT + 80 });
    expect(container.style.getPropertyValue(TOP_PROP)).toBe('380px');

    cleanup();
    expect(container.style.getPropertyValue(TOP_PROP)).toBe('');

    // Positive control on the teardown: the same event that just moved the
    // value must now do nothing at all, property included.
    stubBox(container, { top: 40, height: 400 });
    window.dispatchEvent(new Event('resize'));
    expect(container.style.getPropertyValue(TOP_PROP)).toBe('');
  });
});

// ── the implementations these tests replaced, kept as the positive controls ──
//
// Each is the formula of the version named, in a body that is otherwise the
// current one, so a control runs the same attach → observe → listen → teardown
// path as the code under test and differs only where the defect was. None of
// them is imported anywhere else.

/** Pre-#272: the rounded rect at attach, the content box from the observer. */
function priorMeasureToCssVar(property: string, targetSelector = '[data-table-container]') {
  return (element: HTMLElement) => {
    const target =
      (element.closest(targetSelector) as HTMLElement | null) ?? (element as HTMLElement);

    const apply = (height: number) => {
      target.style.setProperty(property, `${Math.round(height)}px`);
    };

    apply(element.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        apply(entry.contentRect.height);
      }
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
    };
  };
}

/** The current reading under a write-if-changed guard, the shape that made a
 *  cleared property unrecoverable. */
function dedupedMeasureToCssVar(property: string, targetSelector = '[data-table-container]') {
  return (element: HTMLElement) => {
    const target =
      (element.closest(targetSelector) as HTMLElement | null) ?? (element as HTMLElement);
    let written: number | null = null;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = entry.borderBoxSize?.[0]?.blockSize ?? 0;
        if (next === written) continue;
        written = next;
        target.style.setProperty(property, `${next}px`);
      }
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
    };
  };
}

/** A reading, or `null` for "hold whatever was written last". */
type PriorReading = (element: HTMLElement) => number | null;

/** Pre-#272: the container's distance from the top of the *document*. */
const DOCUMENT_RELATIVE: PriorReading = (element) =>
  Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY));

/** #304: its current distance from the top of the *viewport*, refused whenever
 *  the box already starts below the viewport bottom. */
const VIEWPORT_RELATIVE: PriorReading = (element) => {
  const top = element.getBoundingClientRect().top;
  return top >= window.innerHeight ? null : Math.max(0, top);
};

function priorMeasureViewportOffsetTop(property: string, read: PriorReading) {
  return (element: HTMLElement) => {
    const target =
      (element.closest('[data-table-container]') as HTMLElement | null) ?? (element as HTMLElement);

    let written: number | null = null;

    const apply = () => {
      const next = read(element);
      if (next === null || next === written) return;
      written = next;
      target.style.setProperty(property, `${next}px`);
    };

    apply();

    const scrollAncestors: HTMLElement[] = [];
    for (
      let node = element.parentElement;
      node && node !== document.body;
      node = node.parentElement
    ) {
      if (/^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) {
        scrollAncestors.push(node);
      }
    }

    const observer = new ResizeObserver(apply);
    observer.observe(document.body);
    if (element.parentElement) observer.observe(element.parentElement);

    window.addEventListener('resize', apply);
    for (const ancestor of scrollAncestors) {
      ancestor.addEventListener('scroll', apply, { passive: true });
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      for (const ancestor of scrollAncestors) {
        ancestor.removeEventListener('scroll', apply);
      }
      target.style.removeProperty(property);
    };
  };
}
