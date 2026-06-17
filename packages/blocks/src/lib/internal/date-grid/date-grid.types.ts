/**
 * Shared types for the headless date-grid core (`lib/internal/date-grid`).
 *
 * This layer knows only about dates, cells, navigation, focus and selection —
 * never about events or domain items. Calendar and Planner build their visible
 * markup on top of it.
 */

/** View modes the grid can lay out. Cell-based views (month/week/range) render
 * through `DateGridScaffold`; `day` is a navigation/geometry mode whose visible
 * markup (time grid) stays Calendar-specific. */
export type DateGridView = 'month' | 'week' | 'range' | 'day';

/** Selection cardinality. Planner uses only `single`; Calendar uses all three. */
export type DateGridSelectionMode = 'single' | 'range' | 'multiple';

/** An inclusive start/end date pair. */
export interface DateGridRange {
  start: Date;
  end: Date;
}

/** The current selection value, shaped by the active `DateGridSelectionMode`. */
export type DateGridSelection = Date | Date[] | DateGridRange;

/** Direction of the most recent navigation, for enter/exit transitions. */
export type NavDirection = 'forward' | 'backward' | null;

/**
 * Per-day context shared by every cell-based view. Calendar and Planner enrich
 * this with their own fields (events / bucketed items) before handing it to
 * their cell snippet.
 */
export interface DayCellInfo {
  /** The cell's date (local midnight). */
  date: Date;
  /** `YYYY-MM-DD` local key for this date. */
  isoDate: string;
  /** Whether this date is today. */
  isToday: boolean;
  /** Whether this date is a Saturday or Sunday. */
  isWeekend: boolean;
  /** Whether this date falls outside the focused month (month view) or the
   * requested range (range view). Always false for week/day. */
  isOutside: boolean;
  /** Whether this date currently holds the roving keyboard focus. */
  isFocused: boolean;
  /** Whether this date is disabled (min/max bounds or `isDateDisabled`). */
  isDisabled: boolean;
  /** ISO 8601 week number of this date. */
  weekNumber: number;
}

/** Per-column context for the weekday header row. */
export interface DayHeaderInfo {
  /** Localized weekday name in the requested short format (e.g. "Mo"). */
  weekday: string;
  /** Localized narrow weekday name (e.g. "M"). */
  weekdayNarrow: string;
  /** Column index, 0–6, counted from `weekStartsOn`. */
  index: number;
  /** Whether this column is a weekend column. */
  isWeekend: boolean;
  /** The concrete date for this column in single-week views (week/day);
   * `undefined` in month/range views where a column spans many dates. */
  date?: Date;
}

/**
 * The reactive surface a `DateGridController` exposes through context. Mirrors
 * the controller's public getters/methods so sub-components (Scaffold, view
 * grids, headers) can consume it without holding the instance directly.
 */
export interface DateGridContext {
  // Inputs (reflected)
  readonly view: DateGridView;
  readonly referenceDate: Date;
  readonly weekStartsOn: number;
  readonly locale: string;
  readonly today: Date;
  readonly disabled: boolean;

  // Derived geometry
  readonly cells: Date[][];
  readonly weekDates: Date[];
  readonly weekdayNames: string[];
  readonly weekdayNamesNarrow: string[];
  readonly title: string;
  readonly rangeStart: Date;
  readonly rangeEnd: Date;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;

  // Focus / hover / animation state
  readonly focusedDate: Date;
  readonly hoveredDate: Date | null;
  readonly navDirection: NavDirection;

  // Selection
  readonly selectionMode: DateGridSelectionMode;

  // Per-day helpers
  weekNumberFor(date: Date): number;
  dayCellInfo(date: Date): DayCellInfo;
  isToday(date: Date): boolean;
  isWeekend(date: Date): boolean;
  isOutside(date: Date): boolean;
  isDisabled(date: Date): boolean;
  isFocused(date: Date): boolean;
  isSelected(date: Date): boolean;
  isRangeStart(date: Date): boolean;
  isRangeEnd(date: Date): boolean;
  isInSelectedRange(date: Date): boolean;
  isInPreviewRange(date: Date): boolean;

  // Actions
  navigate(delta: number): void;
  goToToday(): void;
  goTo(date: Date): void;
  selectDate(date: Date): void;
  setFocusedDate(date: Date): void;
  moveFocus(deltaDays: number): void;
  setHoveredDate(date: Date | null): void;
}
