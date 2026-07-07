// Roving-focus index helpers for keyboard navigation across a set of items where
// some may be disabled. Shared by the button-based composite widgets (Tab,
// SegmentGroup): a disabled item there renders a native `<button disabled>`,
// which can't hold focus, so navigation must step over it — otherwise selection
// strands on an unfocusable item (aria state set, focus stuck on the previous
// one). RadioGroup doesn't use these: its items are native radios, so it filters
// with a `:not(:disabled)` DOM query the browser understands directly.
//
// Pure index math — the caller supplies `isDisabled(index)`; nothing here reads
// the DOM, so the edge cases (wrap-around, all-disabled, nothing-active) are
// unit-tested in isolation.

/**
 * The next enabled index walking `dir` (+1 / -1) from `from`, wrapping around.
 *
 * - `from` may be -1 (nothing active yet): the walk anchors just off the leading
 *   edge, so the first probe is index 0 for `dir` +1 and the last index for -1.
 * - Returns `from` when it is a valid index but every *other* item is disabled
 *   (nowhere to move — the caller's `next !== from` guard makes it a no-op).
 * - Returns -1 when there is no enabled item at all (or `length` is 0).
 */
export function nextEnabledIndex(
  length: number,
  from: number,
  dir: 1 | -1,
  isDisabled: (index: number) => boolean
): number {
  if (length <= 0) return -1;
  const inRange = from >= 0 && from < length;
  const anchored = inRange ? from : dir === 1 ? -1 : length;
  for (let i = 1; i <= length; i++) {
    const idx = (((anchored + dir * i) % length) + length) % length;
    if (!isDisabled(idx)) return idx;
  }
  return inRange ? from : -1;
}

/**
 * The first enabled index scanning from an edge: `dir` +1 from the start (Home),
 * -1 from the end (End). Returns -1 when every item is disabled.
 */
export function edgeEnabledIndex(
  length: number,
  dir: 1 | -1,
  isDisabled: (index: number) => boolean
): number {
  for (let i = 0; i < length; i++) {
    const idx = dir === 1 ? i : length - 1 - i;
    if (!isDisabled(idx)) return idx;
  }
  return -1;
}
