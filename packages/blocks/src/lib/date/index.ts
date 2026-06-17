/**
 * `@urbicon-ui/blocks/date` — Svelte-free, zero-dependency date geometry.
 *
 * Pure local-date functions shared by Calendar, Planner and consumer apps:
 * ISO week numbers, week/month grids, range iteration, comparison predicates
 * and locale-aware formatting. Server- and client-safe (no `window`, no UTC
 * drift), so a SvelteKit load function and a browser component can agree on
 * the same week.
 *
 * @example
 * ```ts
 * import { getWeekNumber, eachDayOfRange, toIso } from '@urbicon-ui/blocks/date';
 * ```
 */

export { daysBetween, isInMonth, isInRange, isSameDay, isWeekend, stripTime } from './compare';
export {
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
export { clampMonth, getMonthGrid, getWeekDates, getWeekNumber, getYearMonths } from './geometry';
export { addDays, eachDayOfRange, endOfWeek, isoToDate, startOfWeek, toIso } from './range';
