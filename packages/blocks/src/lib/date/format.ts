/**
 * Locale-aware date formatting built on the native `Intl.DateTimeFormat`.
 * No locale tables are bundled — output follows the runtime's ICU data for the
 * given BCP 47 locale tag.
 */

import { isSameDay } from './compare';
import { getWeekDates, getWeekNumber } from './geometry';

/**
 * Locale used when a caller passes none.
 *
 * Mirrors `BASE_LOCALE` from `@urbicon-ui/i18n` **by value, not by import** —
 * this module is the zero-dependency `./date` subpath and must not pull the i18n
 * package in for one string. If the base locale ever moves, this moves with it.
 *
 * It is a constant rather than `undefined` on purpose: `Intl` with `undefined`
 * follows the *runtime* locale, which differs between a Node server and the
 * user's browser — the same date would then render one way in the prerendered
 * HTML and another after hydration. A fixed tag renders identically on both
 * sides; the components layer the actual locale on top (see `Calendar.svelte`,
 * which reads `useI18n().locale`).
 *
 * Was `'de-DE'` until 2026-07-31, which made every app that did not pass
 * `locale` render German month names regardless of its own language.
 */
const DEFAULT_LOCALE = 'en';

/** Localized week-number labels for the `formatWeekTitle` prefix (e.g. "KW"). */
const WEEK_LABELS: Record<string, string> = {
  de: 'KW',
  en: 'Week',
  fr: 'Sem.',
  es: 'Sem.',
  it: 'Sett.',
  nl: 'Week',
  pt: 'Sem.'
};

/**
 * Get localized weekday names.
 *
 * @param locale - BCP 47 locale tag (e.g. 'de-DE')
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon)
 * @param format - Name format ('narrow'='M', 'short'='Mo', 'long'='Montag')
 * @returns Array of 7 weekday name strings, ordered from `weekStartsOn`
 */
export function getWeekdayNames(
  locale: string = DEFAULT_LOCALE,
  weekStartsOn: number = 1,
  format: 'narrow' | 'short' | 'long' = 'short'
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  const names: string[] = [];

  // Anchor on a known week (2026-01-04 is a Sunday, 2026-01-05 a Monday).
  const baseMonday = new Date(2026, 0, 5);
  const baseSunday = new Date(2026, 0, 4);

  const baseDate = weekStartsOn === 0 ? baseSunday : new Date(baseMonday);
  if (weekStartsOn > 1) {
    baseDate.setDate(baseDate.getDate() + (weekStartsOn - 1));
  }

  for (let i = 0; i < 7; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    names.push(formatter.format(date));
  }

  return names;
}

/** Format month and year for header display, e.g. "März 2026", "March 2026". */
export function formatMonthYear(
  year: number,
  month: number,
  locale: string = DEFAULT_LOCALE
): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

/** Format a date for a detail header, e.g. "Do, 12. März", "Thu, March 12". */
export function formatDate(
  date: Date,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  };
  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(date);
}

/** Format a date for a screen-reader label, e.g. "Donnerstag, 12. März 2026". */
export function formatDateFull(date: Date, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * Format a week title for a header, e.g. "KW 12 – März 2026" (de-DE) or
 * "Week 12 – March 2026" (en-US). Uses the week's Thursday to pick the
 * month/year (ISO week convention).
 */
export function formatWeekTitle(
  date: Date,
  weekStartsOn: number = 1,
  locale: string = DEFAULT_LOCALE
): string {
  const weekDates = getWeekDates(date, weekStartsOn);
  // ISO convention: Thursday decides the month/year the week belongs to.
  const thursday = weekDates[(4 - weekStartsOn + 7) % 7];
  const weekNum = getWeekNumber(thursday);

  const monthYear = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric'
  }).format(thursday);

  const lang = locale.split('-')[0];
  const weekLabel = WEEK_LABELS[lang] ?? 'Week';

  return `${weekLabel} ${weekNum} – ${monthYear}`;
}

/**
 * Format the date span of the week containing `date`, e.g. "15.–21. Juni"
 * (de-DE) or "Jun 15 – 21" (en-US). The exact shape — and whether the shared
 * month collapses — follows the locale via `Intl.DateTimeFormat.formatRange`.
 */
export function formatWeekRange(
  date: Date,
  locale: string = DEFAULT_LOCALE,
  weekStartsOn: number = 1
): string {
  const weekDates = getWeekDates(date, weekStartsOn);
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  return formatter.formatRange(weekDates[0], weekDates[6]);
}

/**
 * Format an arbitrary date span including the year, e.g. "15. Juni – 5. Juli
 * 2026" (de-DE). Collapses shared month/year parts per the locale via
 * `Intl.DateTimeFormat.formatRange`. Suited to a multi-week range-view title;
 * for a single ISO week prefer {@link formatWeekRange}.
 */
export function formatDateRange(start: Date, end: Date, locale: string = DEFAULT_LOCALE): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return formatter.formatRange(start, end);
}

/**
 * Format a day-view header, e.g. "Do, 19. März 2026" (de-DE) or
 * "Thu, March 19, 2026" (en-US).
 */
export function formatDayTitle(date: Date, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * `Intl.DateTimeFormat` instances for {@link formatTimeRange}, keyed by locale.
 *
 * The other helpers in this file build their formatter inline, because each runs
 * once per header, per grid or per year. `formatTimeRange` runs once per event
 * per recompute — a 30-day agenda of 200 appointments builds 200 of them, and
 * again on every locale change. Constructing one is the expensive half:
 * measured 2026-08-12 over 20 000 iterations, ~23 µs per construct+format
 * against ~0.5 µs for `format()` on an existing instance (Node 25.2.1; Bun 1.4
 * ~17 µs vs ~0.4 µs) — a 40-fold difference.
 *
 * Module-global and SSR-safe: the map holds no request state, only ICU data
 * that is identical for every caller of the same tag. Its size is the number of
 * distinct locale tags an app renders, so it does not grow with the data.
 */
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function getTimeFormatter(locale: string): Intl.DateTimeFormat {
  const cached = timeFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  timeFormatters.set(locale, formatter);
  return formatter;
}

/**
 * Format the clock time of an appointment, e.g. "9:05" / "09:05–10:30 Uhr"
 * (de-DE), "9:05 AM" / "9:05 – 10:30 AM" (en-US).
 *
 * The shape is the locale's own, not a hardcoded 24-hour string: the hour cycle,
 * the separator, the zero-padding and any suffix all come from ICU via
 * `Intl.DateTimeFormat`. That is also why the two arms of one locale can look
 * different — German pads the hour and appends "Uhr" in the *range* pattern
 * only. Treat the samples above as illustrations, not as a contract: the exact
 * punctuation follows the runtime's ICU data and shifts between versions (Bun
 * and Node already disagree on the "Uhr").
 *
 * `end` is rendered **only when it falls on the same calendar day as `start`**.
 * `formatRange` otherwise widens to the full date on both sides
 * ("15.6.2026, 09:00 – 17.6.2026, 17:00"), which is a paragraph in a list row.
 * A caller listing a span across days therefore states one end per row and says
 * so — `CalendarEventItem` passes `start` on the event's first day and calls
 * this again with the bare `end` (no second argument) on its last. The guard
 * doubles as the invalid-`end` net: an unparseable date is never "the same
 * day", so it drops out instead of making `formatRange` throw inside a
 * `$derived`.
 *
 * @param start - Start of the appointment (local time)
 * @param end - Optional end; ignored when it is on another day
 * @param locale - BCP 47 locale tag
 */
export function formatTimeRange(start: Date, end?: Date, locale: string = DEFAULT_LOCALE): string {
  const formatter = getTimeFormatter(locale);
  if (!end || !isSameDay(start, end)) return formatter.format(start);
  return formatter.formatRange(start, end);
}

/**
 * Format an abbreviated month name for the year grid, e.g. "Mär" (de-DE) or
 * "Mar" (en-US).
 *
 * @param month - Month index (0-11)
 * @param locale - BCP 47 locale tag
 */
export function formatMonthShort(month: number, locale: string = DEFAULT_LOCALE): string {
  const date = new Date(2026, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}
