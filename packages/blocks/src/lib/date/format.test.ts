import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateFull,
  formatDateRange,
  formatDayTitle,
  formatMonthShort,
  formatMonthYear,
  formatWeekRange,
  formatWeekTitle,
  getWeekdayNames
} from './format';

describe('getWeekdayNames', () => {
  it('returns 7 weekday names', () => {
    expect(getWeekdayNames('de-DE', 1, 'short')).toHaveLength(7);
  });

  it('starts with Monday for weekStartsOn=1 (de-DE)', () => {
    const names = getWeekdayNames('de-DE', 1, 'short');
    expect(names[0]).toMatch(/^Mo/);
    expect(names[6]).toMatch(/^So/);
  });

  it('starts with Sunday for weekStartsOn=0 (en-US)', () => {
    const names = getWeekdayNames('en-US', 0, 'short');
    expect(names[0]).toMatch(/^Sun/);
    expect(names[6]).toMatch(/^Sat/);
  });

  it('returns narrow format names', () => {
    const names = getWeekdayNames('de-DE', 1, 'narrow');
    expect(names).toHaveLength(7);
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('formatMonthYear', () => {
  it('formats correctly for de-DE', () => {
    expect(formatMonthYear(2026, 2, 'de-DE')).toMatch(/M(ä|ae|a)rz 2026/);
  });

  it('formats correctly for en-US', () => {
    expect(formatMonthYear(2026, 2, 'en-US')).toBe('March 2026');
  });

  it('handles January (month 0)', () => {
    expect(formatMonthYear(2026, 0, 'en-US')).toBe('January 2026');
  });

  it('handles December (month 11)', () => {
    expect(formatMonthYear(2026, 11, 'en-US')).toBe('December 2026');
  });
});

describe('formatDate', () => {
  it('formats a date with weekday, day and month', () => {
    const result = formatDate(new Date(2026, 2, 12), 'de-DE'); // Thursday
    expect(result).toMatch(/Do/);
    expect(result).toMatch(/12/);
    expect(result).toMatch(/M(ä|ae|a)rz/);
  });
});

describe('formatDateFull', () => {
  it('formats a full date for aria-label', () => {
    const result = formatDateFull(new Date(2026, 2, 12), 'en-US');
    expect(result).toMatch(/Thursday/);
    expect(result).toMatch(/March/);
    expect(result).toMatch(/12/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatWeekTitle', () => {
  it('formats correctly for de-DE', () => {
    const result = formatWeekTitle(new Date(2026, 2, 12), 1, 'de-DE');
    expect(result).toMatch(/KW \d+/);
    expect(result).toMatch(/M(ä|ae|a)rz 2026/);
  });

  it('formats correctly for en-US', () => {
    const result = formatWeekTitle(new Date(2026, 2, 12), 1, 'en-US');
    expect(result).toMatch(/Week \d+/);
    expect(result).toMatch(/March 2026/);
  });

  it('uses the Thursday of the week to pick the month (two-month week)', () => {
    // Week of Mar 1, 2026 is Feb 23–Mar 1; Thursday Feb 26 → February.
    expect(formatWeekTitle(new Date(2026, 2, 1), 1, 'en-US')).toMatch(/February/);
    // Week of Mar 2, 2026 is Mar 2–8; Thursday Mar 5 → March.
    expect(formatWeekTitle(new Date(2026, 2, 2), 1, 'en-US')).toMatch(/March/);
  });
});

describe('formatWeekRange', () => {
  it('spans the week for de-DE (Mon–Sun)', () => {
    // Tue Jun 16, 2026 → week Mon Jun 15 .. Sun Jun 21
    const result = formatWeekRange(new Date(2026, 5, 16), 'de-DE', 1);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/21/);
    expect(result).toMatch(/Juni/);
  });

  it('spans the week for en-US', () => {
    const result = formatWeekRange(new Date(2026, 5, 16), 'en-US', 1);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/21/);
    expect(result).toMatch(/June/);
  });

  it('shows both months when the week straddles a boundary', () => {
    // Sun Mar 1, 2026 → week Mon Feb 23 .. Sun Mar 1
    const result = formatWeekRange(new Date(2026, 2, 1), 'en-US', 1);
    expect(result).toMatch(/February/);
    expect(result).toMatch(/March/);
  });
});

describe('formatDateRange', () => {
  it('formats a multi-week span with the year (de-DE)', () => {
    const result = formatDateRange(new Date(2026, 5, 15), new Date(2026, 6, 5), 'de-DE');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/5/);
    expect(result).toMatch(/2026/);
  });

  it('spans years', () => {
    const result = formatDateRange(new Date(2026, 11, 28), new Date(2027, 0, 3), 'en-US');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/2027/);
  });
});

describe('formatDayTitle', () => {
  it('formats correctly for de-DE', () => {
    const result = formatDayTitle(new Date(2026, 2, 19), 'de-DE');
    expect(result).toMatch(/Do/);
    expect(result).toMatch(/19/);
    expect(result).toMatch(/M(ä|ae|a)rz/);
    expect(result).toMatch(/2026/);
  });

  it('formats correctly for en-US', () => {
    const result = formatDayTitle(new Date(2026, 2, 19), 'en-US');
    expect(result).toMatch(/Thu/);
    expect(result).toMatch(/March/);
    expect(result).toMatch(/19/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatMonthShort', () => {
  it('formats correctly for de-DE', () => {
    expect(formatMonthShort(2, 'de-DE')).toMatch(/M(ä|ae|a)r/);
  });

  it('formats correctly for en-US', () => {
    expect(formatMonthShort(2, 'en-US')).toBe('Mar');
  });

  it('handles January (month 0)', () => {
    expect(formatMonthShort(0, 'en-US')).toBe('Jan');
  });

  it('handles December (month 11)', () => {
    expect(formatMonthShort(11, 'en-US')).toBe('Dec');
  });
});
