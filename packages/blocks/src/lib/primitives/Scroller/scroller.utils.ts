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
 * The point in the viewport an anchor is snapped AT: the content origin for
 * `start`, the viewport midpoint for `center`.
 */
function viewportAnchor(scrollStart: number, viewportSize: number, align: ScrollerAlign): number {
  return align === 'center' ? scrollStart + viewportSize / 2 : scrollStart;
}

/**
 * Index of the item currently sitting closest to the snap anchor — what the
 * dots mark with `aria-current` and what a `center` step navigates from.
 *
 * Ties (two items equidistant from the anchor) resolve to the LEADING one:
 * scanning in document order and requiring a strict improvement means the
 * earlier item keeps the win, so the indicator never flickers between two
 * neighbours while a scroll rests exactly between them.
 *
 * Returns `-1` for an empty row so callers cannot mistake "nothing here" for
 * "the first one".
 */
export function activeItemIndex(
  items: readonly ScrollerItemMetrics[],
  scrollStart: number,
  viewportSize: number,
  align: ScrollerAlign
): number {
  if (items.length === 0) return -1;

  const target = viewportAnchor(scrollStart, viewportSize, align);
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, item] of items.entries()) {
    const distance = Math.abs(anchorOf(item, align) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
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
  direction: 1 | -1
): number {
  if (align === 'start') return scrollStart + direction * viewportSize;

  const current = activeItemIndex(items, scrollStart, viewportSize, align);
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
