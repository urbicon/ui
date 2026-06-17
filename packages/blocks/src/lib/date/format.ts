/**
 * Locale-aware date formatting built on the native `Intl.DateTimeFormat`.
 * No locale tables are bundled — output follows the runtime's ICU data for the
 * given BCP 47 locale tag.
 */

import { getWeekDates, getWeekNumber } from './geometry';

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
  locale: string = 'de-DE',
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
export function formatMonthYear(year: number, month: number, locale: string = 'de-DE'): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

/** Format a date for a detail header, e.g. "Do, 12. März", "Thu, March 12". */
export function formatDate(
  date: Date,
  locale: string = 'de-DE',
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
export function formatDateFull(date: Date, locale: string = 'de-DE'): string {
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
  locale: string = 'de-DE'
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
  locale: string = 'de-DE',
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
export function formatDateRange(start: Date, end: Date, locale: string = 'de-DE'): string {
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
export function formatDayTitle(date: Date, locale: string = 'de-DE'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * Format an abbreviated month name for the year grid, e.g. "Mär" (de-DE) or
 * "Mar" (en-US).
 *
 * @param month - Month index (0-11)
 * @param locale - BCP 47 locale tag
 */
export function formatMonthShort(month: number, locale: string = 'de-DE'): string {
  const date = new Date(2026, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}
