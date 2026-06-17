/**
 * Calendar grid geometry — pure `date → date` layout math with no Svelte or
 * event/item awareness. The shared foundation under both Calendar and Planner:
 * month grids, week rows, ISO week numbers, year month-lists.
 */

/**
 * Generate a 2D grid of dates for a month view.
 * Each row is a 7-element array representing one week. Includes padding days
 * from the previous/next months so every row is full.
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
 * Get the 7 dates for the week containing the given date.
 *
 * @param date - Any date within the target week
 * @param weekStartsOn - Day the week starts on (0=Sun, 1=Mon, ..., 6=Sat)
 * @returns Array of 7 Date objects starting from the week-start day
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
 * Get the ISO 8601 week number for a date (weeks start Monday; week 1 contains
 * the year's first Thursday).
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to the nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
