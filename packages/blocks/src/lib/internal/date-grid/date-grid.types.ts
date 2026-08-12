/**
 * Shared types for the headless date-grid core (`lib/internal/date-grid`).
 *
 * The CONTROLLER in this layer knows only about dates, cells, navigation, focus
 * and selection — never about events or domain items. Calendar, Planner and
 * ResourceTimeline build their visible markup on top of it.
 *
 * Two types here are the exception, and deliberately so: `DateRange` and
 * `DateCategory` are the surfaces' shared FACADE vocabulary, public and
 * re-exported by each surface (the module itself stays internal, see
 * `index.ts`). `DateCategory` does name domain items — it is the colour bucket
 * behind an event, a span and a legend row. It lives here because the
 * alternative was worse: each of these types stood as a set of per-component
 * twins (`DateRange` as `DateGridRange` + Calendar's `DateRange` +
 * `PlannerRange` + an inline `{ start; end }`; `DateCategory` as
 * `CalendarEventCategory` + `TimelineCategory`, identical but for an `icon` no
 * legend ever rendered), and twins of one shape are what let two facades drift
 * while the engine underneath stays shared (#191).
 */

/** View modes the grid can lay out. Cell-based views (month/week/range) render
 * through `DateGridScaffold`; `day` is a navigation/geometry mode whose visible
 * markup (time grid) stays Calendar-specific. */
export type DateGridView = 'month' | 'week' | 'range' | 'day';

/** Selection cardinality. Planner uses only `single`; Calendar uses all three. */
export type DateGridSelectionMode = 'single' | 'range' | 'multiple';

/**
 * An inclusive start/end date pair — a selected range, a visible window, the
 * range `onNavigate` reports. One type for every date surface.
 *
 * `ResourceTimeline.getRange` is deliberately *not* this type: it also accepts
 * local date strings (`'2026-06-16'`), which a selection value must not.
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * A colour bucket for the items a date surface draws — Calendar's events,
 * ResourceTimeline's spans — and the entries of the legend below the grid. One
 * type for every surface, so moving categories between them is not a mapping
 * exercise.
 *
 * `color` takes any CSS colour value: hex, `rgb()`, `oklch()` or a
 * `var(--token)` reference. The label colour on top of it is computed, so a bar
 * stays legible on both a pale and a deep bucket.
 */
export interface DateCategory {
  /** Stable id — what an item's category accessor returns. */
  id: string;
  /** Display label, shown in the legend. */
  label: string;
  /** CSS colour value for the dot, bar or border. */
  color: string;
}

/** The current selection value, shaped by the active `DateGridSelectionMode`. */
export type DateGridSelection = Date | Date[] | DateRange;

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
