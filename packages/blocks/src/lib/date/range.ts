/**
 * Local-date range arithmetic and ISO-day-string conversion.
 *
 * `toIso` / `isoToDate` are the canonical, **strict** `YYYY-MM-DD` ↔ `Date`
 * pair for this layer: they round-trip a local calendar day with no UTC drift
 * (`new Date('2026-06-16')` would parse as UTC midnight — these never do that).
 * For tolerant, form-value coercion of arbitrary `DateInput` (strings, epoch
 * numbers, null) use `coerceToDate` / `toDateInputValue` from `$lib/utils/date`
 * instead.
 */

import { stripTime } from './compare';

/**
 * Add (or subtract, with a negative `days`) whole days to a date, preserving
 * the time-of-day. DST-safe at day granularity: `setDate` shifts the calendar
 * day and the engine normalises any non-existent wall-clock instant.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get local midnight of the first day of the week containing `date`.
 *
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon, ..., 6=Sat)
 */
export function startOfWeek(date: Date, weekStartsOn: number = 1): Date {
  const dayOfWeek = date.getDay();
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
}

/**
 * Get local midnight of the last day of the week containing `date`.
 *
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon, ..., 6=Sat)
 */
export function endOfWeek(date: Date, weekStartsOn: number = 1): Date {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

/**
 * List every local calendar day from `start` to `end`, inclusive.
 * Each entry is local midnight. Returns an empty array if `start` is after
 * `end` (an inverted range yields no days rather than throwing).
 */
export function eachDayOfRange(start: Date, end: Date): Date[] {
  const last = stripTime(end).getTime();
  const days: Date[] = [];
  let current = stripTime(start);
  while (current.getTime() <= last) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/**
 * Format a date as a `YYYY-MM-DD` string using its **local** calendar day.
 * The canonical key for date-indexed maps and the strict counterpart to
 * `isoToDate`. Never converts to UTC, so it is off-by-one-safe across timezones.
 */
export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a date as a `YYYY-MM-DDTHH:mm` string using its **local** wall clock —
 * the machine-readable form of a `<time datetime>` attribute (HTML's "local date
 * and time string"). Local rather than UTC on purpose: it must agree with what
 * the neighbouring `Intl` output renders, and that is the local time too.
 */
export function toIsoDateTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${toIso(date)}T${h}:${min}`;
}

/**
 * Parse a strict `YYYY-MM-DD` string into a **local** midnight `Date`.
 * Validates both the format and that the day actually exists (rejects
 * `2026-02-30`), throwing a `RangeError` otherwise — a malformed day key is a
 * programming error, not a value to silently coerce. For tolerant parsing that
 * returns `null`, use `fromDateInputValue` from `$lib/utils/date`.
 */
export function isoToDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }
  throw new RangeError(
    `isoToDate expects a valid 'YYYY-MM-DD' string, got: ${JSON.stringify(iso)}`
  );
}
