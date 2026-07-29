import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarSelection,
  CalendarViewMode,
  DayCellContext,
  EventItemContext,
  HeaderContext
} from './calendar.types';
import type { CalendarSlots, CalendarVariants } from './calendar.variants';

// ─── Slot names ───────────────────────────────────────────────

// `CalendarSlotName` stays the canonical internal key type: the shared
// `CalendarContext` (`slotClasses` map + `createSlotHelper`) and the
// per-view sub-components (e.g. `CalendarHeader`'s `slot()` helper) index
// slots by it. The public `slotClasses` prop below is derived from
// `CalendarSlots` (`SlotNames<typeof calendarVariants>`, the single source of
// truth in `calendar.variants.ts`); the two unions are kept in lockstep.
export type CalendarSlotName =
  | 'base'
  | 'header'
  | 'title'
  | 'nav'
  | 'navButton'
  | 'grid'
  | 'weekdayHeader'
  | 'weekday'
  | 'weekRow'
  | 'weekNumber'
  | 'day'
  | 'dayNumber'
  | 'dotContainer'
  | 'dot'
  | 'list'
  | 'dateHeader'
  | 'empty'
  | 'item'
  | 'colorBar'
  | 'eventTitle'
  | 'eventDescription'
  | 'eventHelper'
  | 'legend'
  | 'legendItem'
  | 'legendDot'
  | 'legendLabel'
  // Year view
  | 'yearGrid'
  | 'yearMonth'
  | 'yearMonthTitle'
  | 'yearMiniDay'
  | 'yearMiniDot'
  // Week view
  | 'weekGrid'
  | 'weekColumn'
  | 'weekColumnHeader'
  | 'weekColumnDayName'
  | 'weekColumnDayNumber'
  | 'weekEventList'
  // Week all-day event
  | 'weekAllDayEvent'
  // Multi-day bar
  | 'multiDayBar'
  | 'multiDayBarContainer'
  // Agenda view
  | 'agendaView'
  | 'agendaDayGroup'
  | 'agendaDayHeader'
  | 'agendaEventList'
  // Day view
  | 'dayView'
  | 'dayViewHeader'
  // Time grid
  | 'timeGrid'
  | 'timeLabel'
  | 'timeSlotRow'
  | 'timeDayColumn'
  | 'timeEvent'
  | 'allDayArea'
  | 'currentTimeLine'
  | 'weekTimeLayout'
  // Event popover
  | 'eventPopover'
  | 'eventPopoverItem'
  // Mini calendar sidebar
  | 'miniCalendar'
  | 'miniCalendarHeader'
  | 'miniCalendarTitle'
  | 'miniCalendarNavButton'
  | 'miniCalendarWeekday'
  | 'miniCalendarDay';

// ─── CalendarProps ────────────────────────────────────────────

/**
 * @summary Appointments on a real calendar — month, week or day, with multi-day spans and recurrence.
 * @description Flexible calendar component with month, year, week, and day views.
 * Renders timed appointments, multi-day spans and recurrence on a time grid, with
 * event display, date selection and configurable layout. For a headless grid that
 * buckets your own domain content (meals, shifts, bookings) per day, use `Planner`.
 *
 * @tag display
 * @related Planner
 * @related DatePicker
 * @related DateRangePicker
 *
 * @example
 * ```svelte
 * <Calendar
 *   events={wasteEvents}
 *   categories={wasteCategories}
 *   bind:value={selectedDate}
 *   showEventList
 *   showLegend
 *   locale="de-DE"
 * />
 * ```
 *
 * @example
 * ```svelte
 * <Calendar view="week" bind:value={selectedDate} />
 * ```
 *
 * @example
 * ```svelte
 * <Calendar selectionMode="range" bind:value={dateRange}>
 *   {#snippet children()}
 *     <CalendarHeader showViewSwitcher />
 *     <CalendarGrid />
 *   {/snippet}
 * </Calendar>
 * ```
 */
export interface CalendarProps
  extends Omit<CalendarVariants, 'dayState' | 'hasEvents'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  // === Data ===
  /** Array of events to display on the calendar. @default [] */
  events?: CalendarEvent[];
  /** Event categories for color coding and legend. @default [] */
  categories?: CalendarEventCategory[];

  // === View ===
  /** Active view mode. Supports bind:view. @default 'month' */
  view?: CalendarViewMode;
  /** Which views appear in the view switcher. @default ['month', 'week', 'day', 'year', 'agenda'] */
  views?: CalendarViewMode[];

  // === Selection ===
  /** Selection behavior. @default 'single' */
  selectionMode?: 'single' | 'range' | 'multiple';
  /** Currently selected date(s). Supports bind:value. */
  value?: CalendarSelection;
  /**
   * Initial reference day the grid is anchored on, without selecting it. Use
   * this to open a **week** or **day** view on a specific week — `defaultMonth`/
   * `defaultYear` resolve to the 1st, whose week can fall mostly in the previous
   * month. Ignored when `value` is set (the selection anchors instead); takes
   * priority over `defaultMonth`/`defaultYear`. Read at mount only.
   */
  defaultDate?: Date;
  /**
   * Initial displayed month (0–11). Used only when `value` and `defaultDate`
   * are unset; when `value` is provided, the calendar opens on the value's
   * month. Best for month/year views — for week/day views prefer `defaultDate`.
   * Defaults to current month.
   */
  defaultMonth?: number;
  /**
   * Initial displayed year. Used only when `value` is unset; when
   * `value` is provided, the calendar opens on the value's year.
   * Defaults to current year.
   */
  defaultYear?: number;

  // === Locale & Formatting ===
  /** BCP 47 locale tag for date formatting. @default 'de-DE' */
  locale?: string;
  /** First day of the week. 0 = Sunday, 1 = Monday. @default 1 */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Show ISO week numbers in the left margin. @default false */
  showWeekNumbers?: boolean;

  // === Grid options ===
  /** Show days from previous/next months to fill the grid. @default true */
  showOutsideDays?: boolean;
  /** Always show 6 weeks in the grid. @default false */
  fixedWeeks?: boolean;

  // === Navigation constraints ===
  /** Earliest selectable/navigable date. */
  minDate?: Date;
  /** Latest selectable/navigable date. */
  maxDate?: Date;
  /** Specific dates that are disabled (not selectable). */
  disabledDates?: Date[];
  /** Function to test whether a date is disabled. */
  isDateDisabled?: (date: Date) => boolean;

  // === Variants ===
  /** Visual style. @default 'default' */
  variant?: 'default' | 'bordered' | 'ghost';
  /** Component size. @default 'md' */
  size?: 'sm' | 'md' | 'lg';

  // === Callbacks ===
  /** Fires when the selected date(s) change. */
  onValueChange?: (value: CalendarSelection) => void;
  /** Fires when the displayed month/year changes via navigation. */
  onMonthChange?: (month: number, year: number) => void;
  /** Fires when the view mode changes. */
  onViewChange?: (view: CalendarViewMode) => void;
  /** Fires when a date cell is clicked (regardless of selection change). */
  onDateClick?: (date: Date) => void;
  /** Fires when an event is clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** Fires when the displayed week changes (week view). */
  onWeekChange?: (weekStart: Date) => void;
  /** Fires when the displayed day changes (day view). */
  onDayChange?: (date: Date) => void;
  /** Fires on double-click on a day cell for event creation. The consumer shows their own form. */
  onDateCreate?: (date: Date, view: CalendarViewMode) => void;
  /** Fires on click on an empty time slot for event creation. Returns default 1h duration. */
  onTimeSlotCreate?: (start: Date, end: Date) => void;

  // === Custom rendering ===
  /** Custom snippet for rendering a day cell. */
  dayCell?: Snippet<[DayCellContext]>;
  /**
   * Custom snippet for rendering an event item in the list-based views (agenda
   * and the month event list). Time-grid views (week/day) render events through
   * their hour grid and ignore this snippet.
   */
  eventItem?: Snippet<[EventItemContext]>;
  /** Custom snippet for the header area. */
  header?: Snippet<[HeaderContext]>;
  /** Whether to show the built-in legend. Defaults to true when categories are provided. */
  showLegend?: boolean;
  /** Whether to show the detail list when a date is selected. Auto-enabled when events are provided. */
  showEventList?: boolean;

  // === Agenda ===
  /** Number of days shown in agenda view. @default 30 */
  agendaDays?: number;

  // === Time grid ===
  /** Show time grid in week/day views. Auto-detected from events with allDay: false. */
  showTimeGrid?: boolean;
  /** First visible hour in time grid. @default 7 */
  timeGridStartHour?: number;
  /** Last visible hour in time grid (exclusive). @default 20 */
  timeGridEndHour?: number;
  /** Time slot interval in minutes. @default 60 */
  timeGridInterval?: 30 | 60;

  // === Event popover ===
  /** Show a rich popover on hover/focus for days with events (month view). @default false */
  eventPopover?: boolean;

  // === Mini calendar ===
  /** Show a mini month calendar sidebar (week/day/agenda views). @default false */
  showMiniCalendar?: boolean;
  /** Position of the mini calendar sidebar. @default 'left' */
  miniCalendarPosition?: 'left' | 'right';

  // === Header ===
  /** Show the view switcher in the header. @default true */
  showViewSwitcher?: boolean;

  // === Animation ===
  /** Enable animated transitions for navigation. @default true */
  animated?: boolean;
  /** Enable swipe gestures for touch navigation. @default true */
  swipeable?: boolean;

  // === Drag & drop ===
  /** Enable drag & drop to move events between dates. @default false */
  draggable?: boolean;
  /** Fires when an event is moved via drag & drop. */
  onEventMove?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;

  // === Resize ===
  /** Enable resize handles on timed events in the time grid. @default false */
  resizable?: boolean;
  /** Fires when an event is resized via drag handle. */
  onEventResize?: (event: CalendarEvent, newEnd: Date) => void;

  // === Standard ===
  /** Disable the entire calendar. @default false */
  disabled?: boolean;
  /** Default children snippet for custom layout composition. */
  children?: Snippet;
  /** Extra CSS classes on the root element. */
  class?: string;
  /** Strip all default tv() classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<CalendarSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Calendar: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
  /** Micro-interaction preset. */
  mint?: MintProp;
}

// ─── CalendarHeaderProps ──────────────────────────────────────

export interface CalendarHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Custom content replacing the default header layout. */
  children?: Snippet;
  /** Show today button. @default true */
  showToday?: boolean;
  /** Show view switcher buttons. @default true */
  showViewSwitcher?: boolean;
  class?: string;
  unstyled?: boolean;
  slotClasses?: Partial<Record<'header' | 'title' | 'nav' | 'navButton', string>>;
}

// ─── Re-exports ───────────────────────────────────────────────

export { default as Calendar } from './Calendar.svelte';
export { default as CalendarAgendaView } from './CalendarAgendaView.svelte';
export { default as CalendarDay } from './CalendarDay.svelte';
export { default as CalendarDayView } from './CalendarDayView.svelte';
export { default as CalendarEventItem } from './CalendarEventItem.svelte';
export { default as CalendarEventList } from './CalendarEventList.svelte';
export { default as CalendarEventPopover } from './CalendarEventPopover.svelte';
export { default as CalendarGrid } from './CalendarGrid.svelte';
export { default as CalendarHeader } from './CalendarHeader.svelte';
export { default as CalendarLegend } from './CalendarLegend.svelte';
export { default as CalendarMiniMonth } from './CalendarMiniMonth.svelte';
export { default as CalendarMultiDayBar } from './CalendarMultiDayBar.svelte';
export { default as CalendarTimeEvent } from './CalendarTimeEvent.svelte';
export { default as CalendarTimeGrid } from './CalendarTimeGrid.svelte';
export { default as CalendarWeekdayHeader } from './CalendarWeekdayHeader.svelte';
export { default as CalendarWeekGrid } from './CalendarWeekGrid.svelte';
export { default as CalendarYearGrid } from './CalendarYearGrid.svelte';
export type { CalendarContext } from './calendar.context';
export { createSlotHelper } from './calendar.context';
export type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarSelection,
  CalendarViewMode,
  DateRange,
  DayCellContext,
  EventDayInfo,
  EventItemContext,
  HeaderContext,
  MultiDayBarSegment,
  PositionedEvent,
  RecurrenceRule,
  TimeSlot
} from './calendar.types';
export { type CalendarVariants, calendarVariants } from './calendar.variants';
