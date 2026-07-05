import { describe, expect, it } from 'vitest';
import {
  clampDate,
  daysBetween,
  isInMonth,
  isInRange,
  isSameDay,
  isWeekend,
  stripTime
} from './compare';

describe('isSameDay', () => {
  it('returns true for the same day regardless of time', () => {
    const a = new Date(2026, 2, 12, 10, 30);
    const b = new Date(2026, 2, 12, 22, 0);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns false for different days', () => {
    expect(isSameDay(new Date(2026, 2, 12), new Date(2026, 2, 13))).toBe(false);
  });

  it('returns false for same day different month', () => {
    expect(isSameDay(new Date(2026, 2, 12), new Date(2026, 3, 12))).toBe(false);
  });

  it('returns false for same day different year', () => {
    expect(isSameDay(new Date(2026, 2, 12), new Date(2027, 2, 12))).toBe(false);
  });
});

describe('isWeekend', () => {
  it('returns true for Saturday', () => {
    expect(isWeekend(new Date(2026, 2, 14))).toBe(true); // Sat Mar 14 2026
  });

  it('returns true for Sunday', () => {
    expect(isWeekend(new Date(2026, 2, 15))).toBe(true); // Sun Mar 15 2026
  });

  it('returns false for weekdays Monday–Friday', () => {
    // Mon Mar 9 .. Fri Mar 13 2026
    for (let day = 9; day <= 13; day++) {
      expect(isWeekend(new Date(2026, 2, day))).toBe(false);
    }
  });

  it('ignores the time component', () => {
    expect(isWeekend(new Date(2026, 2, 14, 23, 59))).toBe(true);
  });
});

describe('isInRange', () => {
  const start = new Date(2026, 2, 10);
  const end = new Date(2026, 2, 20);

  it('returns true for dates within range', () => {
    expect(isInRange(new Date(2026, 2, 15), start, end)).toBe(true);
  });

  it('returns true for range boundaries', () => {
    expect(isInRange(new Date(2026, 2, 10), start, end)).toBe(true);
    expect(isInRange(new Date(2026, 2, 20), start, end)).toBe(true);
  });

  it('returns false for dates outside range', () => {
    expect(isInRange(new Date(2026, 2, 9), start, end)).toBe(false);
    expect(isInRange(new Date(2026, 2, 21), start, end)).toBe(false);
  });

  it('handles reversed start/end (order-independent)', () => {
    expect(isInRange(new Date(2026, 2, 15), end, start)).toBe(true);
  });

  it('ignores time when comparing boundaries', () => {
    expect(isInRange(new Date(2026, 2, 20, 23, 0), start, end)).toBe(true);
  });
});

describe('clampDate', () => {
  const min = new Date(2026, 2, 10);
  const max = new Date(2026, 2, 20);

  it('returns an in-range date unchanged, preserving its time-of-day', () => {
    const inside = new Date(2026, 2, 15, 14, 30);
    expect(clampDate(inside, min, max)).toBe(inside);
  });

  it('snaps a date before minDate to local midnight of minDate', () => {
    const clamped = clampDate(new Date(2026, 2, 5, 9, 0), min, max);
    expect(isSameDay(clamped, min)).toBe(true);
    expect(clamped.getHours()).toBe(0);
  });

  it('snaps a date after maxDate to local midnight of maxDate', () => {
    const clamped = clampDate(new Date(2026, 2, 25, 9, 0), min, max);
    expect(isSameDay(clamped, max)).toBe(true);
    expect(clamped.getHours()).toBe(0);
  });

  it('leaves boundary days untouched (inclusive), keeping their time', () => {
    const onMin = new Date(2026, 2, 10, 8, 0);
    const onMax = new Date(2026, 2, 20, 23, 0);
    expect(clampDate(onMin, min, max)).toBe(onMin);
    expect(clampDate(onMax, min, max)).toBe(onMax);
  });

  it('compares on calendar days, so a later time on the max day is not clamped', () => {
    // Regression guard for week/day navigation: a reference date carrying a
    // time-of-day on the boundary day must survive, not snap to midnight.
    const lateOnMax = new Date(2026, 2, 20, 18, 45);
    expect(clampDate(lateOnMax, min, max)).toBe(lateOnMax);
  });

  it('honours a single bound and returns the date when both are omitted', () => {
    const d = new Date(2026, 2, 15);
    expect(clampDate(d)).toBe(d);
    expect(isSameDay(clampDate(new Date(2026, 2, 5), min, undefined), min)).toBe(true);
    expect(isSameDay(clampDate(new Date(2026, 2, 25), undefined, max), max)).toBe(true);
    // A date below an omitted-min / above an omitted-max stays put.
    expect(clampDate(new Date(2026, 2, 5), undefined, max)).toEqual(new Date(2026, 2, 5));
  });
});

describe('isInMonth', () => {
  it('returns true for dates in the month', () => {
    expect(isInMonth(new Date(2026, 2, 15), 2, 2026)).toBe(true);
  });

  it('returns false for dates in a different month', () => {
    expect(isInMonth(new Date(2026, 1, 28), 2, 2026)).toBe(false);
  });

  it('returns false for same month different year', () => {
    expect(isInMonth(new Date(2027, 2, 15), 2, 2026)).toBe(false);
  });
});

describe('stripTime', () => {
  it('returns local midnight of the same day', () => {
    const stripped = stripTime(new Date(2026, 2, 12, 14, 30, 45));
    expect(stripped.getHours()).toBe(0);
    expect(stripped.getMinutes()).toBe(0);
    expect(stripped.getSeconds()).toBe(0);
    expect(stripped.getDate()).toBe(12);
    expect(stripped.getMonth()).toBe(2);
  });
});

describe('daysBetween', () => {
  it('returns 0 for the same day', () => {
    expect(daysBetween(new Date(2026, 2, 10), new Date(2026, 2, 10))).toBe(0);
  });

  it('returns 1 for adjacent days', () => {
    expect(daysBetween(new Date(2026, 2, 10), new Date(2026, 2, 11))).toBe(1);
  });

  it('returns negative for reversed dates', () => {
    expect(daysBetween(new Date(2026, 2, 11), new Date(2026, 2, 10))).toBe(-1);
  });

  it('works across months', () => {
    expect(daysBetween(new Date(2026, 0, 30), new Date(2026, 1, 2))).toBe(3);
  });

  it('works across years', () => {
    expect(daysBetween(new Date(2026, 11, 30), new Date(2027, 0, 2))).toBe(3);
  });

  it('handles large spans', () => {
    expect(daysBetween(new Date(2026, 0, 1), new Date(2026, 11, 31))).toBe(364);
  });

  it('stays DST-safe across the European spring-forward boundary', () => {
    // 2026-03-29 is the European DST switch (a 23-hour local day). A naive
    // millisecond division would round to 0; the UTC-midnight basis keeps it 1.
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 29))).toBe(1);
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });
});
