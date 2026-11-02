/**
 * The percent of the bar that each segment and the rest take.
 *
 * A non-zero segment below `minimum` is lifted to it, so it stays wide enough
 * to see and hover. Every other part, the rest included, gives up the space
 * that costs by one common factor, and stops where it would fall below its
 * floor: the minimum for a segment, its own share or the minimum, whichever is
 * smaller, for the rest. So no part ends up smaller than a lifted segment
 * unless it started smaller, and a rest below the minimum keeps its share.
 * When the floors alone would fill the bar there is no space to give, and the
 * raw shares stand.
 *
 * @param segments Each item's percent of the bar, `0` for an item that renders
 *   no segment. Together with `rest` they sum to 100.
 * @param rest The rest's percent of the bar, `0` without one.
 */
export function barShares(
  segments: readonly number[],
  rest: number,
  minimum: number
): { segments: number[]; rest: number } {
  const raw = { segments: [...segments], rest };
  if (minimum <= 0 || !segments.some((p) => p > 0 && p < minimum)) return raw;

  // The rest is the last part.
  const parts = [...segments, rest];
  const last = segments.length;
  const floors = parts.map((p, i) => (p <= 0 ? 0 : i === last ? Math.min(p, minimum) : minimum));
  if (floors.reduce((sum, floor) => sum + floor, 0) >= 100) return raw;

  // Pinning a part at its floor leaves less room for the others, which lowers
  // the factor and can pin another. Each round pins at least one part or ends.
  const pinned = parts.map((p, i) => p > 0 && p < floors[i]);
  let factor = 1;
  for (let changed = true; changed; ) {
    let room = 100;
    let free = 0;
    parts.forEach((p, i) => {
      if (pinned[i]) room -= floors[i];
      else free += p;
    });
    factor = room / free;
    changed = false;
    parts.forEach((p, i) => {
      if (!pinned[i] && p > 0 && p * factor < floors[i]) {
        pinned[i] = true;
        changed = true;
      }
    });
  }
  const shares = parts.map((p, i) => (pinned[i] ? floors[i] : p * factor));
  return { segments: shares.slice(0, last), rest: shares[last] };
}
