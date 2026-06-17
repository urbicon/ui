/**
 * Date utilities for bridging form values, ISO strings, and `Date` objects.
 *
 * Components like {@link DatePicker} accept either a `Date` or an ISO
 * timestamp on input. When the surrounding state holds ISO strings (for
 * example because the database driver serialises timestamps that way),
 * use these helpers to convert in both directions instead of redoing the
 * arithmetic at every form site.
 */

/** Detect a finite, valid `Date` instance. */
function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/**
 * Reject numbers small enough to obviously not be epoch ms — typical
 * mis-use is passing a year (`2026`), a day index, or `42`. 100 000 ms
 * (≈ 100 s past 1970) is the smallest value that is still ambiguously a
 * real timestamp. Anything above this — including pre-2001 legitimate
 * timestamps like birthdays — is accepted.
 */
const AMBIGUOUS_NUMBER_THRESHOLD = 100_000;
const DATE_ONLY_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/** Shared union for utilities that accept any common "date-ish" input. */
export type DateInput = Date | string | number | null | undefined;

/** Month index used by `Date#getMonth()`. */
export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Weekday index used by `Date#getDay()`. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Coerce a `Date`, ISO timestamp, epoch-ms number, or empty value into a
 * `Date`. Returns `undefined` for empty / unparseable inputs.
 *
 * Shape rules:
 * - Strings of the form `YYYY-MM-DD` are parsed in LOCAL timezone
 *   (matching `<input type="date">` and `toDateInputValue` round-trip).
 * - Numbers smaller than ~100 s past epoch are rejected as ambiguous
 *   (programmer error — `2026` passed instead of a real timestamp).
 *   Legitimate pre-2001 epoch ms (e.g. birthdays) are accepted.
 * - Invalid `Date` instances and unparseable strings log a warning
 *   instead of disappearing silently.
 */
export function coerceToDate(input: DateInput): Date | undefined {
  if (input === null || input === undefined) return undefined;
  if (input instanceof Date) {
    if (isValidDate(input)) return input;
    console.warn('[DatePicker] coerceToDate received Invalid Date instance', { input });
    return undefined;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '') return undefined;
    const dateOnly = trimmed.match(DATE_ONLY_RE);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]) - 1;
      const day = Number(dateOnly[3]);
      const local = new Date(year, month, day);
      if (local.getFullYear() === year && local.getMonth() === month && local.getDate() === day) {
        return local;
      }
      console.warn('[DatePicker] coerceToDate rejected out-of-range date-only string', { input });
      return undefined;
    }
    const date = new Date(trimmed);
    if (!isValidDate(date)) {
      console.warn('[DatePicker] coerceToDate could not parse string', { input });
      return undefined;
    }
    return date;
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      console.warn('[DatePicker] coerceToDate received non-finite number', { input });
      return undefined;
    }
    if (Math.abs(input) < AMBIGUOUS_NUMBER_THRESHOLD) {
      console.warn(
        '[DatePicker] coerceToDate received an ambiguously small number — expected epoch ms',
        { input }
      );
      return undefined;
    }
    const date = new Date(input);
    return isValidDate(date) ? date : undefined;
  }
  return undefined;
}

/**
 * Format a date as the `YYYY-MM-DD` string accepted by
 * `<input type="date">` and the DatePicker text rendering. Returns
 * an empty string for null / invalid inputs so it can be assigned
 * directly to a form field's `value`.
 */
export function toDateInputValue(d: Date | string | null | undefined): string {
  const date = coerceToDate(d);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` (or any other `Date`-parseable) string into a
 * `Date`. `YYYY-MM-DD` is interpreted as LOCAL midnight to round-trip
 * with `toDateInputValue`; full ISO timestamps with timezone are passed
 * to the native parser unchanged. Returns `null` for empty or malformed
 * input so the caller decides how to surface the error.
 */
export function fromDateInputValue(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const dateOnly = trimmed.match(DATE_ONLY_RE);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
    console.warn('[DatePicker] fromDateInputValue rejected out-of-range date-only string', {
      input: s
    });
    return null;
  }
  const date = new Date(trimmed);
  if (!isValidDate(date)) {
    console.warn('[DatePicker] fromDateInputValue could not parse', { input: s });
    return null;
  }
  return date;
}
