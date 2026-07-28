/**
 * Pure scroll geometry for Scroller — no DOM, no Svelte, so every rule below is
 * unit-testable in the fast `node` suite.
 *
 * All positions are **content coordinates**: the distance from the scroll
 * container's content origin, i.e. what `scrollLeft` addresses. The component
 * derives them from `getBoundingClientRect()` deltas rather than `offsetLeft`,
 * so they stay correct regardless of which ancestor happens to be the
 * `offsetParent`.
 */

/** Where an item comes to rest when the row snaps. */
export type ScrollerAlign = 'start' | 'center';

/** One item's extent along the scroll axis, in content coordinates. */
export interface ScrollerItemMetrics {
  /** Leading edge, measured from the content origin. */
  start: number;
  /** Extent along the scroll axis. */
  size: number;
}

/**
 * The point an item is snapped TO: its leading edge for `start`, its midpoint
 * for `center`.
 */
function anchorOf(item: ScrollerItemMetrics, align: ScrollerAlign): number {
  return align === 'center' ? item.start + item.size / 2 : item.start;
}

/**
 * Index of the item the row is currently resting on — what the dots mark with
 * `aria-current` and what a `center` step navigates from.
 *
 * Compares against each item's **reachable** scroll target, not its raw anchor,
 * and that distinction is the whole point. With `align="start"` the last items
 * sit further right than `scrollLeft` can ever reach: a five-item row 1344px
 * wide in a 664px viewport tops out at 680, while item 5 begins at 1088. Judging
 * by the raw anchor made those items permanently unreachable, so their dots
 * never lit up — at the right-hand end the row highlighted item 3 while items 4
 * and 5 were the ones on screen, and clicking dot 5 visibly landed elsewhere.
 * Clamping each target into `[0, maxScroll]` puts every dot back in play.
 *
 * Ties resolve to the LATER item: at the end of the row several items share the
 * clamped target `maxScroll`, and the one the user has scrolled *to* is the last
 * of them. (Mid-row ties — resting exactly between two neighbours — likewise
 * resolve forwards, in the direction of travel.) Deterministic either way, so
 * the indicator never flickers.
 *
 * Returns `-1` for an empty row so callers cannot mistake "nothing here" for
 * "the first one".
 */
export function activeItemIndex(
  items: readonly ScrollerItemMetrics[],
  scrollStart: number,
  viewportSize: number,
  align: ScrollerAlign,
  maxScroll: number
): number {
  if (items.length === 0) return -1;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index] of items.entries()) {
    const target = clampScroll(scrollTargetForIndex(items, index, viewportSize, align), maxScroll);
    const distance = Math.abs(target - scrollStart);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/** Confine a scroll target to what the container can actually reach. */
function clampScroll(target: number, maxScroll: number): number {
  return Math.max(0, Math.min(maxScroll, target));
}

/**
 * Scroll position that brings `index` to the snap anchor — the target of a dot
 * click.
 *
 * Deliberately NOT clamped to the scrollable range: `scrollTo` clamps for us,
 * and clamping here would need `scrollWidth`, which this module has no business
 * knowing. For a `center` row the first and last items only reach the middle
 * because the component pads the track (see `scroller.variants.ts`); without
 * that padding the browser's own clamp silently wins and the card rests at the
 * edge — the classic centred-carousel bug.
 */
export function scrollTargetForIndex(
  items: readonly ScrollerItemMetrics[],
  index: number,
  viewportSize: number,
  align: ScrollerAlign
): number {
  const item = items[index];
  if (!item) return 0;
  return anchorOf(item, align) - (align === 'center' ? viewportSize / 2 : 0);
}

/**
 * Scroll position for one press of the previous/next control.
 *
 * The unit of travel follows the alignment, because that is what the row's
 * geometry makes meaningful:
 *
 * - `start` — one **viewport** (the classic "next page" of a media row). A chip
 *   bar with thirty narrow chips would be tedious to step through one item at a
 *   time.
 * - `center` — one **item**, because in a centred row the middle IS the unit;
 *   paging by viewport would jump straight past it.
 */
export function scrollTargetForStep(
  items: readonly ScrollerItemMetrics[],
  scrollStart: number,
  viewportSize: number,
  align: ScrollerAlign,
  direction: 1 | -1,
  maxScroll: number
): number {
  if (align === 'start') return scrollStart + direction * viewportSize;

  const current = activeItemIndex(items, scrollStart, viewportSize, align, maxScroll);
  if (current === -1) return scrollStart;
  const next = Math.min(items.length - 1, Math.max(0, current + direction));
  return scrollTargetForIndex(items, next, viewportSize, align);
}

/**
 * Whether the row is scrolled to its leading / trailing end — drives the
 * disabled state of the controls.
 *
 * `epsilon` absorbs sub-pixel scroll positions: browsers report fractional
 * `scrollLeft` on fractional layouts and on zoomed viewports, so an exact
 * `scrollStart >= scrollSize - viewportSize` comparison would leave the "next"
 * button enabled at the very end, scrolling nowhere.
 */
export function scrollEdges(
  scrollStart: number,
  scrollSize: number,
  viewportSize: number,
  epsilon = 1
): { atStart: boolean; atEnd: boolean } {
  return {
    atStart: scrollStart <= epsilon,
    atEnd: scrollStart >= scrollSize - viewportSize - epsilon
  };
}
