// Pure decision logic for the ChatMessageList scroll engine — kept free of
// DOM/Svelte so the invariants are node-testable.
//
// Core idea: programmatic follow-scrolling only ever moves DOWN, so any UPWARD
// scroll movement is user intent and breaks the stick. Re-sticking happens by
// proximity: whoever scrolls back into the bottom zone follows again. This
// needs no "suppress programmatic scroll" flag and no event-source sniffing.

/** Scroll metrics of the viewport at one point in time. */
export interface ScrollSnapshot {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Distance from the bottom edge within which the user counts as "at the
 * bottom": entering it re-sticks, and tiny upward wiggles inside it (trackpad
 * inertia, macOS bounce) never unstick.
 */
export const RESTICK_PX = 24;

/** Minimum upward movement (px) that counts as deliberate user scrolling. */
const UPWARD_INTENT_PX = 1;

export function distanceFromBottom(snapshot: ScrollSnapshot): number {
  return Math.max(0, snapshot.scrollHeight - snapshot.scrollTop - snapshot.clientHeight);
}

/**
 * Classify one scroll event. `lastScrollTop` is the previous event's position.
 * Order matters: the bottom zone wins over direction, so bounce-back at the
 * bottom edge stays stuck.
 */
export function resolveScrollIntent(
  snapshot: ScrollSnapshot,
  lastScrollTop: number
): 'stick' | 'unstick' | 'none' {
  if (distanceFromBottom(snapshot) <= RESTICK_PX) return 'stick';
  if (snapshot.scrollTop < lastScrollTop - UPWARD_INTENT_PX) return 'unstick';
  return 'none';
}

/**
 * How the message list changed between two renders, judged purely from ids —
 * content growth inside an existing message (streaming) is deliberately NOT a
 * transition (the follow behaviour reacts to it via ResizeObserver instead).
 *
 * - `append`   — new messages at the end (feeds the new-messages counter).
 * - `prepend`  — older messages loaded at the top (needs the scroll anchor fix).
 * - `truncate` — trailing messages removed (stable head, shorter list): NOT an
 *   arrival, so it must never bump the counter (review finding, P2 wave).
 * - `replace`  — both ends changed or the list was reset (jump to bottom).
 * - `initial`  — first non-empty render (open at the bottom).
 * Simultaneous append+prepend degrades to `replace` — rare (history load
 * during streaming) and safe: worst case is one jump to the bottom.
 */
export type ListTransition = 'none' | 'initial' | 'append' | 'prepend' | 'truncate' | 'replace';

export interface ListIdSnapshot {
  firstId: string | undefined;
  lastId: string | undefined;
  length: number;
}

export function classifyTransition(prev: ListIdSnapshot, next: ListIdSnapshot): ListTransition {
  if (next.length === 0) return prev.length === 0 ? 'none' : 'replace';
  if (prev.length === 0) return 'initial';

  const firstStable = prev.firstId === next.firstId;
  const lastStable = prev.lastId === next.lastId;

  if (firstStable && lastStable && next.length === prev.length) return 'none';
  if (firstStable) return next.length < prev.length ? 'truncate' : 'append';
  if (lastStable) return 'prepend';
  return 'replace';
}

/**
 * New messages added by an `append` transition. A same-length append (the tail
 * message was swapped for a new id) still counts as one new message.
 */
export function appendedCount(prevLength: number, nextLength: number): number {
  return Math.max(1, nextLength - prevLength);
}
