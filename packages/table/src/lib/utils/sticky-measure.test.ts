// @vitest-environment jsdom
//
// The writer side of sticky pinning: `variants/table.sticky.test.ts` pins the
// `top-[calc(var(…))]` strings that *read* these custom properties, and nothing
// pinned what gets written into them (#272).
//
// jsdom has no layout engine, so every reading is stubbed: `getBoundingClientRect`
// per element, a controllable `ResizeObserver`, `innerHeight` and `scrollY` on the
// window. That makes the rig itself the thing most likely to be wrong, so every
// assertion below is paired with a positive control run through the *same* rig —
// usually the implementation this file replaced, kept verbatim at the bottom, so
// each control shows the rig catching the defect it is there to prevent.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { measureToCssVar, measureViewportOffsetTop } from './sticky-measure';

const PROP = '--blocks-table-thead-h';
const TOP_PROP = '--blocks-table-avail-top';
const VIEWPORT_HEIGHT = 768;

// ── rig ─────────────────────────────────────────────────────────────────────

type SizeEntry = { contentHeight: number; borderHeight?: number };

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
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

/** Fix an element's box; only the two numbers this module reads are meaningful. */
function stubBox(element: HTMLElement, box: { top?: number; height?: number }) {
  const top = box.top ?? 0;
  const height = box.height ?? 0;
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

let originalResizeObserver: typeof ResizeObserver;

beforeEach(() => {
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  FakeResizeObserver.instances = [];
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

// ── 1. rounding ─────────────────────────────────────────────────────────────

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
    const legacyCleanup = legacyMeasureToCssVar(PROP)(legacy.measured);
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

// ── 2. one box ──────────────────────────────────────────────────────────────

describe('measureToCssVar — the measured box', () => {
  // The invariant, not two separate values: whatever box the module decides to
  // measure, the reading it takes on attach and the reading it takes from the
  // observer have to be the same one. They diverged the moment a consumer put
  // padding on the toolbar via `slotClasses.toolbar` — first paint pinned the
  // thead 32px too low, the next frame 32px too high.
  const CONTENT_HEIGHT = 100;
  const BORDER_HEIGHT = 132; // + p-4 on both sides

  it('reads the same box on attach and from the observer', () => {
    const { container, measured } = buildRig();
    stubBox(measured, { height: BORDER_HEIGHT });

    const cleanup = measureToCssVar(PROP)(measured);
    const onAttach = container.style.getPropertyValue(PROP);

    FakeResizeObserver.watching(measured)?.emit(measured, {
      contentHeight: CONTENT_HEIGHT,
      borderHeight: BORDER_HEIGHT
    });
    const fromObserver = container.style.getPropertyValue(PROP);
    cleanup();

    expect(fromObserver).toBe(onAttach);
    expect(onAttach).toBe(`${BORDER_HEIGHT}px`);

    // Positive control: same rig, same entry, the implementation this replaced —
    // it read the border box on attach and the content box from the observer,
    // and the rig sees the two disagree.
    const legacy = buildRig();
    stubBox(legacy.measured, { height: BORDER_HEIGHT });
    const legacyCleanup = legacyMeasureToCssVar(PROP)(legacy.measured);
    const legacyOnAttach = legacy.container.style.getPropertyValue(PROP);
    FakeResizeObserver.watching(legacy.measured)?.emit(legacy.measured, {
      contentHeight: CONTENT_HEIGHT,
      borderHeight: BORDER_HEIGHT
    });
    const legacyFromObserver = legacy.container.style.getPropertyValue(PROP);
    legacyCleanup();

    expect(legacyOnAttach).toBe(`${BORDER_HEIGHT}px`);
    expect(legacyFromObserver).toBe(`${CONTENT_HEIGHT}px`);
    expect(legacyFromObserver).not.toBe(legacyOnAttach);
  });

  it('falls back to the rect when an entry carries no borderBoxSize', () => {
    const { container, measured } = buildRig();
    stubBox(measured, { height: BORDER_HEIGHT });

    const cleanup = measureToCssVar(PROP)(measured);

    // Positive control for the fallback path itself: move the box *before*
    // emitting, so a value that came from the attach-time reading instead of
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
});

// ── 3. viewport offset ──────────────────────────────────────────────────────

describe('measureViewportOffsetTop', () => {
  const SCROLL_POSITIONS = [0, 500, 1500, 2500];

  it('does not walk with the page scroll under a pinned ancestor', () => {
    // Measured in Chrome with a `position: sticky; top: 0` ancestor: the
    // container's `rect.top` stayed 0 at every scroll position (that is the
    // ancestor being pinned), while the written value followed `scrollY` up to
    // 2500 — at which point `calc(100dvh - 2500px)` is negative and the table
    // collapses to zero height.
    const { container } = buildRig();
    stubBox(container, { top: 0, height: 400 });

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
    // implementation this replaced — the rig does see the value walk.
    const legacy = buildRig();
    stubBox(legacy.container, { top: 0, height: 400 });
    const legacyCleanup = legacyMeasureViewportOffsetTop(TOP_PROP)(legacy.container);
    const legacyWritten: string[] = [];
    for (const scrollY of SCROLL_POSITIONS) {
      setScrollY(scrollY);
      window.dispatchEvent(new Event('resize'));
      legacyWritten.push(legacy.container.style.getPropertyValue(TOP_PROP));
    }
    legacyCleanup();

    expect(legacyWritten).toEqual(['0px', '500px', '1500px', '2500px']);
  });

  it('can never write a value that makes the cap negative', () => {
    // The cap is `max-height: calc(100dvh - <written>)`, so anything at or past
    // the viewport height is a table of zero height. Sweeping the box through
    // and past the viewport bottom, including the readings taken while it sits
    // entirely below it.
    const TOPS = [0, 100, 400, 760, 768, 900, 2500];
    const { container } = buildRig();
    stubBox(container, { top: 0, height: 400 });

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
    // The last good reading is held rather than replaced by a useless one.
    expect(written).toEqual([0, 100, 400, 760, 760, 760, 760]);

    // Positive control: the same sweep through the implementation this
    // replaced, whose writes run straight past the viewport height.
    const legacy = buildRig();
    stubBox(legacy.container, { top: 0, height: 400 });
    const legacyCleanup = legacyMeasureViewportOffsetTop(TOP_PROP)(legacy.container);
    const legacyWritten: number[] = [];
    for (const top of TOPS) {
      stubBox(legacy.container, { top, height: 400 });
      window.dispatchEvent(new Event('resize'));
      legacyWritten.push(Number.parseFloat(legacy.container.style.getPropertyValue(TOP_PROP)));
    }
    legacyCleanup();

    expect(legacyWritten.some((value) => value >= VIEWPORT_HEIGHT)).toBe(true);
  });

  it('re-measures when a nested scrollport scrolls, but not on page scroll', () => {
    const scrollport = document.createElement('div');
    scrollport.style.overflowY = 'auto';
    document.body.append(scrollport);
    const { container } = buildRig(scrollport);
    stubBox(container, { top: 300, height: 400 });

    const cleanup = measureViewportOffsetTop(TOP_PROP)(container);
    expect(container.style.getPropertyValue(TOP_PROP)).toBe('300px');

    stubBox(container, { top: 120, height: 400 });
    scrollport.dispatchEvent(new Event('scroll'));
    const afterNestedScroll = container.style.getPropertyValue(TOP_PROP);

    // The page scroller is deliberately not listened to: the written value
    // drives the container's own max-height, which changes the document height,
    // and re-measuring on page scroll would close that loop.
    stubBox(container, { top: 40, height: 400 });
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
    const afterPageScroll = container.style.getPropertyValue(TOP_PROP);
    cleanup();

    expect(afterNestedScroll).toBe('120px');
    expect(afterPageScroll).toBe('120px');
  });

  it('observes both the body and the pane above it, and stops on cleanup', () => {
    // Content appearing above the table shows up in different boxes depending on
    // the shell: the body box grows in a document-scrolling page, while in a
    // shell whose pane is content-height the body never moves and the pane does.
    // Both are observed, which is what the two assertions below separate — the
    // rig has to hold the pane and the body apart, so the container is *not* a
    // child of the body here.
    const pane = document.createElement('div');
    document.body.append(pane);
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

// ── the implementation these tests replaced, kept as the positive control ────
//
// Verbatim from the pre-#272 module, so the controls above exercise the real
// defects and not a paraphrase of them. It is not imported anywhere else.

function legacyMeasureToCssVar(property: string, targetSelector = '[data-table-container]') {
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

function legacyMeasureViewportOffsetTop(
  property: string,
  targetSelector = '[data-table-container]'
) {
  return (element: HTMLElement) => {
    const target =
      (element.closest(targetSelector) as HTMLElement | null) ?? (element as HTMLElement);

    const apply = () => {
      const offset = element.getBoundingClientRect().top + window.scrollY;
      target.style.setProperty(property, `${Math.max(0, Math.round(offset))}px`);
    };

    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(document.body);
    window.addEventListener('resize', apply);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      target.style.removeProperty(property);
    };
  };
}
