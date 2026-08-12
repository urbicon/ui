import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarSelection,
  CalendarViewMode,
  DateRange,
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
  | 'eventTime'
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
  | 'timeGutter'
  | 'timeHeadCell'
  | 'timeCorner'
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
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { MediaQuery } from 'svelte/reactivity';
 *
 *   // A week keeps seven columns behind a horizontal scroll on a phone. Where a
 *   // single day is the better answer, pick the view from the viewport and take
 *   // `week` out of the switcher with it.
 *   //
 *   // The `false` is the SSR answer, not a default worth omitting: without it a
 *   // prerendered page ships the wide branch and swaps to `day` on hydration —
 *   // a visible flip on the phone this is for. Spell out whichever branch the
 *   // server should render.
 *   const narrow = new MediaQuery('(max-width: 48rem)', false);
 * </script>
 *
 * <Calendar
 *   view={narrow.current ? 'day' : 'week'}
 *   views={narrow.current ? ['day', 'agenda'] : ['month', 'week', 'day', 'agenda']}
 * />
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
  /**
   * Active view mode. Supports bind:view.
   *
   * `week` and `day` are hour grids. The week's seven columns keep at least
   * `--blocks-calendar-day-min-width` each (5 rem at `size="sm"`, 6 rem at `md`,
   * 7 rem at `lg`); once they no longer fit, the grid scrolls sideways instead of
   * shrinking the days to a stripe. The hour gutter stays pinned to the left
   * while it does and the day heads — with the all-day band under them — to the
   * top, and arrow-key navigation brings the focused day into view. Set the
   * property on the calendar — `style="--blocks-calendar-day-min-width: 8rem"` —
   * to trade more scrolling for wider days.
   *
   * While the week is scrolling, a horizontal touch drag belongs to the
   * scroller: it moves the days rather than paging to the next week. A week that
   * fits keeps the swipe. The header arrows, `ArrowLeft`/`ArrowRight` and
   * `bind:view` are unaffected either way. On a phone the honest week is often
   * no week at all: bind this prop to a `MediaQuery` and narrow `views` with it
   * (the `MediaQuery` example on the component) rather than handing over seven
   * columns behind a scrollbar.
   * @default 'month'
   * @summary Which view is on screen — month, week, day, year or agenda.
   */
  view?: CalendarViewMode;
  /**
   * Which views the header's switcher offers. It filters the switcher only: a
   * `view` left out of the list still renders, so narrowing the list is how a
   * layout hides a view it cannot serve while still choosing it itself — the
   * viewport-driven pairing under `view`.
   * @default ['month', 'week', 'day', 'year', 'agenda']
   * @summary Which views the header's switcher offers.
   */
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
  /**
   * BCP 47 locale tag for date formatting — month names, weekday names, the
   * header title and the clock time of timed events in the list-based views
   * (hour cycle, separator and padding all follow the locale, so a 12-hour
   * locale renders "9:05 AM"). Defaults to `'auto'`, which follows the active
   * `<I18nProvider>` locale, so an app that already declares its language does
   * not have to repeat it here. SSR-safe: the locale comes from context, so the
   * server and the client resolve the same tag (`Intl` with `undefined` would
   * follow the runtime and disagree across hydration). Falls back to the base
   * locale (`en`) when no provider is mounted. Pass an explicit tag
   * (e.g. `'de-DE'`, `'ja-JP'`) to override.
   *
   * Until 2026-07-31 this defaulted to the literal `'de-DE'`, so an
   * English app rendered German month names unless every date component was
   * passed `locale` by hand.
   * @default 'auto'
   * @summary Which language the month and weekday names are rendered in.
   */
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
  /**
   * Visually mark today across every view — the month cell, the week column
   * header, the year mini-day, the agenda day header and the mini calendar.
   * `aria-current="date"` is **not** affected: it is a semantic pointer, so a
   * screen-reader user keeps the orientation a purely visual preference should
   * not take away. Neither is the time grid's current-time line, which marks the
   * current *time* rather than the day (see `timeGridHourHeight`'s neighbours).
   * Matches `Planner`'s prop of the same name.
   * @default true
   * @summary Whether today gets its visual marker. Never touches aria-current.
   */
  highlightToday?: boolean;

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
  /**
   * Fires after **any** navigation, in every view, with the new reference date
   * and the visible range — load data here. The per-view callbacks
   * (`onMonthChange` / `onWeekChange` / `onDayChange`) still fire and are the
   * better fit when you only care about one view; this one spares you
   * reconstructing the window yourself. The range is view-accurate: month spans
   * the padded cell grid (spill days included), week/day the visible days, year
   * 1 Jan–31 Dec, agenda `agendaDays` from the 1st. Matches `Planner`'s
   * `onNavigate`.
   * @summary Fires on every navigation with the new visible range — the data-loading hook.
   */
  onNavigate?: (date: Date, range: DateRange) => void;
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
   *
   * Replaces the default row entirely, including the clock time an event with
   * `allDay: false` shows there — format it from `event.start`/`event.end`
   * yourself (`formatTimeRange` from `@urbicon-ui/blocks/date` is the same
   * helper the default uses). For a multi-day event the context's `isStart` /
   * `isEnd` say which end of the span this row is: the default prints `start`
   * on the first day, "until <end>" on the last, nothing in between, because
   * `event.start` is the same instant on every row. The chronological order of
   * a day is not part of the snippet's job: the calendar sorts each day before
   * rendering.
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
  /**
   * Height of one hour row in the time grid, in pixels. Left unset it follows
   * `size` (sm 40 · md 48 · lg 64), which is the only reason a nine-hour day
   * costs 432 px of card height whether or not the consumer has it. Set a
   * smaller number for a compact day, a larger one for finer slots. Drives the
   * label column, the slot rows, the grid's `min-height` and the auto-scroll
   * to the current time, so it is a number rather than a CSS variable — the
   * scroll math has to read it.
   * @summary Pixel height of one hour row in the time grid. Follows `size` when unset.
   */
  timeGridHourHeight?: number;

  // === Event popover ===
  /** Show a rich popover on hover/focus for days with events (month view). @default false */
  eventPopover?: boolean;

  // === Mini calendar ===
  /** Show a mini month calendar sidebar (week/day/agenda views). @default false */
  showMiniCalendar?: boolean;
  /** Position of the mini calendar sidebar. @default 'left' */
  miniCalendarPosition?: 'left' | 'right';

  // === Header ===
  /**
   * Show the view switcher in the header. Below `sm` its labels condense to
   * their short form; the full label stays the accessible name. @default true
   */
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
