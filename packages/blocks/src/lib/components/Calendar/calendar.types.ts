import type { Snippet } from 'svelte';

/** Category for grouping events by type with shared color coding. */
export interface CalendarEventCategory {
  /** Unique identifier for this category. */
  id: string;
  /** Display label (e.g., "Restmuell", "Papier"). */
  label: string;
  /** CSS color value (hex, oklch, rgb) or Tailwind class for dot/border rendering. */
  color: string;
  /** Optional icon snippet rendered alongside the label. */
  icon?: Snippet;
}

/** A single calendar event/appointment. */
export interface CalendarEvent {
  /** Unique identifier. */
  id: string;
  /** Event title. */
  title: string;
  /** Start date/time. */
  start: Date;
  /** End date/time. Optional for all-day events. */
  end?: Date;
  /** Whether this is an all-day event. @default true */
  allDay?: boolean;
  /** Category ID linking to CalendarEventCategory. */
  categoryId?: string;
  /** Optional description or status text. */
  description?: string;
  /** Optional secondary helper text. */
  helperText?: string;
  /** Arbitrary metadata for consumer use. */
  meta?: Record<string, unknown>;
  /** Recurrence rule for repeating events. */
  recurrence?: RecurrenceRule;
}

/** Recurrence rule for repeating events. */
export interface RecurrenceRule {
  /** How often the event repeats. */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Repeat every N periods (e.g. 2 = every 2 weeks). @default 1 */
  interval?: number;
  /**
   * Weekdays the rule applies to (0=Sun, 1=Mon, ..., 6=Sat).
   *
   * Its meaning depends on `frequency`, following RFC 5545:
   * - `weekly` — GENERATES one occurrence per listed day, in every interval-th
   *   week. `{ weekly, interval: 2, byDay: [1,2,3,4,5] }` = weekdays of every
   *   other week.
   * - `daily` — FILTERS the days the rule would otherwise produce.
   *   `{ daily, interval: 2, byDay: [1,2,3,4,5] }` = every other day, but only
   *   when it falls on a weekday.
   *
   * The two are not interchangeable once `interval` is involved. Ignored by
   * `monthly` and `yearly` (use `byMonthDay`).
   */
  byDay?: number[];
  /** Specific day(s) of month for monthly recurrence (1-31). */
  byMonthDay?: number[];
  /** End date — recurrence stops after this date (inclusive). */
  until?: Date;
  /** Maximum number of occurrences (including the original). */
  count?: number;
  /** Exception dates where the event does NOT occur. */
  exceptions?: Date[];
}

/** Selection value depending on selection mode. */
export type CalendarSelection = Date | DateRange | Date[];

/** A date range with inclusive start and end. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Context passed to custom dayCell snippets. */
export interface DayCellContext {
  date: Date;
  events: CalendarEvent[];
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isOutsideMonth: boolean;
  isFocused: boolean;
}

/** Metadata for a multi-day event on a specific date. */
export interface EventDayInfo {
  event: CalendarEvent;
  /** 0-based index: which day of the multi-day event this is. */
  dayIndex: number;
  /** Total duration in days. 1 for single-day events. */
  totalDays: number;
  /** Whether this date is the start of the event. */
  isStart: boolean;
  /** Whether this date is the end of the event. */
  isEnd: boolean;
}

/** Context passed to custom eventItem snippets. */
export interface EventItemContext {
  event: CalendarEvent;
  category?: CalendarEventCategory;
  /** 0-based index: which day of the multi-day event (only set for multi-day). */
  dayIndex?: number;
  /** Total duration in days (only set for multi-day, > 1). */
  totalDays?: number;
  /** Whether this date is the start of the event. */
  isStart?: boolean;
  /** Whether this date is the end of the event. */
  isEnd?: boolean;
}

/** A single time slot in the time grid. */
export interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}

/** A positioned event in the time grid. */
export interface PositionedEvent {
  event: CalendarEvent;
  /** Top offset as percentage of grid height. */
  top: number;
  /** Height as percentage of grid height. */
  height: number;
  /** Column index when events overlap (0-based). */
  column: number;
  /** Total number of overlapping columns. */
  totalColumns: number;
}

/** A segment of a multi-day event bar rendered within one week row. */
export interface MultiDayBarSegment {
  /** Event ID (resolved to full event object by the consumer). */
  eventId: string;
  /** 0-based start column in the 7-column grid. */
  startCol: number;
  /** Number of columns this segment spans. */
  spanCols: number;
  /** Whether this is the first visual segment of the event. */
  isFirstSegment: boolean;
  /** Whether this is the last visual segment of the event. */
  isLastSegment: boolean;
  /** Vertical row index for stacking (0, 1, 2, ...). */
  row: number;
}

/** Available view modes for the calendar. */
export type CalendarViewMode = 'month' | 'year' | 'week' | 'day' | 'agenda';

/** Context passed to custom header snippets. */
export interface HeaderContext {
  view: CalendarViewMode;
  month: number;
  year: number;
  title: string;
  navigate: (delta: number) => void;
  navigateMonth: (delta: number) => void;
  goToToday: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Whether today is within `[minDate, maxDate]`; gate a custom Today control on it. */
  canGoToToday: boolean;
}
