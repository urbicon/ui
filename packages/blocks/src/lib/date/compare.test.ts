import { describe, expect, it } from 'vitest';
import { daysBetween, isInMonth, isInRange, isSameDay, isWeekend, stripTime } from './compare';

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
