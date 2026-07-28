import { describe, expect, it } from 'vitest';
import {
  activeItemIndex,
  type ScrollerItemMetrics,
  scrollEdges,
  scrollTargetForIndex,
  scrollTargetForStep
} from './scroller.utils';

// Pure geometry — no DOM. These are the rules the component's dots, jump
// buttons and disabled-edge states are derived from, so a regression here is a
// visible interaction bug even when the markup tests still pass.

/** Five 200px items with a 20px gap, laid out from `offset`. */
function row(count = 5, size = 200, gap = 20, offset = 0): ScrollerItemMetrics[] {
  return Array.from({ length: count }, (_, i) => ({
    start: offset + i * (size + gap),
    size
  }));
}

describe('activeItemIndex', () => {
  it('returns -1 for an empty row rather than pretending the first item is active', () => {
    expect(activeItemIndex([], 0, 600, 'start')).toBe(-1);
    expect(activeItemIndex([], 0, 600, 'center')).toBe(-1);
  });

  it('start: tracks the item whose leading edge sits closest to the scroll origin', () => {
    const items = row();
    expect(activeItemIndex(items, 0, 600, 'start')).toBe(0);
    expect(activeItemIndex(items, 220, 600, 'start')).toBe(1);
    expect(activeItemIndex(items, 880, 600, 'start')).toBe(4);
  });

  it('start: a scroll position between two items resolves to the nearer one', () => {
    const items = row();
    // Between item 0 (0) and item 1 (220): 90 is nearer to 0, 130 nearer to 220.
    expect(activeItemIndex(items, 90, 600, 'start')).toBe(0);
    expect(activeItemIndex(items, 130, 600, 'start')).toBe(1);
  });

  it('center: tracks the item whose midpoint sits closest to the viewport midpoint', () => {
    // Centred track: 600px viewport, 200px items → 200px of edge padding.
    const items = row(5, 200, 20, 200);
    // Scroll 0 → viewport midpoint 300 → item 0 spans 200–400, midpoint 300.
    expect(activeItemIndex(items, 0, 600, 'center')).toBe(0);
    // One item further along (220px of travel).
    expect(activeItemIndex(items, 220, 600, 'center')).toBe(1);
    expect(activeItemIndex(items, 880, 600, 'center')).toBe(4);
  });

  it('breaks an exact tie towards the leading item, so the indicator cannot flicker', () => {
    // Two items whose anchors are equidistant from the scroll origin.
    const items: ScrollerItemMetrics[] = [
      { start: 0, size: 100 },
      { start: 200, size: 100 }
    ];
    expect(activeItemIndex(items, 100, 600, 'start')).toBe(0);
  });
});

describe('scrollTargetForIndex', () => {
  it('start: scrolls the item flush to the origin', () => {
    expect(scrollTargetForIndex(row(), 2, 600, 'start')).toBe(440);
  });

  it('center: places the item midpoint at the viewport midpoint', () => {
    const items = row(5, 200, 20, 200);
    // Item 2 spans 640–840, midpoint 740; 740 − 300 = 440.
    expect(scrollTargetForIndex(items, 2, 600, 'center')).toBe(440);
  });

  it('center: the FIRST item resolves to 0 exactly — the edge padding is what makes that true', () => {
    // This is the centred-carousel bug in a single assertion. With the track
    // padded by (viewport − item) / 2, item 0's centred target is the scroll
    // origin, so it really can rest in the middle. Without that padding the
    // target would be negative, the browser would clamp it to 0, and the card
    // would sit at the left edge forever.
    const padding = (600 - 200) / 2;
    const padded = row(5, 200, 20, padding);
    expect(scrollTargetForIndex(padded, 0, 600, 'center')).toBe(0);

    const unpadded = row(5, 200, 20, 0);
    expect(scrollTargetForIndex(unpadded, 0, 600, 'center')).toBeLessThan(0);
  });

  it('returns 0 for an out-of-range index instead of NaN', () => {
    expect(scrollTargetForIndex(row(), 99, 600, 'start')).toBe(0);
    expect(scrollTargetForIndex([], 0, 600, 'center')).toBe(0);
  });
});

describe('scrollTargetForStep', () => {
  it('start: travels one viewport per press', () => {
    const items = row();
    expect(scrollTargetForStep(items, 0, 600, 'start', 1)).toBe(600);
    expect(scrollTargetForStep(items, 600, 600, 'start', -1)).toBe(0);
  });

  it('center: travels one ITEM per press — a viewport would jump straight past the middle', () => {
    const items = row(5, 200, 20, 200);
    expect(scrollTargetForStep(items, 0, 600, 'center', 1)).toBe(220);
    expect(scrollTargetForStep(items, 220, 600, 'center', -1)).toBe(0);
  });

  it('center: clamps at both ends instead of walking off the row', () => {
    const items = row(5, 200, 20, 200);
    expect(scrollTargetForStep(items, 0, 600, 'center', -1)).toBe(0);
    // 880 = last item centred; stepping further must stay there.
    expect(scrollTargetForStep(items, 880, 600, 'center', 1)).toBe(880);
  });

  it('center: an empty row stays put', () => {
    expect(scrollTargetForStep([], 42, 600, 'center', 1)).toBe(42);
  });
});

describe('scrollEdges', () => {
  it('reports both ends of a row that overflows', () => {
    expect(scrollEdges(0, 1080, 600)).toEqual({ atStart: true, atEnd: false });
    expect(scrollEdges(300, 1080, 600)).toEqual({ atStart: false, atEnd: false });
    expect(scrollEdges(480, 1080, 600)).toEqual({ atStart: false, atEnd: true });
  });

  it('absorbs sub-pixel scroll positions at the trailing end', () => {
    // Browsers report fractional scrollLeft on fractional layouts; without the
    // epsilon the "next" button stays enabled at the very end and scrolls
    // nowhere.
    expect(scrollEdges(479.6, 1080, 600).atEnd).toBe(true);
    expect(scrollEdges(0.4, 1080, 600).atStart).toBe(true);
  });

  it('reports a row that does not overflow as being at BOTH ends', () => {
    // Drives `controls="always"`: with nothing to scroll, both buttons are
    // disabled rather than silently doing nothing.
    expect(scrollEdges(0, 600, 600)).toEqual({ atStart: true, atEnd: true });
  });
});
