import { describe, expect, it } from 'vitest';
import { getMonthGrid } from '$lib/date';
import {
  clampMonth,
  expandRecurrence,
  generateTimeSlots,
  getContrastTextColor,
  getEventDayInfo,
  getMultiDayEventLayout,
  positionEvents
} from './calendar.engine';
import type { CalendarEvent } from './calendar.types';

describe('clampMonth', () => {
  it('returns the same month/year when no constraints', () => {
    const result = clampMonth(2, 2026);
    expect(result).toEqual({ month: 2, year: 2026, canGoBack: true, canGoForward: true });
  });

  it('clamps to minDate when navigating before it', () => {
    const minDate = new Date(2026, 2, 1);
    const result = clampMonth(1, 2026, minDate);
    expect(result.month).toBe(2);
    expect(result.year).toBe(2026);
    expect(result.canGoBack).toBe(false);
  });

  it('clamps to maxDate when navigating after it', () => {
    const maxDate = new Date(2026, 5, 30);
    const result = clampMonth(6, 2026, undefined, maxDate);
    expect(result.month).toBe(5);
    expect(result.year).toBe(2026);
    expect(result.canGoForward).toBe(false);
  });

  it('sets canGoBack false at minDate boundary', () => {
    const minDate = new Date(2026, 2, 1);
    const result = clampMonth(2, 2026, minDate);
    expect(result.canGoBack).toBe(false);
    expect(result.canGoForward).toBe(true);
  });

  it('sets canGoForward false at maxDate boundary', () => {
    const maxDate = new Date(2026, 5, 30);
    const result = clampMonth(5, 2026, undefined, maxDate);
    expect(result.canGoForward).toBe(false);
    expect(result.canGoBack).toBe(true);
  });

  it('handles year boundaries for minDate', () => {
    const minDate = new Date(2025, 11, 1); // Dec 2025
    const result = clampMonth(10, 2025, minDate); // Nov 2025 → clamped to Dec 2025
    expect(result.month).toBe(11);
    expect(result.year).toBe(2025);
  });
});

// ---------------------------------------------------------------------------
// expandRecurrence
// ---------------------------------------------------------------------------
describe('expandRecurrence', () => {
  /** Helper to create a minimal CalendarEvent with recurrence. */
  function makeEvent(
    overrides: Partial<CalendarEvent> & { start: Date; recurrence: CalendarEvent['recurrence'] }
  ): CalendarEvent {
    return {
      id: 'evt',
      title: 'Test Event',
      ...overrides
    };
  }

  // --- Daily ---
  describe('daily recurrence', () => {
    it('generates daily occurrences within the range', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: { frequency: 'daily' }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 5));
      expect(results).toHaveLength(5);
      expect(results[0].id).toBe('evt-2026-03-01');
      expect(results[4].id).toBe('evt-2026-03-05');
    });

    it('respects interval > 1 (every 3 days)', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: { frequency: 'daily', interval: 3 }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 10));
      // Mar 1, 4, 7, 10
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.start.getDate())).toEqual([1, 4, 7, 10]);
    });
  });

  // --- Weekly ---
  describe('weekly recurrence', () => {
    it('generates weekly occurrences without byDay', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 2), // Monday Mar 2
        recurrence: { frequency: 'weekly' }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      // Mar 2, 9, 16, 23, 30
      expect(results).toHaveLength(5);
      for (const r of results) {
        expect(r.start.getDay()).toBe(1); // Monday
      }
    });

    it('generates occurrences with byDay [1,3,5] (Mon/Wed/Fri)', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 2), // Monday Mar 2
        recurrence: { frequency: 'weekly', byDay: [1, 3, 5] }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 2), new Date(2026, 2, 8));
      // Week of Mar 2: Mon Mar 2, Wed Mar 4, Fri Mar 6
      expect(results).toHaveLength(3);
      expect(results[0].start.getDate()).toBe(2); // Mon
      expect(results[1].start.getDate()).toBe(4); // Wed
      expect(results[2].start.getDate()).toBe(6); // Fri
    });

    it('all byDay days appear every week (not just days >= cursor day)', () => {
      // Start on Wednesday Mar 4, byDay includes Mon(1), Wed(3), Fri(5)
      const event = makeEvent({
        start: new Date(2026, 2, 4), // Wednesday Mar 4
        recurrence: { frequency: 'weekly', byDay: [1, 3, 5] }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 4), new Date(2026, 2, 15));
      // First iteration: Wed Mar 4, Fri Mar 6 (Mon Mar 2 is before start)
      // Second iteration: Mon Mar 9, Wed Mar 11, Fri Mar 13
      expect(results).toHaveLength(5);
      const dates = results.map((r) => r.start.getDate());
      expect(dates).toEqual([4, 6, 9, 11, 13]);
    });

    it('respects interval 2 (every 2 weeks)', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 2), // Monday Mar 2
        recurrence: { frequency: 'weekly', interval: 2 }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      // Mar 2, 16, 30
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.start.getDate())).toEqual([2, 16, 30]);
    });
  });

  // --- Monthly ---
  describe('monthly recurrence', () => {
    it('generates monthly occurrences without byMonthDay', () => {
      const event = makeEvent({
        start: new Date(2026, 0, 15), // Jan 15
        recurrence: { frequency: 'monthly' }
      });
      const results = expandRecurrence(event, new Date(2026, 0, 1), new Date(2026, 5, 30));
      // Jan 15, Feb 15, Mar 15, Apr 15, May 15, Jun 15
      expect(results).toHaveLength(6);
      for (const r of results) {
        expect(r.start.getDate()).toBe(15);
      }
    });

    it('generates occurrences with byMonthDay', () => {
      const event = makeEvent({
        start: new Date(2026, 0, 1),
        recurrence: { frequency: 'monthly', byMonthDay: [5, 20] }
      });
      const results = expandRecurrence(event, new Date(2026, 0, 1), new Date(2026, 1, 28));
      // Jan 5, Jan 20, Feb 5, Feb 20
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.start.getDate())).toEqual([5, 20, 5, 20]);
    });

    it('skips day 31 in months with fewer days', () => {
      const event = makeEvent({
        start: new Date(2026, 0, 31), // Jan 31
        recurrence: { frequency: 'monthly', byMonthDay: [31] }
      });
      const results = expandRecurrence(event, new Date(2026, 0, 1), new Date(2026, 5, 30));
      // Jan 31, Mar 31, May 31 (Feb/Apr/Jun have <31 days)
      const months = results.map((r) => r.start.getMonth());
      expect(months).toEqual([0, 2, 4]); // Jan, Mar, May
    });
  });

  // --- Yearly ---
  describe('yearly recurrence', () => {
    it('generates yearly occurrences', () => {
      const event = makeEvent({
        start: new Date(2024, 5, 15), // Jun 15 2024
        recurrence: { frequency: 'yearly' }
      });
      const results = expandRecurrence(event, new Date(2024, 0, 1), new Date(2028, 11, 31));
      // 2024, 2025, 2026, 2027, 2028
      expect(results).toHaveLength(5);
      for (const r of results) {
        expect(r.start.getMonth()).toBe(5);
        expect(r.start.getDate()).toBe(15);
      }
    });

    it('handles leap year (Feb 29)', () => {
      const event = makeEvent({
        start: new Date(2024, 1, 29), // Feb 29 2024 (leap year)
        recurrence: { frequency: 'yearly' }
      });
      const results = expandRecurrence(event, new Date(2024, 0, 1), new Date(2028, 11, 31));
      // Feb 29 only exists in leap years: 2024 and 2028.
      expect(
        results.some(
          (r) =>
            r.start.getFullYear() === 2024 && r.start.getMonth() === 1 && r.start.getDate() === 29
        )
      ).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Count limit ---
  describe('count limit', () => {
    it('stops after count occurrences', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: { frequency: 'daily', count: 3 }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      expect(results).toHaveLength(3);
    });
  });

  // --- Until limit ---
  describe('until limit', () => {
    it('stops after until date', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: { frequency: 'daily', until: new Date(2026, 2, 5) }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      expect(results).toHaveLength(5); // Mar 1-5 inclusive
      expect(results[4].start.getDate()).toBe(5);
    });
  });

  // --- Exceptions ---
  describe('exceptions', () => {
    it('skips exception dates', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: {
          frequency: 'daily',
          exceptions: [new Date(2026, 2, 3), new Date(2026, 2, 5)]
        }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 7));
      // 7 days minus 2 exceptions = 5
      expect(results).toHaveLength(5);
      const dates = results.map((r) => r.start.getDate());
      expect(dates).not.toContain(3);
      expect(dates).not.toContain(5);
    });

    it('exceptions do NOT count against the count limit', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: {
          frequency: 'daily',
          count: 5,
          exceptions: [new Date(2026, 2, 2), new Date(2026, 2, 4)]
        }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      // count=5 means 5 actual occurrences. Exceptions are skipped but NOT counted.
      expect(results).toHaveLength(5);
      const dates = results.map((r) => r.start.getDate());
      expect(dates).not.toContain(2);
      expect(dates).not.toContain(4);
    });
  });

  // --- Edge cases ---
  describe('edge cases', () => {
    it('fast-forwards when event start is before rangeStart', () => {
      const event = makeEvent({
        start: new Date(2026, 0, 1), // Jan 1
        recurrence: { frequency: 'weekly' }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      // Event started Jan 1, weekly. Range is March only → only March occurrences.
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.start.getMonth()).toBe(2); // all in March
      }
    });

    it('returns empty array for empty range', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1),
        recurrence: { frequency: 'daily' }
      });
      // Event starts Mar 2026, range is Jan 2025 → cursor starts past rangeEnd.
      const emptyResults = expandRecurrence(event, new Date(2025, 0, 1), new Date(2025, 0, 31));
      expect(emptyResults).toHaveLength(0);
    });

    it('returns the event as-is when there is no recurrence rule', () => {
      const event: CalendarEvent = {
        id: 'no-recur',
        title: 'Single Event',
        start: new Date(2026, 2, 5)
      };
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 31));
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(event); // same reference
    });

    it('preserves event duration on expanded instances', () => {
      const event = makeEvent({
        start: new Date(2026, 2, 1, 10, 0),
        end: new Date(2026, 2, 1, 12, 0), // 2 hours
        recurrence: { frequency: 'daily', count: 3 }
      });
      const results = expandRecurrence(event, new Date(2026, 2, 1), new Date(2026, 2, 10));
      for (const r of results) {
        const duration = r.end!.getTime() - r.start.getTime();
        expect(duration).toBe(2 * 60 * 60 * 1000);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// getMultiDayEventLayout
// ---------------------------------------------------------------------------
describe('getMultiDayEventLayout', () => {
  /** Helper to create a month grid for a known month. */
  function marchGrid() {
    // March 2026, Monday start
    return getMonthGrid(2026, 2, 1);
  }

  it('places a simple 3-day event within one week', () => {
    const events = [
      { id: 'a', start: new Date(2026, 2, 10), end: new Date(2026, 2, 12) } // Tue-Thu
    ];
    const grid = marchGrid();
    const layout = getMultiDayEventLayout(events, grid);

    const weekIdx = grid.findIndex((week) =>
      week.some((d) => d.getDate() === 10 && d.getMonth() === 2)
    );
    const seg = layout[weekIdx].segments;
    expect(seg).toHaveLength(1);
    expect(seg[0].eventId).toBe('a');
    expect(seg[0].spanCols).toBe(3); // Tue, Wed, Thu
    expect(seg[0].isFirstSegment).toBe(true);
    expect(seg[0].isLastSegment).toBe(true);
    expect(seg[0].row).toBe(0);
  });

  it('splits an event spanning a week boundary into two segments', () => {
    // Mar 14 (Sat) to Mar 16 (Mon) spans a week boundary (Mon start)
    const events = [{ id: 'b', start: new Date(2026, 2, 14), end: new Date(2026, 2, 16) }];
    const grid = marchGrid();
    const layout = getMultiDayEventLayout(events, grid);

    const weeksWithEvent = layout.filter((w) => w.segments.length > 0);
    expect(weeksWithEvent).toHaveLength(2);

    const firstWeekSegs = weeksWithEvent[0].segments;
    expect(firstWeekSegs[0].isFirstSegment).toBe(true);
    expect(firstWeekSegs[0].isLastSegment).toBe(false);

    const secondWeekSegs = weeksWithEvent[1].segments;
    expect(secondWeekSegs[0].isFirstSegment).toBe(false);
    expect(secondWeekSegs[0].isLastSegment).toBe(true);
  });

  it('stacks multiple overlapping events vertically', () => {
    const events = [
      { id: 'x', start: new Date(2026, 2, 10), end: new Date(2026, 2, 12) },
      { id: 'y', start: new Date(2026, 2, 10), end: new Date(2026, 2, 11) }
    ];
    const grid = marchGrid();
    const layout = getMultiDayEventLayout(events, grid);

    const weekIdx = grid.findIndex((week) =>
      week.some((d) => d.getDate() === 10 && d.getMonth() === 2)
    );
    const seg = layout[weekIdx].segments;
    expect(seg).toHaveLength(2);
    const rows = seg.map((s) => s.row);
    expect(new Set(rows).size).toBe(2);
  });

  it('reports overflow when events exceed maxRows', () => {
    const events = [
      { id: 'a', start: new Date(2026, 2, 10), end: new Date(2026, 2, 12) },
      { id: 'b', start: new Date(2026, 2, 10), end: new Date(2026, 2, 12) },
      { id: 'c', start: new Date(2026, 2, 10), end: new Date(2026, 2, 12) },
      { id: 'd', start: new Date(2026, 2, 10), end: new Date(2026, 2, 12) }
    ];
    const grid = marchGrid();
    const layout = getMultiDayEventLayout(events, grid, 2);

    const weekIdx = grid.findIndex((week) =>
      week.some((d) => d.getDate() === 10 && d.getMonth() === 2)
    );
    expect(layout[weekIdx].segments).toHaveLength(2); // maxRows = 2
    expect(layout[weekIdx].overflow).toBe(2); // 2 events overflowed
  });

  it('handles events at the very start of the month', () => {
    // Event starting on Feb 28 and ending Mar 2 (crosses month boundary)
    const events = [{ id: 'edge', start: new Date(2026, 1, 28), end: new Date(2026, 2, 2) }];
    const grid = marchGrid();
    const layout = getMultiDayEventLayout(events, grid);

    const weeksWithEvent = layout.filter((w) => w.segments.length > 0);
    expect(weeksWithEvent.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores single-day events (no end or same-day end)', () => {
    const events = [
      { id: 'single', start: new Date(2026, 2, 10) },
      { id: 'sameday', start: new Date(2026, 2, 10), end: new Date(2026, 2, 10) }
    ];
    const grid = marchGrid();
    const layout = getMultiDayEventLayout(events, grid);

    for (const week of layout) {
      expect(week.segments).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// positionEvents (includes resolveOverlaps internally)
// ---------------------------------------------------------------------------
describe('positionEvents', () => {
  const day = new Date(2026, 2, 10);
  const startHour = 8;
  const endHour = 18;

  /** Helper to create a CalendarEvent for position tests. */
  function timedEvent(
    id: string,
    startH: number,
    startM: number,
    endH: number,
    endM: number
  ): CalendarEvent {
    return {
      id,
      title: id,
      start: new Date(2026, 2, 10, startH, startM),
      end: new Date(2026, 2, 10, endH, endM)
    };
  }

  it('positions a single event correctly', () => {
    const events = [timedEvent('a', 9, 0, 10, 0)];
    const result = positionEvents(events, day, startHour, endHour);
    expect(result).toHaveLength(1);
    // 9:00 is 60 min after startHour (8:00), so top = (60/600)*100 = 10%
    expect(result[0].top).toBeCloseTo(10, 1);
    expect(result[0].height).toBeCloseTo(10, 1);
    expect(result[0].column).toBe(0);
    expect(result[0].totalColumns).toBe(1);
  });

  it('assigns columns to two overlapping events', () => {
    const events = [timedEvent('a', 9, 0, 10, 30), timedEvent('b', 9, 30, 11, 0)];
    const result = positionEvents(events, day, startHour, endHour);
    expect(result).toHaveLength(2);

    const columns = result.map((r) => r.column).sort();
    expect(columns).toEqual([0, 1]);
    for (const r of result) {
      expect(r.totalColumns).toBe(2);
    }
  });

  it('handles three events in chain (A overlaps B, B overlaps C, not A-C)', () => {
    const events = [
      timedEvent('a', 9, 0, 10, 0), // 9:00 - 10:00
      timedEvent('b', 9, 30, 10, 30), // 9:30 - 10:30 (overlaps A and C)
      timedEvent('c', 10, 0, 11, 0) // 10:00 - 11:00 (overlaps B but not A)
    ];
    const result = positionEvents(events, day, startHour, endHour);
    expect(result).toHaveLength(3);

    const columns = result.map((r) => r.column);
    expect(new Set(columns).size).toBeGreaterThanOrEqual(2);

    const totals = new Set(result.map((r) => r.totalColumns));
    expect(totals.size).toBe(1);
  });

  it('enforces minimum height of 2%', () => {
    const events = [timedEvent('tiny', 9, 0, 9, 1)];
    const result = positionEvents(events, day, startHour, endHour);
    expect(result).toHaveLength(1);
    expect(result[0].height).toBe(2);
  });

  it('defaults to 1 hour duration when event has no end', () => {
    const event: CalendarEvent = {
      id: 'noend',
      title: 'No End',
      start: new Date(2026, 2, 10, 14, 0)
    };
    const result = positionEvents([event], day, startHour, endHour);
    expect(result).toHaveLength(1);
    expect(result[0].height).toBeCloseTo(10, 1);
  });

  it('returns empty array for no events', () => {
    expect(positionEvents([], day, startHour, endHour)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateTimeSlots
// ---------------------------------------------------------------------------
describe('generateTimeSlots', () => {
  it('generates 60-minute interval slots', () => {
    const slots = generateTimeSlots(8, 12, 60);
    expect(slots).toHaveLength(4); // 8, 9, 10, 11
    expect(slots[0]).toEqual({ hour: 8, minute: 0, label: '08:00' });
    expect(slots[3]).toEqual({ hour: 11, minute: 0, label: '11:00' });
  });

  it('generates 30-minute interval slots', () => {
    const slots = generateTimeSlots(8, 10, 30);
    expect(slots).toHaveLength(4); // 8:00, 8:30, 9:00, 9:30
    expect(slots[0]).toEqual({ hour: 8, minute: 0, label: '08:00' });
    expect(slots[1]).toEqual({ hour: 8, minute: 30, label: '08:30' });
    expect(slots[2]).toEqual({ hour: 9, minute: 0, label: '09:00' });
    expect(slots[3]).toEqual({ hour: 9, minute: 30, label: '09:30' });
  });

  it('handles full day (0-24)', () => {
    const slots = generateTimeSlots(0, 24, 60);
    expect(slots).toHaveLength(24);
    expect(slots[0].label).toBe('00:00');
    expect(slots[23].label).toBe('23:00');
  });

  it('returns empty for startHour >= endHour', () => {
    expect(generateTimeSlots(12, 12, 60)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getEventDayInfo
// ---------------------------------------------------------------------------
describe('getEventDayInfo', () => {
  it('returns correct info for a single-day event', () => {
    const event = { start: new Date(2026, 2, 10), end: new Date(2026, 2, 10) };
    const info = getEventDayInfo(event, new Date(2026, 2, 10));
    expect(info.totalDays).toBe(1);
    expect(info.dayIndex).toBe(0);
    expect(info.isStart).toBe(true);
    expect(info.isEnd).toBe(true);
  });

  it('returns correct info for start of a multi-day event', () => {
    const event = { start: new Date(2026, 2, 10), end: new Date(2026, 2, 13) };
    const info = getEventDayInfo(event, new Date(2026, 2, 10));
    expect(info.totalDays).toBe(4);
    expect(info.dayIndex).toBe(0);
    expect(info.isStart).toBe(true);
    expect(info.isEnd).toBe(false);
  });

  it('returns correct info for a middle day of a multi-day event', () => {
    const event = { start: new Date(2026, 2, 10), end: new Date(2026, 2, 13) };
    const info = getEventDayInfo(event, new Date(2026, 2, 11));
    expect(info.totalDays).toBe(4);
    expect(info.dayIndex).toBe(1);
    expect(info.isStart).toBe(false);
    expect(info.isEnd).toBe(false);
  });

  it('returns correct info for end of a multi-day event', () => {
    const event = { start: new Date(2026, 2, 10), end: new Date(2026, 2, 13) };
    const info = getEventDayInfo(event, new Date(2026, 2, 13));
    expect(info.totalDays).toBe(4);
    expect(info.dayIndex).toBe(3);
    expect(info.isStart).toBe(false);
    expect(info.isEnd).toBe(true);
  });

  it('treats event without end as single day', () => {
    const event = { start: new Date(2026, 2, 10) };
    const info = getEventDayInfo(event, new Date(2026, 2, 10));
    expect(info.totalDays).toBe(1);
    expect(info.isStart).toBe(true);
    expect(info.isEnd).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getContrastTextColor
// ---------------------------------------------------------------------------
describe('getContrastTextColor', () => {
  describe('oklch colors', () => {
    it('returns black for high-lightness oklch', () => {
      expect(getContrastTextColor('oklch(0.9 0.1 150)')).toBe('black');
    });

    it('returns white for low-lightness oklch', () => {
      expect(getContrastTextColor('oklch(0.3 0.1 150)')).toBe('white');
    });

    it('returns black for lightness at the boundary (0.61)', () => {
      expect(getContrastTextColor('oklch(0.61 0.2 200)')).toBe('black');
    });

    it('returns white for lightness at the boundary (0.59)', () => {
      expect(getContrastTextColor('oklch(0.59 0.2 200)')).toBe('white');
    });
  });

  describe('hex colors', () => {
    it('returns black for white (#ffffff)', () => {
      expect(getContrastTextColor('#ffffff')).toBe('black');
    });

    it('returns white for black (#000000)', () => {
      expect(getContrastTextColor('#000000')).toBe('white');
    });

    it('returns black for light yellow (#ffff00)', () => {
      expect(getContrastTextColor('#ffff00')).toBe('black');
    });

    it('handles shorthand hex (#fff)', () => {
      expect(getContrastTextColor('#fff')).toBe('black');
    });

    it('handles shorthand hex (#000)', () => {
      expect(getContrastTextColor('#000')).toBe('white');
    });
  });

  describe('rgb colors', () => {
    it('returns black for light rgb color', () => {
      expect(getContrastTextColor('rgb(255, 255, 255)')).toBe('black');
    });

    it('returns white for dark rgb color', () => {
      expect(getContrastTextColor('rgb(0, 0, 0)')).toBe('white');
    });

    it('returns white for dark blue rgb', () => {
      expect(getContrastTextColor('rgb(0, 0, 128)')).toBe('white');
    });
  });

  describe('fallback', () => {
    it('returns white for unrecognized color formats', () => {
      expect(getContrastTextColor('hsl(120, 50%, 50%)')).toBe('white');
    });

    it('returns white for arbitrary string', () => {
      expect(getContrastTextColor('not-a-color')).toBe('white');
    });
  });
});
