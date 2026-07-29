import { describe, expect, it } from 'vitest';
import {
  activeItemIndex,
  restingPositions,
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
  // A 5×200 row with 20px gaps spans 1080; in a 600px viewport that leaves
  // 480px of travel. Items 4 and 5 begin at 660 and 880 — beyond the end of the
  // scroll range — which is what the clamping below is about.
  const START_MAX = 1080 - 600;

  it('returns -1 for an empty row rather than pretending the first item is active', () => {
    expect(activeItemIndex([], 0, 600, 'start', 0)).toBe(-1);
    expect(activeItemIndex([], 0, 600, 'center', 0)).toBe(-1);
  });

  it('start: tracks the item whose leading edge sits closest to the scroll origin', () => {
    const items = row();
    expect(activeItemIndex(items, 0, 600, 'start', START_MAX)).toBe(0);
    expect(activeItemIndex(items, 220, 600, 'start', START_MAX)).toBe(1);
  });

  it('start: the LAST item is active at the end of the row', () => {
    // The defect this clamping fixes. Item 5 begins at 880 but scrollLeft tops
    // out at 480, so judging by the raw anchor its dot could never light up —
    // the row highlighted item 3 while items 4 and 5 were the ones on screen,
    // and clicking dot 5 visibly landed somewhere else.
    const items = row();
    expect(activeItemIndex(items, START_MAX, 600, 'start', START_MAX)).toBe(4);
  });

  it('start: reaches the first and last item, and never moves backwards', () => {
    // The two guarantees that actually hold for one-dot-per-item on a
    // start-aligned row.
    //
    // What does NOT hold, and cannot: every item having its own turn. Items
    // whose targets both clamp to `maxScroll` are indistinguishable by scroll
    // position — with these numbers items 4 and 5 share the end of the row, so
    // only the later of them is ever reported and dot 4 stays dark. That is
    // inherent to the pattern, not a defect in this function: a start-aligned
    // row showing several items at once has fewer distinct resting places than
    // it has items. `align="center"` has no such collapse, because its edge
    // padding makes every item's target reachable.
    const items = row();
    const seen: number[] = [];
    for (let s = 0; s <= START_MAX; s += 5) {
      seen.push(activeItemIndex(items, s, 600, 'start', START_MAX));
    }

    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(items.length - 1);
    // Monotonic: scrolling forward never lights an earlier dot.
    expect(seen.every((v, i) => i === 0 || v >= (seen[i - 1] as number))).toBe(true);
  });

  it('center: every item gets its own turn — no collapse at the end', () => {
    const items = row(5, 200, 20, 200);
    const max = 200 * 2 + 5 * 200 + 4 * 20 - 600;
    const reached = new Set<number>();
    for (let s = 0; s <= max; s += 5) {
      reached.add(activeItemIndex(items, s, 600, 'center', max));
    }
    expect([...reached].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('center: tracks the item whose midpoint sits closest to the viewport midpoint', () => {
    // Centred track: 600px viewport, 200px items → 200px of edge padding.
    const items = row(5, 200, 20, 200);
    const max = 200 * 2 + 5 * 200 + 4 * 20 - 600;
    // Scroll 0 → viewport midpoint 300 → item 0 spans 200–400, midpoint 300.
    expect(activeItemIndex(items, 0, 600, 'center', max)).toBe(0);
    // One item further along (220px of travel).
    expect(activeItemIndex(items, 220, 600, 'center', max)).toBe(1);
    expect(activeItemIndex(items, 880, 600, 'center', max)).toBe(4);
  });

  it('breaks a tie towards the LATER item — the direction of travel', () => {
    // Two items whose targets are equidistant from the current position. The
    // one the user has scrolled towards wins; at the end of a row several items
    // share the clamped target, and there the later one is the one on screen.
    const items: ScrollerItemMetrics[] = [
      { start: 0, size: 100 },
      { start: 200, size: 100 }
    ];
    expect(activeItemIndex(items, 100, 600, 'start', 200)).toBe(1);
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
  const CENTRE_MAX = 200 * 2 + 5 * 200 + 4 * 20 - 600;

  it('start: travels one viewport per press', () => {
    const items = row();
    expect(scrollTargetForStep(items, 0, 600, 'start', 1, 480)).toBe(600);
    expect(scrollTargetForStep(items, 600, 600, 'start', -1, 480)).toBe(0);
  });

  it('center: travels one ITEM per press — a viewport would jump straight past the middle', () => {
    const items = row(5, 200, 20, 200);
    expect(scrollTargetForStep(items, 0, 600, 'center', 1, CENTRE_MAX)).toBe(220);
    expect(scrollTargetForStep(items, 220, 600, 'center', -1, CENTRE_MAX)).toBe(0);
  });

  it('center: clamps at both ends instead of walking off the row', () => {
    const items = row(5, 200, 20, 200);
    expect(scrollTargetForStep(items, 0, 600, 'center', -1, CENTRE_MAX)).toBe(0);
    // 880 = last item centred; stepping further must stay there.
    expect(scrollTargetForStep(items, 880, 600, 'center', 1, CENTRE_MAX)).toBe(880);
  });

  it('center: an empty row stays put', () => {
    expect(scrollTargetForStep([], 42, 600, 'center', 1, 0)).toBe(42);
  });
});

describe('restingPositions', () => {
  it('start: collapses the trailing items that share the end of the scroll range', () => {
    // 5×200+gaps = 1080 content in a 600 viewport → maxScroll 480. Items 4 and
    // 5 begin at 660 and 880, both beyond 480 — one resting place for the two
    // of them, so the row has 4 places, not 5 dots' worth.
    const positions = restingPositions(row(), 600, 'start', 480);
    expect(positions).toEqual([
      { target: 0, firstIndex: 0, lastIndex: 0 },
      { target: 220, firstIndex: 1, lastIndex: 1 },
      { target: 440, firstIndex: 2, lastIndex: 2 },
      { target: 480, firstIndex: 3, lastIndex: 4 }
    ]);
  });

  it('center: is the identity — the edge padding makes every target reachable', () => {
    const items = row(5, 200, 20, 200);
    const max = 200 * 2 + 5 * 200 + 4 * 20 - 600;
    const positions = restingPositions(items, 600, 'center', max);
    expect(positions).toHaveLength(5);
    expect(positions.every((p) => p.firstIndex === p.lastIndex)).toBe(true);
    expect(positions.map((p) => p.target)).toEqual([0, 220, 440, 660, 880]);
  });

  it('returns nothing for an empty row', () => {
    expect(restingPositions([], 600, 'start', 0)).toEqual([]);
  });

  it('absorbs sub-pixel target differences into one place', () => {
    // Fractional layouts can put two targets a fraction apart; that is still
    // ONE place to rest, not two dots a hair's width from each other. Only the
    // anchors matter to this function, so the overlapping fixture is fine.
    const items: ScrollerItemMetrics[] = [
      { start: 0, size: 100 },
      { start: 0.5, size: 100 }
    ];
    expect(restingPositions(items, 600, 'start', 480)).toHaveLength(1);
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
