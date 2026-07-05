/**
 * Public + internal types for the Planner component (date-grid layer 2b).
 *
 * Planner buckets a generic `T[]` by calendar day and renders each day through
 * a consumer `cell` snippet. These types describe the snippet contexts the
 * consumer receives and the internal Svelte context `PlannerHeader` reads.
 */

/** Cell-based views Planner lays out. (`day`/`agenda`/`year` stay Calendar's.) */
export type PlannerView = 'week' | 'month' | 'range';

/** An inclusive start/end date pair — the visible window of the current view. */
export interface PlannerRange {
  start: Date;
  end: Date;
}

/**
 * The value the `cell` snippet receives per day — the heart of the API. `items`
 * carries the bucketed, sorted domain objects with their real `T` type (no
 * `CalendarEvent` cast).
 */
export interface PlannerCellContext<T> {
  /** The cell's date (local midnight). */
  date: Date;
  /** `YYYY-MM-DD` local key for this date — the same key items were bucketed on. */
  isoDate: string;
  /** Items falling on this day, bucketed and sorted (the consumer's `T`). */
  items: T[];
  /** Whether this date is today. */
  isToday: boolean;
  /** Whether this date is the active selected day (`selectedDate`). */
  isSelected: boolean;
  /** Whether this date is a Saturday or Sunday. */
  isWeekend: boolean;
  /** Whether this date spills outside the focused month / requested range. */
  isOutsideRange: boolean;
  /** ISO 8601 week number of this date. */
  weekNumber: number;
  /** Localized short weekday name (e.g. "Mo") — handy for stacked layouts. */
  weekday: string;
  /** Make this day the active selection (fires `onDateSelect`). */
  selectDate: () => void;
}

/** Per-column / per-day context for the weekday header snippet. */
export interface PlannerDayContext {
  /** The concrete date in single-week (`week`) view; `undefined` in month/range
   * where a column spans many dates. */
  date?: Date;
  /** `YYYY-MM-DD` local key, present only when `date` is. */
  isoDate?: string;
  /** Localized short weekday name (e.g. "Mo"). */
  weekday: string;
  /** Whether the column's concrete date is today (always false in month/range). */
  isToday: boolean;
  /** Whether this is a weekend column. */
  isWeekend: boolean;
  /** ISO week number of the column's date, when it has one. */
  weekNumber?: number;
}

/** Context for the `header` snippet — everything to build a custom toolbar. */
export interface PlannerHeaderContext {
  /** Localized title for the current view (e.g. "KW 25 · 15.–21. Juni"). */
  title: string;
  /** First visible date of the view. */
  rangeStart: Date;
  /** Last visible date of the view. */
  rangeEnd: Date;
  /** ISO week number of the reference date. */
  weekNumber: number;
  /** The active view. */
  view: PlannerView;
  /** Step the view by `delta` periods (− back, + forward). */
  navigate: (delta: number) => void;
  /** Jump to the period containing today. */
  goToToday: () => void;
  /** Jump to the period containing `date`. */
  goTo: (date: Date) => void;
  /** Whether back-navigation is within bounds. */
  canGoBack: boolean;
  /** Whether forward-navigation is within bounds. */
  canGoForward: boolean;
  /** Whether today is within `[minDate, maxDate]`; gate a custom Today control on it. */
  canGoToToday: boolean;
}

/** Every styleable slot Planner exposes through `slotClasses`. */
export type PlannerSlotName =
  | 'base'
  | 'header'
  | 'headerTitle'
  | 'nav'
  | 'navButton'
  | 'grid'
  | 'weekdayHeader'
  | 'weekday'
  | 'weekNumber'
  | 'week'
  | 'cell'
  | 'cellHeader'
  | 'cellWeekday'
  | 'cellDate'
  | 'cellItems'
  | 'empty';

/**
 * The reactive surface Planner shares with `PlannerHeader` (and future
 * sub-components) through context. Mechanics come from the `DateGridController`;
 * the `slot` helper resolves a slot's classes against `unstyled` + `slotClasses`.
 */
export interface PlannerContext {
  readonly view: PlannerView;
  readonly title: string;
  readonly rangeStart: Date;
  readonly rangeEnd: Date;
  readonly weekNumber: number;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly canGoToToday: boolean;
  readonly locale: string;
  readonly disabled: boolean;
  navigate(delta: number): void;
  goToToday(): void;
  goTo(date: Date): void;
  /** Resolve a slot's class string (honours `unstyled` + merged `slotClasses`). */
  slot(name: PlannerSlotName, extra?: string): string;
}
