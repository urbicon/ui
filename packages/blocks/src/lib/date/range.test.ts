import { describe, expect, it } from 'vitest';
import { addDays, eachDayOfRange, endOfWeek, isoToDate, startOfWeek, toIso } from './range';

describe('toIso', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(toIso(new Date(2026, 2, 7))).toBe('2026-03-07');
  });

  it('zero-pads month and day', () => {
    expect(toIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses the local calendar day, not UTC (no off-by-one)', () => {
    // Late-evening local time must still report the local date, even where the
    // UTC date has already rolled over.
    expect(toIso(new Date(2026, 5, 16, 23, 30))).toBe('2026-06-16');
  });
});

describe('isoToDate', () => {
  it('parses YYYY-MM-DD as local midnight', () => {
    const date = isoToDate('2026-06-16');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(16);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('round-trips with toIso', () => {
    const iso = '2026-03-29'; // European DST switch day
    expect(toIso(isoToDate(iso))).toBe(iso);
  });

  it('does not apply UTC parsing (would shift the day in non-UTC zones)', () => {
    // `new Date('2026-01-01')` would be UTC midnight; isoToDate must be local.
    expect(isoToDate('2026-01-01').getDate()).toBe(1);
  });

  it('throws on a non-existent day', () => {
    expect(() => isoToDate('2026-02-30')).toThrow(RangeError);
  });

  it('throws on an out-of-range month', () => {
    expect(() => isoToDate('2026-13-01')).toThrow(RangeError);
  });

  it('throws on malformed input', () => {
    expect(() => isoToDate('foo')).toThrow(RangeError);
    expect(() => isoToDate('2026-3-7')).toThrow(RangeError); // not zero-padded
    expect(() => isoToDate('2026-03-07T12:00:00Z')).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays(new Date(2026, 2, 10), 5);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(2);
  });

  it('subtracts with negative days', () => {
    const result = addDays(new Date(2026, 2, 10), -12);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(26);
  });

  it('rolls over month boundaries', () => {
    const result = addDays(new Date(2026, 0, 30), 5);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(4);
  });

  it('rolls over year boundaries', () => {
    const result = addDays(new Date(2026, 11, 30), 3);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(2);
  });

  it('preserves the time of day', () => {
    const result = addDays(new Date(2026, 5, 10, 14, 30, 15), 3);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(15);
  });

  it('stays correct across the European spring-forward boundary', () => {
    // Adding a day to the day before DST must land on the next calendar day,
    // not skip or repeat one.
    expect(addDays(new Date(2026, 2, 28), 1).getDate()).toBe(29);
    expect(addDays(new Date(2026, 2, 29), 1).getDate()).toBe(30);
  });
});

describe('startOfWeek', () => {
  it('returns Monday for weekStartsOn=1', () => {
    // Thursday March 12, 2026 → Monday March 9
    const result = startOfWeek(new Date(2026, 2, 12), 1);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(0); // local midnight
  });

  it('returns Sunday for weekStartsOn=0', () => {
    const result = startOfWeek(new Date(2026, 2, 12), 0);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(8);
  });

  it('returns the same day when already at the week start', () => {
    const result = startOfWeek(new Date(2026, 2, 9), 1); // Monday
    expect(result.getDate()).toBe(9);
  });
});

describe('endOfWeek', () => {
  it('returns Sunday for weekStartsOn=1', () => {
    const result = endOfWeek(new Date(2026, 2, 12), 1);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(15);
  });

  it('returns Saturday for weekStartsOn=0', () => {
    const result = endOfWeek(new Date(2026, 2, 12), 0);
    expect(result.getDay()).toBe(6); // Saturday
    expect(result.getDate()).toBe(14);
  });
});

describe('eachDayOfRange', () => {
  it('lists every day inclusive of both ends', () => {
    const days = eachDayOfRange(new Date(2026, 2, 10), new Date(2026, 2, 14));
    expect(days).toHaveLength(5);
    expect(days.map((d) => d.getDate())).toEqual([10, 11, 12, 13, 14]);
  });

  it('returns a single day when start equals end', () => {
    const days = eachDayOfRange(new Date(2026, 2, 10), new Date(2026, 2, 10));
    expect(days).toHaveLength(1);
    expect(days[0].getDate()).toBe(10);
  });

  it('returns an empty array for an inverted range', () => {
    expect(eachDayOfRange(new Date(2026, 2, 14), new Date(2026, 2, 10))).toEqual([]);
  });

  it('ignores the time component of the bounds', () => {
    const days = eachDayOfRange(new Date(2026, 2, 10, 23, 0), new Date(2026, 2, 11, 1, 0));
    expect(days).toHaveLength(2);
    expect(days[0].getHours()).toBe(0); // each entry is local midnight
  });

  it('spans month boundaries', () => {
    const days = eachDayOfRange(new Date(2026, 0, 30), new Date(2026, 1, 2));
    expect(days.map((d) => `${d.getMonth()}-${d.getDate()}`)).toEqual([
      '0-30',
      '0-31',
      '1-1',
      '1-2'
    ]);
  });

  it('counts the correct number of days across the European spring-forward boundary', () => {
    // 2026-03-29 is a 23-hour day in CET; the count must still be 3 calendar days.
    const days = eachDayOfRange(new Date(2026, 2, 28), new Date(2026, 2, 30));
    expect(days).toHaveLength(3);
    expect(days.map((d) => d.getDate())).toEqual([28, 29, 30]);
  });
});
