/**
 * Pure item-bucketing for the Planner — the headless core of layer 2b.
 *
 * Groups a flat `T[]` into per-day buckets keyed by local ISO date
 * (`YYYY-MM-DD`), the single value Planner's `cell` snippet receives. Kept
 * Svelte-free and side-effect-free so it unit-tests without a DOM and stays the
 * one place the date→key normalisation lives.
 */

import { toIso } from '$lib/date';

/** Maps an item to its calendar day — a `Date` or a local ISO date string. */
export type GetItemDate<T> = (item: T) => Date | string;

/**
 * Derive the local `YYYY-MM-DD` bucket key for an item's date.
 *
 * A plain date string (`'2026-06-16'`, optionally with a time suffix) is sliced
 * to its date part **without** parsing — `new Date('2026-06-16')` would read it
 * as UTC midnight and shift a day west of Greenwich. Only non-ISO strings fall
 * back to `Date` parsing. A `Date` is reduced to its local calendar day. This
 * preserves the "everything local, never UTC" contract Planner inherits from
 * `@urbicon-ui/blocks/date`.
 */
export function toDateKey(raw: Date | string): string {
  if (typeof raw === 'string') {
    // Fast path: already a local ISO date (date-first) → take the day part verbatim.
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return toIso(new Date(raw));
  }
  return toIso(raw);
}

/**
 * Bucket `items` by their local calendar day.
 *
 * Returns a `Map` from local ISO date (`YYYY-MM-DD`) to the items on that day,
 * in input order. When `sort` is supplied each bucket is sorted in place,
 * giving the `cell` snippet a stable intra-day order (e.g. meal-type ordering).
 * Days with no items are simply absent from the map.
 */
export function bucketItemsByDate<T>(
  items: readonly T[],
  getDate: GetItemDate<T>,
  sort?: (a: T, b: T) => number
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = toDateKey(getDate(item));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  if (sort) {
    for (const bucket of buckets.values()) bucket.sort(sort);
  }
  return buckets;
}
