/**
 * The expand-back decision of SegmentGroup's overflow degradation, as a pure
 * function — the component reads layout, this decides on it.
 *
 * Why it can't be a plain "does it fit now?" check: collapsing switches the
 * group to `w-full` (segmentgroup.variants.ts), so its own box in the collapsed
 * state says nothing about the width it would get horizontally. Inside a
 * shrinking flex row the two states measure differently — squeezed at 120px
 * horizontally, stretched to 161px collapsed — and a check that reads the
 * group's own width flips between them forever, ~30 times a second.
 *
 * So the ruler has to be something the collapse cannot move: the host's content
 * box. And the question is not "is there room now?" (the host is wider than the
 * group's share, so that is always yes) but "has the host grown by at least what
 * was missing?".
 */

/** What the group measured in the horizontal moment right before it collapsed. */
export interface CollapseMark {
  /** Width the horizontal track needs, including the group's own padding. */
  naturalWidth: number;
  /** Content width the group actually had — i.e. what it fell short of. */
  availWidth: number;
  /** Host content width at that moment, the collapse-independent reference. */
  hostWidth: number;
}

/**
 * True when the host has gained at least the width the horizontal track was
 * missing, so the group can try the track again.
 *
 * Deliberately optimistic about *where* that growth went: if a sibling ate it,
 * the group re-collapses on the next measure and records a fresh mark — one
 * wasted frame, and it converges. Being pessimistic instead would need to model
 * the parent's flex distribution, which is not knowable from here.
 */
export function hostHasRoomAgain(mark: CollapseMark, hostWidth: number): boolean {
  return hostWidth - mark.hostWidth >= mark.naturalWidth - mark.availWidth;
}
