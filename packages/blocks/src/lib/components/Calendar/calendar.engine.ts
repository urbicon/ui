/**
 * Event-layout, recurrence and navigation logic for the Calendar component.
 *
 * Pure date geometry (grids, week numbers, ranges, comparison, formatting)
 * lives in the Svelte-free `$lib/date` layer and is imported from there. This
 * module keeps only the Calendar-specific concerns: positioning timed and
 * multi-day events, expanding recurrence rules and time-slot generation.
 * No Svelte dependencies — fully testable in isolation.
 */

import { daysBetween, stripTime, toIso } from '$lib/date';
import { packSpans } from '$lib/internal/date-grid/pack-spans';
import type { CalendarEvent, PositionedEvent, RecurrenceRule, TimeSlot } from './calendar.types';

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

/**
 * Order the events of ONE day for a list: all-day first, then timed events by
 * start; ties go to the longer event.
 *
 * The reading order of a day is a property of the day, not of the array a
 * consumer happened to build. Events generated per resource (chairs, rooms,
 * staff) arrive grouped by resource — 12:20, 12:15, 13:20, 13:15 — and the
 * list-based views rendered exactly that (#95). The time grid hid it, because
 * it positions by the hour rather than by array index.
 *
 * All-day before timed follows the convention every calendar app uses: an
 * all-day event has no hour to sort against, so it heads the day rather than
 * landing at midnight among the timed ones. `allDay` is read the way the rest
 * of the component reads it — `!== false`, since the documented default is
 * `true` and only an explicit `false` marks an event as timed.
 *
 * The tie-break repeats the stacking rule of `getMultiDayEventLayout` and
 * `resolveOverlaps` (longer first), so a day's list order matches the order the
 * same events stack in the grid. `Array.prototype.sort` is stable, so events
 * that are equal under both keys keep the order they were passed in.
 */
export function compareDayEvents(
  a: { start: Date; end?: Date; allDay?: boolean },
  b: { start: Date; end?: Date; allDay?: boolean }
): number {
  const aAllDay = a.allDay !== false;
  const bAllDay = b.allDay !== false;
  if (aAllDay !== bAllDay) return aAllDay ? -1 : 1;

  const byStart = a.start.getTime() - b.start.getTime();
  if (byStart !== 0) return byStart;

  const aEnd = a.end ? a.end.getTime() : a.start.getTime();
  const bEnd = b.end ? b.end.getTime() : b.start.getTime();
  return bEnd - aEnd;
}

/**
 * Foreground colour for a consumer-supplied background. The implementation
 * moved to `$lib/internal/contrast` when ResourceTimeline became its second
 * caller — a timeline bar and a calendar event chip both paint a surface from a
 * `DateCategory.color` the consumer chose, and face the same question.
 * Re-exported here so Calendar's own sub-components keep importing it from the
 * engine.
 */
export { getContrastTextColor } from '$lib/internal/contrast';

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

    // Clip each event to this week's columns; the stacking itself is the shared
    // first-fit packer in internal/date-grid (ResourceTimeline packs its lane
    // bars through the same one).
    const clipped: Array<{
      eventId: string;
      startCol: number;
      endCol: number;
      spanCols: number;
      isFirstSegment: boolean;
      isLastSegment: boolean;
    }> = [];

    for (const event of multiDay) {
      const evStart = stripTime(event.start);
      const evEnd = event.end ? stripTime(event.end) : evStart;

      if (evEnd < weekStart || evStart > weekEnd) continue;

      const visStart = evStart < weekStart ? weekStart : evStart;
      const visEnd = evEnd > weekEnd ? weekEnd : evEnd;

      const startCol = daysBetween(weekStart, visStart);
      const endCol = daysBetween(weekStart, visEnd);

      clipped.push({
        eventId: event.id,
        startCol,
        endCol,
        spanCols: endCol - startCol + 1,
        isFirstSegment: evStart.getTime() >= weekStart.getTime(),
        isLastSegment: evEnd.getTime() <= weekEnd.getTime()
      });
    }

    const { packed, overflow } = packSpans(
      clipped,
      7,
      (seg) => ({ startCol: seg.startCol, endCol: seg.endCol }),
      maxRows
    );

    return {
      segments: packed.map(({ span, row }) => ({
        eventId: span.eventId,
        startCol: span.startCol,
        spanCols: span.spanCols,
        isFirstSegment: span.isFirstSegment,
        isLastSegment: span.isLastSegment,
        row
      })),
      overflow
    };
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

  warnUnusableByDay(rule, event.id);

  // An interval that does not move the cursor forward is not a slower series,
  // it is a loop that never ends: the only exits below are "cursor past the
  // range", "cursor past `until`" and the occurrence counter, and the first two
  // depend entirely on the cursor advancing. `0` is one keystroke away in any
  // form (`Number('')` is 0, `parseInt('')` is NaN), and nothing between a
  // consumer's input and here validates the rule.
  //
  // This used to be survivable by accident: the counter advanced once per
  // cursor step, so the 1000 cap below stopped it after rendering 1000 events
  // stacked on one day — wrong, but recoverable. Once `byDay` could filter a
  // step out (#136), the counter stopped advancing too and the last bound was
  // gone. Both readings of a degenerate interval are nonsense; the one that
  // keeps the tab alive wins.
  const interval = Math.max(1, Math.trunc(rule.interval ?? 1) || 1);
  const eventDuration = event.end ? event.end.getTime() - event.start.getTime() : 0;

  const exceptions = new Set((rule.exceptions ?? []).map((d) => toIso(d)));

  const results: CalendarEvent[] = [];
  let occurrenceCount = 0;
  // Caps an unbounded series at a sane page's worth. NOT what keeps the loop
  // finite — a filtered-out day never reaches this counter, so termination
  // rests on the cursor advancing (see `interval` above) into `rangeEnd`/`until`.
  const maxOccurrences = rule.count ?? 1000;
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

      const occKey = toIso(occDate);

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

/**
 * Warn once per expansion about `byDay` entries no weekday can equal.
 *
 * `getDay()` returns 0–6, so a `7` (a reader counting Monday-as-1 through
 * Sunday-as-7, which is how ISO-8601 and RFC 5545's `SU`/`MO` ordering read to
 * many) or a `-1` matches nothing. On a `daily` rule that silently empties the
 * series; on `weekly` it silently shifts the occurrence into the next week.
 * Both are worse than the bug this file just fixed, because neither shows up as
 * anything on screen — the series simply is not there.
 *
 * A warning rather than a rejection: reading tolerantly and reporting loudly is
 * the house rule, and a thrown error in a `$derived` would take the calendar
 * down over one typo.
 */
function warnUnusableByDay(rule: RecurrenceRule, eventId: string): void {
  if (!import.meta.env?.DEV || !rule.byDay?.length) return;
  const unusable = rule.byDay.filter((d) => !Number.isInteger(d) || d < 0 || d > 6);
  if (unusable.length === 0) return;
  console.warn(
    `[Calendar] Event "${eventId}": recurrence.byDay contains ${JSON.stringify(unusable)}, ` +
      `which no weekday can equal — byDay is 0=Sunday through 6=Saturday. ` +
      `On a "${rule.frequency}" rule these entries ` +
      (rule.frequency === 'daily' ? 'drop occurrences silently.' : 'shift into the next week.')
  );
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
      // RFC 5545 reads BYDAY under FREQ=DAILY as a FILTER, not a generator: the
      // cursor still advances one interval at a time, and an occurrence is kept
      // only when it lands on a listed weekday. That is deliberately NOT what
      // the `weekly` branch below does — it GENERATES one occurrence per listed
      // day within the week — and the difference is why both spellings are
      // needed. With `interval: 2`, `daily` means "every other day, but only on
      // weekdays" while `weekly` means "weekdays of every other week"; neither
      // can express the other.
      //
      // Returning an empty array rather than skipping the cursor is what keeps
      // `count` honest: the caller only increments its occurrence counter per
      // returned date, so a filtered-out day costs nothing against the limit —
      // `{ daily, byDay: [1..5], count: 10 }` yields ten weekdays, not ten
      // calendar days of which four were dropped (#136).
      if (rule.byDay && rule.byDay.length > 0 && !rule.byDay.includes(cursor.getDay())) {
        return [];
      }
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
