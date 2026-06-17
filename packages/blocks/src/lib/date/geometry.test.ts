import { describe, expect, it } from 'vitest';
import { getMonthGrid, getWeekDates, getWeekNumber, getYearMonths } from './geometry';

describe('getMonthGrid', () => {
  it('returns rows of 7 days each', () => {
    const grid = getMonthGrid(2026, 2, 1); // March 2026, Monday start
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });

  it('returns 4-6 weeks', () => {
    for (let m = 0; m < 12; m++) {
      const grid = getMonthGrid(2026, m, 1);
      expect(grid.length).toBeGreaterThanOrEqual(4);
      expect(grid.length).toBeLessThanOrEqual(6);
    }
  });

  it('includes all days of the month', () => {
    const grid = getMonthGrid(2026, 2, 1); // March 2026 has 31 days
    const allDates = grid.flat();
    const marchDays = allDates.filter((d) => d.getMonth() === 2 && d.getFullYear() === 2026);
    expect(marchDays).toHaveLength(31);
  });

  it('starts rows on the correct weekday for weekStartsOn=1 (Monday)', () => {
    const grid = getMonthGrid(2026, 2, 1); // March 2026
    for (const week of grid) {
      expect(week[0].getDay()).toBe(1); // Monday
    }
  });

  it('starts rows on the correct weekday for weekStartsOn=0 (Sunday)', () => {
    const grid = getMonthGrid(2026, 2, 0); // March 2026
    for (const week of grid) {
      expect(week[0].getDay()).toBe(0); // Sunday
    }
  });

  it('includes padding days from previous month', () => {
    // March 2026 starts on Sunday. With weekStartsOn=1 (Monday),
    // we need 6 padding days from February
    const grid = getMonthGrid(2026, 2, 1);
    const firstDay = grid[0][0];
    expect(firstDay.getMonth()).toBe(1); // February
    expect(firstDay.getDate()).toBe(23); // Feb 23
  });

  it('handles February in leap years', () => {
    const grid = getMonthGrid(2024, 1, 1); // Feb 2024 (leap year)
    const allDates = grid.flat();
    const febDays = allDates.filter((d) => d.getMonth() === 1 && d.getFullYear() === 2024);
    expect(febDays).toHaveLength(29);
  });

  it('handles February in non-leap years', () => {
    const grid = getMonthGrid(2026, 1, 1); // Feb 2026 (not leap)
    const allDates = grid.flat();
    const febDays = allDates.filter((d) => d.getMonth() === 1 && d.getFullYear() === 2026);
    expect(febDays).toHaveLength(28);
  });

  it('handles months that need 6 rows', () => {
    // January 2028 starts on Saturday → needs 6 rows with Monday start
    const grid = getMonthGrid(2028, 0, 1);
    expect(grid.length).toBe(6);
  });

  it('handles December to January transition (padding)', () => {
    const grid = getMonthGrid(2026, 11, 1); // December 2026
    const lastWeek = grid[grid.length - 1];
    const hasJanuary = lastWeek.some((d) => d.getMonth() === 0 && d.getFullYear() === 2027);
    // December 2026 ends on Thursday, so last row should have Jan padding
    expect(hasJanuary).toBe(true);
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    const dates = getWeekDates(new Date(2026, 2, 12), 1);
    expect(dates).toHaveLength(7);
  });

  it('starts on Monday when weekStartsOn=1', () => {
    // March 12, 2026 is a Thursday
    const dates = getWeekDates(new Date(2026, 2, 12), 1);
    expect(dates[0].getDay()).toBe(1); // Monday
    expect(dates[0].getDate()).toBe(9); // March 9
    expect(dates[6].getDay()).toBe(0); // Sunday
    expect(dates[6].getDate()).toBe(15); // March 15
  });

  it('starts on Sunday when weekStartsOn=0', () => {
    const dates = getWeekDates(new Date(2026, 2, 12), 0);
    expect(dates[0].getDay()).toBe(0); // Sunday
    expect(dates[0].getDate()).toBe(8); // March 8
    expect(dates[6].getDay()).toBe(6); // Saturday
    expect(dates[6].getDate()).toBe(14); // March 14
  });

  it('handles week spanning month boundary', () => {
    // March 1, 2026 (Sunday), weekStartsOn=1 → Monday Feb 23
    const dates = getWeekDates(new Date(2026, 2, 1), 1);
    expect(dates[0].getMonth()).toBe(1); // February
    expect(dates[0].getDate()).toBe(23);
    expect(dates[6].getMonth()).toBe(2); // March
    expect(dates[6].getDate()).toBe(1);
  });

  it('handles week spanning year boundary', () => {
    // Dec 31, 2026 is a Thursday, weekStartsOn=1 → Monday Dec 28
    const dates = getWeekDates(new Date(2026, 11, 31), 1);
    expect(dates[0].getDate()).toBe(28);
    expect(dates[0].getMonth()).toBe(11); // December
    expect(dates[6].getDate()).toBe(3);
    expect(dates[6].getMonth()).toBe(0); // January 2027
    expect(dates[6].getFullYear()).toBe(2027);
  });

  it('returns the same start date when given the start of the week', () => {
    // Monday March 9, 2026 with weekStartsOn=1
    const dates = getWeekDates(new Date(2026, 2, 9), 1);
    expect(dates[0].getDate()).toBe(9);
    expect(dates[0].getMonth()).toBe(2);
  });
});

describe('getWeekNumber', () => {
  it('returns week 1 for early January', () => {
    expect(getWeekNumber(new Date(2026, 0, 1))).toBe(1);
  });

  it('returns correct week for mid-year', () => {
    // July 1 2026 is a Wednesday
    expect(getWeekNumber(new Date(2026, 6, 1))).toBe(27);
  });

  it('handles year boundary (Dec 31 2026 is week 53)', () => {
    // Dec 31, 2026 is a Thursday → ISO week 53
    expect(getWeekNumber(new Date(2026, 11, 31))).toBe(53);
  });
});

describe('getYearMonths', () => {
  it('returns 12 items', () => {
    expect(getYearMonths(2026)).toHaveLength(12);
  });

  it('returns correct month indices (0–11)', () => {
    const months = getYearMonths(2026);
    for (let i = 0; i < 12; i++) {
      expect(months[i].month).toBe(i);
      expect(months[i].year).toBe(2026);
    }
  });

  it('uses the given year', () => {
    const months = getYearMonths(2030);
    expect(months[0].year).toBe(2030);
    expect(months[11].year).toBe(2030);
  });
});
