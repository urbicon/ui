/**
 * Pure date arithmetic functions for the Calendar component.
 * No Svelte dependencies — fully testable in isolation.
 * Uses native Intl.DateTimeFormat for locale-aware formatting.
 */

import type { CalendarEvent, PositionedEvent, RecurrenceRule, TimeSlot } from './calendar.types';

/**
 * Generate a 2D grid of dates for a month view.
 * Each row is a 7-element array representing one week.
 * Includes padding days from previous/next months to fill the grid.
 *
 * @param year - Full year (e.g. 2026)
 * @param month - Month index (0-11)
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon, ..., 6=Sat)
 * @returns 2D array of Date objects (4-6 rows of 7 days)
 */
export function getMonthGrid(year: number, month: number, weekStartsOn: number = 1): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstOfMonth.getDay();

  // How many days from the previous month we need to show
  const daysBefore = (firstDayOfWeek - weekStartsOn + 7) % 7;

  // Start date: go back daysBefore days from the 1st
  const startDate = new Date(year, month, 1 - daysBefore);

  const weeks: Date[][] = [];
  const current = new Date(startDate);

  // Generate enough weeks to cover the entire month
  // We need at least enough rows until we've passed the last day of the month
  const lastOfMonth = new Date(year, month + 1, 0);

  while (weeks.length === 0 || current <= lastOfMonth || weeks[weeks.length - 1].length < 7) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);

    // Safety: stop after 6 weeks max
    if (weeks.length >= 6) break;
  }

  return weeks;
}

/**
 * Get localized weekday names.
 *
 * @param locale - BCP 47 locale tag (e.g. 'de-DE')
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon)
 * @param format - Name format ('narrow'='M', 'short'='Mo', 'long'='Montag')
 * @returns Array of 7 weekday name strings
 */
export function getWeekdayNames(
  locale: string = 'de-DE',
  weekStartsOn: number = 1,
  format: 'narrow' | 'short' | 'long' = 'short'
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  const names: string[] = [];

  // Use a known Monday (2026-01-05 is a Monday)
  // Adjust to the start of the week
  const baseMonday = new Date(2026, 0, 5); // Monday
  const baseSunday = new Date(2026, 0, 4); // Sunday

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

/**
 * Format month and year for header display.
 * e.g. "Maerz 2026", "March 2026"
 */
export function formatMonthYear(year: number, month: number, locale: string = 'de-DE'): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

/**
 * Format a date for the detail header.
 * e.g. "Do, 12. Maerz", "Thu, March 12"
 */
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

/**
 * Format a date for screen reader aria-label.
 * e.g. "Donnerstag, 12. Maerz 2026"
 */
export function formatDateFull(date: Date, locale: string = 'de-DE'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/** Check if two dates represent the same calendar day (ignoring time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Check if a date falls within a range (inclusive on both ends). */
export function isInRange(date: Date, start: Date, end: Date): boolean {
  const d = stripTime(date).getTime();
  const s = stripTime(start).getTime();
  const e = stripTime(end).getTime();
  return d >= Math.min(s, e) && d <= Math.max(s, e);
}

/** Check if a date belongs to the given month and year. */
export function isInMonth(date: Date, month: number, year: number): boolean {
  return date.getMonth() === month && date.getFullYear() === year;
}

/** Get ISO 8601 week number for a date. */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Clamp month navigation to min/max date boundaries.
 * Returns the (possibly adjusted) month/year and navigation flags.
 */
export function clampMonth(
  month: number,
  year: number,
  minDate?: Date,
  maxDate?: Date
): { month: number; year: number; canGoBack: boolean; canGoForward: boolean } {
  let canGoBack = true;
  let canGoForward = true;

  if (minDate) {
    const minMonth = minDate.getMonth();
    const minYear = minDate.getFullYear();
    if (year < minYear || (year === minYear && month < minMonth)) {
      month = minMonth;
      year = minYear;
    }
    canGoBack = year > minYear || (year === minYear && month > minMonth);
  }

  if (maxDate) {
    const maxMonth = maxDate.getMonth();
    const maxYear = maxDate.getFullYear();
    if (year > maxYear || (year === maxYear && month > maxMonth)) {
      month = maxMonth;
      year = maxYear;
    }
    canGoForward = year < maxYear || (year === maxYear && month < maxMonth);
  }

  return { month, year, canGoBack, canGoForward };
}

/**
 * Get day info for a multi-day event on a specific date.
 * Returns the 0-based day index, total days, and start/end flags.
 */
export function getEventDayInfo(
  event: { start: Date; end?: Date },
  date: Date
): { dayIndex: number; totalDays: number; isStart: boolean; isEnd: boolean } {
  const startDay = stripTime(event.start);
  const endDay = event.end ? stripTime(event.end) : startDay;
  const currentDay = stripTime(date);

  const totalDays = daysBetween(startDay, endDay) + 1;
  const dayIndex = daysBetween(startDay, currentDay);

  return {
    dayIndex,
    totalDays,
    isStart: dayIndex === 0,
    isEnd: dayIndex === totalDays - 1
  };
}

/** Create a date key string for Map indexing (YYYY-MM-DD). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Strip time from a date, returning midnight of the same day. */
export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** DST-safe day difference between two dates. */
export function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

/**
 * Determine whether text on a given background color should be light or dark.
 * Supports hex (#rgb, #rrggbb), rgb(), oklch(), and CSS named colors.
 * Returns 'white' or 'black' based on perceived luminance.
 */
export function getContrastTextColor(bgColor: string): 'white' | 'black' {
  // Try to parse oklch
  const oklchMatch = bgColor.match(/oklch\(\s*([\d.]+)/);
  if (oklchMatch) {
    const lightness = parseFloat(oklchMatch[1]);
    // oklch lightness: 0 = black, 1 = white
    return lightness > 0.6 ? 'black' : 'white';
  }

  // Try to parse hex
  const hexMatch = bgColor.match(/^#?([\da-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Relative luminance approximation
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  }

  // Try to parse rgb/rgba
  const rgbMatch = bgColor.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  }

  // Default: assume dark background
  return 'white';
}

/**
 * Get the 7 dates for the week containing the given date.
 *
 * @param date - Any date within the target week
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon, ..., 6=Sat)
 * @returns Array of 7 Date objects starting from the week start day
 */
export function getWeekDates(date: Date, weekStartsOn: number = 1): Date[] {
  const dayOfWeek = date.getDay();
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Get metadata for all 12 months of a year.
 *
 * @param year - Full year (e.g. 2026)
 * @returns Array of 12 objects with month index and year
 */
export function getYearMonths(year: number): { month: number; year: number }[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i, year }));
}

/**
 * Format a week title for the header.
 * e.g. "KW 12 – März 2026" (de-DE) or "Week 12 – March 2026" (en-US)
 *
 * Uses Thursday of the week to determine the month (ISO week convention).
 */
export function formatWeekTitle(
  date: Date,
  weekStartsOn: number = 1,
  locale: string = 'de-DE'
): string {
  const weekDates = getWeekDates(date, weekStartsOn);
  // ISO convention: use Thursday to determine month/year association
  const thursday = weekDates[(4 - weekStartsOn + 7) % 7];
  const weekNum = getWeekNumber(thursday);

  const monthYear = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric'
  }).format(thursday);

  // Use locale-specific week label
  const weekLabels: Record<string, string> = {
    de: 'KW',
    en: 'Week',
    fr: 'Sem.',
    es: 'Sem.',
    it: 'Sett.',
    nl: 'Week',
    pt: 'Sem.'
  };
  const lang = locale.split('-')[0];
  const weekLabel = weekLabels[lang] ?? 'Week';

  return `${weekLabel} ${weekNum} – ${monthYear}`;
}

/**
 * Format a date for the day view header.
 * e.g. "Do, 19. März 2026" (de-DE) or "Thu, March 19, 2026" (en-US)
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
 * Format an abbreviated month name for the year grid.
 * e.g. "Mär" (de-DE) or "Mar" (en-US)
 *
 * @param month - Month index (0-11)
 * @param locale - BCP 47 locale tag
 */
export function formatMonthShort(month: number, locale: string = 'de-DE'): string {
  const date = new Date(2026, month, 1);
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}

/**
 * Compute layout segments for multi-day events in the month grid.
 * Each multi-day event is split into per-week segments with column positions.
 *
 * @param events - All events to layout
 * @param grid - The 2D date grid from getMonthGrid()
 * @param maxRows - Maximum bar rows per week before overflow (default: 3)
 * @returns Per-week array of bar segments and overflow counts
 */
export function getMultiDayEventLayout(
  events: Array<{ id: string; start: Date; end?: Date }>,
  grid: Date[][],
  maxRows: number = 3
): Array<{
  segments: Array<{
    eventId: string;
    startCol: number;
    spanCols: number;
    isFirstSegment: boolean;
    isLastSegment: boolean;
    row: number;
  }>;
  overflow: number;
}> {
  // Filter to multi-day events only
  const multiDay = events.filter((e) => {
    if (!e.end) return false;
    const s = stripTime(e.start);
    const ed = stripTime(e.end);
    return ed.getTime() > s.getTime();
  });

  // Sort by start date, then by duration (longer events first for stable stacking)
  multiDay.sort((a, b) => {
    const diff = stripTime(a.start).getTime() - stripTime(b.start).getTime();
    if (diff !== 0) return diff;
    const aDur =
      (a.end ? stripTime(a.end).getTime() : stripTime(a.start).getTime()) -
      stripTime(a.start).getTime();
    const bDur =
      (b.end ? stripTime(b.end).getTime() : stripTime(b.start).getTime()) -
      stripTime(b.start).getTime();
    return bDur - aDur;
  });

  return grid.map((week) => {
    const weekStart = stripTime(week[0]);
    const weekEnd = stripTime(week[6]);
    const occupiedRows: boolean[][] = [];

    type Seg = {
      eventId: string;
      startCol: number;
      spanCols: number;
      isFirstSegment: boolean;
      isLastSegment: boolean;
      row: number;
    };

    const allSegments: Seg[] = [];

    for (const event of multiDay) {
      const evStart = stripTime(event.start);
      const evEnd = event.end ? stripTime(event.end) : evStart;

      if (evEnd < weekStart || evStart > weekEnd) continue;

      const visStart = evStart < weekStart ? weekStart : evStart;
      const visEnd = evEnd > weekEnd ? weekEnd : evEnd;

      const startCol = daysBetween(weekStart, visStart);
      const endCol = daysBetween(weekStart, visEnd);
      const spanCols = endCol - startCol + 1;

      const isFirstSegment = evStart.getTime() >= weekStart.getTime();
      const isLastSegment = evEnd.getTime() <= weekEnd.getTime();

      // Find first available row
      let assignedRow = 0;
      while (true) {
        if (!occupiedRows[assignedRow]) {
          occupiedRows[assignedRow] = Array(7).fill(false);
        }
        let fits = true;
        for (let c = startCol; c <= endCol; c++) {
          if (occupiedRows[assignedRow][c]) {
            fits = false;
            break;
          }
        }
        if (fits) break;
        assignedRow++;
      }

      if (!occupiedRows[assignedRow]) {
        occupiedRows[assignedRow] = Array(7).fill(false);
      }
      for (let c = startCol; c <= endCol; c++) {
        occupiedRows[assignedRow][c] = true;
      }

      allSegments.push({
        eventId: event.id,
        startCol,
        spanCols,
        isFirstSegment,
        isLastSegment,
        row: assignedRow
      });
    }

    const visible = allSegments.filter((s) => s.row < maxRows);
    const overflow = allSegments.filter((s) => s.row >= maxRows).length;

    return { segments: visible, overflow };
  });
}

/**
 * Generate time slots for a time grid.
 *
 * @param startHour - First visible hour (0-23)
 * @param endHour - Last visible hour, exclusive (1-24)
 * @param interval - Slot interval in minutes (30 or 60)
 * @returns Array of TimeSlot objects
 */
export function generateTimeSlots(
  startHour: number,
  endHour: number,
  interval: 30 | 60 = 60
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push({
      hour,
      minute: 0,
      label: `${String(hour).padStart(2, '0')}:00`
    });
    if (interval === 30) {
      slots.push({
        hour,
        minute: 30,
        label: `${String(hour).padStart(2, '0')}:30`
      });
    }
  }
  return slots;
}

/**
 * Position timed events within a time grid for a single day.
 * Calculates top/height as percentages and resolves overlapping columns
 * via a sweep-line algorithm for O(n log n) performance.
 *
 * @param events - Timed events for a single day
 * @param forDate - The specific day being rendered
 * @param startHour - First visible hour
 * @param endHour - Last visible hour (exclusive)
 * @returns Array of positioned events with layout info
 */
export function positionEvents(
  events: CalendarEvent[],
  forDate: Date,
  startHour: number,
  endHour: number
): PositionedEvent[] {
  if (events.length === 0) return [];

  const totalMinutes = (endHour - startHour) * 60;
  const gridStartMinutes = startHour * 60;
  const dayStartMs = stripTime(forDate).getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

  const positioned: PositionedEvent[] = [];

  for (const event of events) {
    const evStartMs = event.start.getTime();
    const evEndMs = event.end ? event.end.getTime() : evStartMs + 60 * 60 * 1000; // default 1h duration

    // Calculate minutes within this day (clamped to day boundaries)
    const startMins = evStartMs < dayStartMs ? 0 : (evStartMs - dayStartMs) / 60000;
    let endMins = evEndMs > dayEndMs ? 24 * 60 : (evEndMs - dayStartMs) / 60000;

    // Handle midnight end (00:00 next day)
    if (endMins === 0 && evEndMs > dayStartMs) endMins = 24 * 60;

    // Clamp to visible grid range
    const clampedStart = Math.max(startMins - gridStartMinutes, 0);
    const clampedEnd = Math.min(endMins - gridStartMinutes, totalMinutes);

    if (clampedEnd <= clampedStart) continue;

    positioned.push({
      event,
      top: (clampedStart / totalMinutes) * 100,
      height: Math.max(((clampedEnd - clampedStart) / totalMinutes) * 100, 2),
      column: 0,
      totalColumns: 1
    });
  }

  resolveOverlaps(positioned);
  return positioned;
}

/**
 * Resolve overlapping events by assigning column indices via sweep-line.
 * Mutates the input array in place.
 */
function resolveOverlaps(events: PositionedEvent[]): void {
  if (events.length <= 1) return;

  // Sort by top, then longer events first for stable stacking
  events.sort((a, b) => a.top - b.top || b.height - a.height);

  // Find connected overlap groups
  const groups: PositionedEvent[][] = [];
  let group: PositionedEvent[] = [events[0]];
  let groupBottom = events[0].top + events[0].height;

  for (let i = 1; i < events.length; i++) {
    const ev = events[i];
    if (ev.top < groupBottom - 0.01) {
      group.push(ev);
      groupBottom = Math.max(groupBottom, ev.top + ev.height);
    } else {
      groups.push(group);
      group = [ev];
      groupBottom = ev.top + ev.height;
    }
  }
  groups.push(group);

  // Assign columns within each group
  for (const g of groups) {
    if (g.length === 1) continue;

    const columns: PositionedEvent[][] = [];
    for (const ev of g) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const last = columns[c][columns[c].length - 1];
        if (last.top + last.height <= ev.top + 0.01) {
          columns[c].push(ev);
          ev.column = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev.column = columns.length;
        columns.push([ev]);
      }
    }

    const total = columns.length;
    for (const ev of g) {
      ev.totalColumns = total;
    }
  }
}

/**
 * Expand a recurring event into concrete instances within a date range.
 * Only generates occurrences that fall within [rangeStart, rangeEnd].
 * Each instance gets a unique ID (`${originalId}-${YYYY-MM-DD}`) and
 * preserves all other event properties with adjusted dates.
 *
 * @param event - Source event with a recurrence rule
 * @param rangeStart - Start of the visible range (inclusive)
 * @param rangeEnd - End of the visible range (inclusive)
 * @returns Array of concrete CalendarEvent instances
 */
export function expandRecurrence(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const rule = event.recurrence;
  if (!rule) return [event];

  const interval = rule.interval ?? 1;
  const eventDuration = event.end ? event.end.getTime() - event.start.getTime() : 0;

  const exceptions = new Set((rule.exceptions ?? []).map((d) => dateKey(d)));

  const results: CalendarEvent[] = [];
  let occurrenceCount = 0;
  const maxOccurrences = rule.count ?? 1000; // safety limit
  const untilDate = rule.until ? stripTime(rule.until) : null;

  // Use a cursor starting from the event's original start date
  let cursor = new Date(event.start);

  // Fast-forward cursor to near rangeStart to avoid iterating through
  // thousands of periods for old recurring events
  const eventStart = stripTime(event.start);
  const rangeStartDay = stripTime(rangeStart);
  if (eventStart < rangeStartDay && !rule.count) {
    const gap = daysBetween(eventStart, rangeStartDay);
    switch (rule.frequency) {
      case 'daily': {
        const periodsToSkip = Math.max(0, Math.floor(gap / interval) - 1) * interval;
        cursor = new Date(eventStart);
        cursor.setDate(cursor.getDate() + periodsToSkip);
        break;
      }
      case 'weekly': {
        const weeksGap = Math.floor(gap / 7);
        const periodsToSkip = Math.max(0, Math.floor(weeksGap / interval) - 1) * interval;
        cursor = new Date(eventStart);
        cursor.setDate(cursor.getDate() + periodsToSkip * 7);
        break;
      }
      case 'monthly': {
        const monthsGap =
          (rangeStartDay.getFullYear() - eventStart.getFullYear()) * 12 +
          (rangeStartDay.getMonth() - eventStart.getMonth());
        const periodsToSkip = Math.max(0, Math.floor(monthsGap / interval) - 1) * interval;
        cursor = new Date(eventStart);
        cursor.setMonth(cursor.getMonth() + periodsToSkip);
        break;
      }
      case 'yearly': {
        const yearsGap = rangeStartDay.getFullYear() - eventStart.getFullYear();
        const periodsToSkip = Math.max(0, Math.floor(yearsGap / interval) - 1) * interval;
        cursor = new Date(eventStart);
        cursor.setFullYear(cursor.getFullYear() + periodsToSkip);
        break;
      }
    }
  }

  // For frequencies that need day-level iteration
  let isFirstIteration = true;
  while (occurrenceCount < maxOccurrences) {
    // Check if we've passed the end of the range or the until date
    if (stripTime(cursor) > stripTime(rangeEnd)) break;
    if (untilDate && stripTime(cursor) > untilDate) break;

    const occurrences = getOccurrencesForCursor(cursor, rule, event.start, isFirstIteration);
    isFirstIteration = false;

    for (const occDate of occurrences) {
      if (occurrenceCount >= maxOccurrences) break;
      if (untilDate && stripTime(occDate) > untilDate) break;

      const occKey = dateKey(occDate);

      // Skip exceptions — don't count against the occurrence limit
      if (exceptions.has(occKey)) {
        continue;
      }

      // Only include if within visible range
      const occEnd = eventDuration > 0 ? new Date(occDate.getTime() + eventDuration) : undefined;
      const occStart = stripTime(occDate);
      const occEndDay = occEnd ? stripTime(occEnd) : occStart;

      if (occEndDay >= stripTime(rangeStart) && occStart <= stripTime(rangeEnd)) {
        // Create instance preserving time-of-day from original
        const instanceStart = new Date(occDate);
        instanceStart.setHours(
          event.start.getHours(),
          event.start.getMinutes(),
          event.start.getSeconds()
        );

        const instanceEnd =
          eventDuration > 0
            ? new Date(instanceStart.getTime() + eventDuration)
            : event.end
              ? new Date(instanceStart)
              : undefined;

        results.push({
          ...event,
          id: `${event.id}-${occKey}`,
          start: instanceStart,
          end: instanceEnd
        });
      }

      occurrenceCount++;
    }

    // Advance cursor based on frequency
    cursor = advanceCursor(cursor, rule.frequency, interval);
  }

  return results;
}

/** Get occurrence dates for a single cursor position. */
function getOccurrencesForCursor(
  cursor: Date,
  rule: RecurrenceRule,
  originalStart: Date,
  isFirstIteration: boolean
): Date[] {
  switch (rule.frequency) {
    case 'daily':
      return [new Date(cursor)];

    case 'weekly': {
      if (rule.byDay && rule.byDay.length > 0) {
        // Generate occurrences for each specified day in this week
        const weekStart = new Date(cursor);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const days = rule.byDay.map((day) => {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + day);
          return d;
        });
        // Only filter out days before the original start in the first iteration
        if (isFirstIteration) {
          return days.filter((d) => stripTime(d) >= stripTime(originalStart));
        }
        return days;
      }
      return [new Date(cursor)];
    }

    case 'monthly': {
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        return rule.byMonthDay
          .map((dayNum) => {
            const d = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum);
            return d;
          })
          .filter((d) => d.getMonth() === cursor.getMonth());
      }
      return [new Date(cursor)];
    }

    case 'yearly':
      return [new Date(cursor)];

    default:
      return [new Date(cursor)];
  }
}

/** Advance the cursor by one period based on frequency and interval. */
function advanceCursor(
  cursor: Date,
  frequency: RecurrenceRule['frequency'],
  interval: number
): Date {
  const next = new Date(cursor);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7 * interval);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
  }
  return next;
}
