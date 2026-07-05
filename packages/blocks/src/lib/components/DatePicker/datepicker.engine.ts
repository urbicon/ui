/**
 * Date formatting and parsing utilities for DatePicker.
 * Uses native Intl.DateTimeFormat — no external dependencies.
 *
 * @internal Engine functions are an internal API of the DatePicker
 * component. They are exported for testing and re-use by sibling
 * components in this package but are not part of the public surface;
 * the supported entry points are the `DatePicker` and `DateRangePicker`
 * Svelte components themselves.
 */

import type { DateRange } from '../Calendar/calendar.types';

export type DateFormatOptions = Intl.DateTimeFormatOptions;

const defaultFormat: DateFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
};

function isValid(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format a Date as a locale-aware string. Guards Invalid Date and Intl
 * errors with logging instead of silent fallback.
 */
export function formatDateInput(date: Date, locale: string, options?: DateFormatOptions): string {
  if (!isValid(date)) {
    console.warn('[DatePicker] formatDateInput received Invalid Date', { date, locale });
    return '';
  }
  try {
    return new Intl.DateTimeFormat(locale, options ?? defaultFormat).format(date);
  } catch (err) {
    console.warn('[DatePicker] Intl.DateTimeFormat failed — falling back to ISO', {
      locale,
      options,
      err
    });
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Format a date range. Deliberately concatenates the two halves with a
 * fixed " – " (U+2013, en-dash with spaces) separator instead of
 * `Intl.DateTimeFormat#formatRange`. The native API would collapse
 * shared components (year/month) and break round-trip parsing — the
 * range "Mar 15 – 22, 2026" cannot be split back into two valid dates
 * because the first half has no year. The fixed separator keeps
 * `formatDateRangeInput` and `parseDateRangeInput` symmetric.
 */
export function formatDateRangeInput(
  start: Date,
  end: Date,
  locale: string,
  options?: DateFormatOptions
): string {
  if (!isValid(start) || !isValid(end)) {
    console.warn('[DatePicker] formatDateRangeInput received Invalid Date', { start, end, locale });
    return '';
  }
  const fmt = options ?? defaultFormat;
  const s = formatDateInput(start, locale, fmt);
  const e = formatDateInput(end, locale, fmt);
  if (!s || !e) return '';
  return `${s} – ${e}`;
}

function buildLocaleMatcher(
  locale: string,
  options: DateFormatOptions
): { pattern: RegExp; fieldOrder: ('year' | 'month' | 'day')[] } | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    const probe = new Date(2024, 0, 5);
    parts = new Intl.DateTimeFormat(locale, options).formatToParts(probe);
  } catch (err) {
    console.warn('[DatePicker] buildLocaleMatcher failed to construct Intl formatter', {
      locale,
      options,
      err
    });
    return null;
  }
  const fieldOrder: ('year' | 'month' | 'day')[] = [];
  let pattern = '^\\s*';
  for (const part of parts) {
    if (part.type === 'day') {
      pattern += '([\\p{Nd}]{1,2})';
      fieldOrder.push('day');
    } else if (part.type === 'month') {
      pattern += '([\\p{Nd}]{1,2})';
      fieldOrder.push('month');
    } else if (part.type === 'year') {
      pattern += '([\\p{Nd}]{2,4})';
      fieldOrder.push('year');
    } else if (part.type === 'literal') {
      pattern += part.value
        .replace(/[‎‏]/g, '') // strip RTL/LTR direction marks
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s*');
    }
  }
  pattern += '\\s*$';
  if (fieldOrder.length !== 3) {
    console.warn(
      '[DatePicker] locale mask is not purely numeric — typed input will fall back to ISO',
      { locale, options, fieldOrder, parts }
    );
    return null;
  }
  try {
    return { pattern: new RegExp(pattern, 'u'), fieldOrder };
  } catch (err) {
    console.warn('[DatePicker] buildLocaleMatcher built an invalid RegExp', {
      locale,
      pattern,
      err
    });
    return null;
  }
}

/**
 * Convert Unicode digits (Arabic-Indic, Persian, Devanagari, etc.) into
 * an integer. `parseInt` only handles ASCII; for `\p{Nd}` matches we
 * need to normalise via Unicode code-point arithmetic.
 */
function parseUnicodeDigits(s: string): number {
  let result = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) return NaN;
    // Use Number constructor — covers all Unicode decimal digit blocks
    // via the JS spec's StringToNumber on a single-codepoint string.
    const digit = Number(ch);
    if (Number.isNaN(digit)) return NaN;
    result = result * 10 + digit;
  }
  return result;
}

function parseLocaleDate(input: string, locale: string, options: DateFormatOptions): Date | null {
  const matcher = buildLocaleMatcher(locale, options);
  if (!matcher) return null;
  const match = matcher.pattern.exec(input);
  if (!match) return null;
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  matcher.fieldOrder.forEach((field, i) => {
    const n = parseUnicodeDigits(match[i + 1]);
    if (field === 'year') year = n;
    else if (field === 'month') month = n;
    else day = n;
  });
  if (year === undefined || month === undefined || day === undefined) return null;
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  if (year < 100) {
    // 2-digit year — pivot ±50 around the current year. Warn so DOB-flow
    // bugs surface quickly: a user typing "01.01.74" in 2026 gets 2074,
    // probably not what they meant.
    const original = year;
    const now = new Date().getFullYear();
    const century = Math.floor(now / 100) * 100;
    year = year + century;
    if (year - now > 50) year -= 100;
    else if (now - year > 50) year += 100;
    console.warn(
      '[DatePicker] 2-digit year expanded via pivot — pass a 4-digit year to avoid ambiguity',
      { input: original, resolved: year }
    );
  }
  const monthIndex = month - 1;
  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Parse a single date from user input. Tries the locale's formatted mask
 * first (built via `Intl.DateTimeFormat#formatToParts`), then a strict
 * YYYY-MM-DD ISO fallback parsed in LOCAL timezone. Returns `null` for
 * anything that can't be unambiguously parsed.
 *
 * Supports any locale whose default mask is purely numeric (day, month,
 * year). Locales with non-numeric month names (`month: 'long'`),
 * weekday literals, or non-Gregorian calendars are NOT parseable — the
 * caller should rely on calendar-picker UX or accept ISO input only.
 */
export function parseDateInput(
  input: string,
  locale: string,
  options?: DateFormatOptions
): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const localeResult = parseLocaleDate(trimmed, locale, options ?? defaultFormat);
  if (localeResult) return localeResult;
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }
  return null;
}

/**
 * Range separator: only splits on UNAMBIGUOUS separators.
 *
 * - U+2013 EN DASH, U+2212 MINUS SIGN, U+2014 EM DASH: always treated
 *   as range separators (none of these appear inside a date component).
 * - Hyphen / slash / "bis" / "to": only when surrounded by whitespace,
 *   so `15.03.2026 - 22.03.2026` splits but `15/03/2026` (a locale's
 *   intra-date separator) stays whole.
 * - Comma: requires whitespace on at least one side.
 */
const rangeSeparator = /\s+(?:-|\/|bis|to)\s+|\s*,\s+|\s*[–—−]\s*/i;

/**
 * Parse a date range string like "15.03.2026 – 22.03.2026". Splits on
 * the locale-aware range separator and parses each half with `parseDateInput`.
 * A single date with no separator is accepted as a single-day range
 * (`{ start: d, end: d }`). Rejects inverted ranges (start after end).
 */
export function parseDateRangeInput(
  input: string,
  locale: string,
  options?: DateFormatOptions
): DateRange | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(rangeSeparator);
  if (parts.length === 1) {
    const single = parseDateInput(parts[0], locale, options);
    return single ? { start: single, end: single } : null;
  }
  if (parts.length !== 2) return null;
  const start = parseDateInput(parts[0], locale, options);
  const end = parseDateInput(parts[1], locale, options);
  if (!start || !end) return null;
  if (start.getTime() > end.getTime()) return null;
  return { start, end };
}

export interface DateConstraints {
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  isDateDisabled?: (date: Date) => boolean;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Centralised predicate that respects min/max/disabledDates/isDateDisabled.
 * Used by both calendar clicks and typed input so they validate identically.
 *
 * Defensive against bad inputs:
 * - Invalid `minDate` / `maxDate` are ignored with a warning instead of
 *   silently disabling the constraint.
 * - Invalid entries in `disabledDates` are skipped with a warning.
 * - Throws from `isDateDisabled` are caught and logged; the date is
 *   then treated as allowed so a faulty predicate can't take the picker
 *   down.
 *
 * Note: if `minDate > maxDate` after stripping time, every date is
 * out-of-range. We warn once on that configuration to surface the bug.
 */
export function isDateAllowed(date: Date, constraints: DateConstraints): boolean {
  if (!isValid(date)) return false;
  const { minDate, maxDate, disabledDates, isDateDisabled } = constraints;

  let minBound: number | undefined;
  if (minDate) {
    if (!isValid(minDate)) {
      console.warn('[DatePicker] minDate is Invalid Date — ignoring constraint', { minDate });
    } else {
      minBound = stripTime(minDate).getTime();
    }
  }

  let maxBound: number | undefined;
  if (maxDate) {
    if (!isValid(maxDate)) {
      console.warn('[DatePicker] maxDate is Invalid Date — ignoring constraint', { maxDate });
    } else {
      maxBound = endOfDay(maxDate).getTime();
    }
  }

  if (minBound !== undefined && maxBound !== undefined && minBound > maxBound) {
    console.warn('[DatePicker] minDate > maxDate — no date will satisfy both constraints', {
      minDate,
      maxDate
    });
  }

  if (minBound !== undefined && date.getTime() < minBound) return false;
  if (maxBound !== undefined && date.getTime() > maxBound) return false;

  if (disabledDates) {
    for (const d of disabledDates) {
      if (!isValid(d)) {
        console.warn('[DatePicker] disabledDates contains Invalid Date — skipping entry', {
          entry: d
        });
        continue;
      }
      if (isSameDay(d, date)) return false;
    }
  }

  if (isDateDisabled) {
    try {
      if (isDateDisabled(date)) return false;
    } catch (err) {
      console.warn('[DatePicker] isDateDisabled callback threw — treating date as allowed', {
        date,
        err
      });
    }
  }

  return true;
}
