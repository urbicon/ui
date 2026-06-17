/**
 * Date comparison predicates and time-stripping helpers.
 *
 * All functions operate on **local** calendar days (no UTC conversion), so a
 * `Date` constructed in the user's timezone compares the way they see it on a
 * wall calendar. Part of the Svelte-free, server-capable `@urbicon-ui/blocks/date`
 * layer.
 */

/** Strip the time component, returning local midnight of the same calendar day. */
export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Check whether two dates fall on the same calendar day (ignoring time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Check whether a date is a weekend day (Saturday or Sunday).
 *
 * Weekend is defined as Saturday + Sunday regardless of `weekStartsOn` — the
 * day a week is laid out from does not change which days are non-working. A
 * locale-specific weekend (e.g. Friday + Saturday) is intentionally out of
 * scope; add an explicit option if a consumer ever needs it.
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Check whether a date falls within a range (inclusive on both ends, order-independent). */
export function isInRange(date: Date, start: Date, end: Date): boolean {
  const d = stripTime(date).getTime();
  const s = stripTime(start).getTime();
  const e = stripTime(end).getTime();
  return d >= Math.min(s, e) && d <= Math.max(s, e);
}

/** Check whether a date belongs to the given month and year. */
export function isInMonth(date: Date, month: number, year: number): boolean {
  return date.getMonth() === month && date.getFullYear() === year;
}

/**
 * DST-safe count of whole calendar days from `a` to `b`.
 * Positive when `b` is after `a`. Computed via UTC midnight to avoid
 * daylight-saving hour shifts skewing the division.
 */
export function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}
