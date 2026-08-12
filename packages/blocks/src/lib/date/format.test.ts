import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateFull,
  formatDateRange,
  formatDayTitle,
  formatMonthShort,
  formatMonthYear,
  formatTimeRange,
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

describe('formatTimeRange', () => {
  // Every case passes its locale explicitly: vitest runs under the machine's
  // LANG (de_DE here), so an assertion against the default would be an
  // assertion about the runtime, not about the function.
  //
  // Why the single-time cases assert exactly and the range case does not — both
  // measured 2026-08-12 in this worktree, Node 25.2.1 / Node 26.3.0 / Bun 1.4.0:
  // the single-time pattern is character-identical in all three ("9:05",
  // "9:05 AM" with a plain U+0020 before the marker). The RANGE pattern is not:
  // Node appends " Uhr" to de-DE and Bun does not, and en-US wraps the dash in
  // U+2009 under Node against U+0020 under Bun. So the looseness sits exactly
  // where a disagreement was observed, not as a blanket hedge.
  const start = new Date(2026, 5, 16, 9, 5);
  const end = new Date(2026, 5, 16, 10, 30);

  it('formats a lone start time in the locale form', () => {
    expect(formatTimeRange(start, undefined, 'de-DE')).toBe('9:05');
    expect(formatTimeRange(start, undefined, 'en-US')).toBe('9:05 AM');
  });

  it('formats a start–end span within one day', () => {
    // Both times, not the exact punctuation: ICU decides the separator, the
    // padding and the suffix, and the runtimes disagree — Node renders de-DE as
    // "09:05–10:30 Uhr", Bun drops the "Uhr". The `\s` before the meridiem is
    // one character, not an optional one: every runtime measured puts exactly
    // one space there, and `\s` also covers the narrow no-break space a later
    // CLDR could switch to.
    expect(formatTimeRange(start, end, 'de-DE')).toMatch(/^0?9:05\D+10:30/);
    expect(formatTimeRange(start, end, 'en-US')).toMatch(/^9:05\D+10:30\s(AM|am)/);
  });

  it('reuses one formatter per locale', () => {
    // The cache is an optimisation, so what is asserted is that it stays
    // invisible: two calls for two locales must not bleed into each other.
    expect(formatTimeRange(start, undefined, 'de-DE')).toBe('9:05');
    expect(formatTimeRange(start, undefined, 'en-US')).toBe('9:05 AM');
    expect(formatTimeRange(start, undefined, 'de-DE')).toBe('9:05');
  });

  it('follows the locale hour cycle rather than a hardcoded 24h clock', () => {
    const afternoon = new Date(2026, 5, 16, 14, 0);
    expect(formatTimeRange(afternoon, undefined, 'de-DE')).toBe('14:00');
    expect(formatTimeRange(afternoon, undefined, 'en-US')).toBe('2:00 PM');
  });

  it('drops an end that falls on another day — that range would print full dates', () => {
    const nextDay = new Date(2026, 5, 18, 17, 0);
    expect(formatTimeRange(start, nextDay, 'de-DE')).toBe('9:05');
    expect(formatTimeRange(start, nextDay, 'de-DE')).not.toMatch(/2026/);
  });

  it('survives an unparseable end instead of throwing inside a derived', () => {
    // Intl.formatRange throws a RangeError on an invalid date; the same-day
    // guard filters it out first (NaN is never "the same day").
    expect(formatTimeRange(start, new Date(Number.NaN), 'de-DE')).toBe('9:05');
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
