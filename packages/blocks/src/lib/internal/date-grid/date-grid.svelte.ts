/**
 * Headless controller for date-grid views (month / week / range / day).
 *
 * Owns the *invisible mechanics* shared by Calendar and Planner: grid geometry,
 * navigation, roving focus, hover and selection. It holds no event/item concept
 * and renders nothing — view components read it through `dateGridContext` and
 * `DateGridScaffold`.
 *
 * `referenceDate`, `view`, `selection` and the bounds are **controlled inputs**
 * supplied as reactive getters (role model: `utils/overlay-stack.svelte.ts` —
 * a `$state` class fed by getter options). Navigation and selection never mutate
 * those inputs directly; they call `onNavigate` / `onSelect` so the wrapper owns
 * the source of truth (`bind:value`). Only `focusedDate`, `hoveredDate` and
 * `navDirection` are controller-owned `$state`.
 */

import {
  addDays,
  clampMonth,
  daysBetween,
  endOfWeek,
  formatDateRange,
  formatDayTitle,
  formatMonthYear,
  formatWeekTitle,
  getMonthGrid,
  getWeekDates,
  getWeekdayNames,
  getWeekNumber,
  isInMonth,
  isInRange,
  isSameDay,
  isWeekend,
  startOfWeek,
  stripTime,
  toIso
} from '$lib/date';
import type {
  DateGridRange,
  DateGridSelection,
  DateGridSelectionMode,
  DateGridView,
  DayCellInfo,
  NavDirection
} from './date-grid.types';

/**
 * Reactive inputs for a {@link DateGridController}. Value fields are getters so
 * the controller tracks them through `$derived`; callbacks are plain optional
 * methods invoked at action time.
 */
export interface DateGridOptions {
  /** The date the grid is anchored on (controlled). */
  get referenceDate(): Date;
  /** Active view mode. */
  get view(): DateGridView;
  /** Day the week starts on (0=Sun … 6=Sat). */
  get weekStartsOn(): number;
  /** BCP 47 locale tag for titles and weekday names. */
  get locale(): string;
  /** Selection cardinality. */
  get selectionMode(): DateGridSelectionMode;
  /** Current selection value (controlled), shaped by `selectionMode`. */
  get selection(): DateGridSelection | undefined;
  /** Start of the explicit range for `view="range"`. */
  get rangeStart(): Date | undefined;
  /** End of the explicit range for `view="range"`. */
  get rangeEnd(): Date | undefined;
  /** Earliest navigable/selectable date. */
  get minDate(): Date | undefined;
  /** Latest navigable/selectable date. */
  get maxDate(): Date | undefined;
  /** Whether the whole grid is disabled. */
  get disabled(): boolean;
  /** Extra per-date disable predicate (on top of min/max). */
  isDateDisabled?: (date: Date) => boolean;
  /** Called when navigation wants a new reference date; the wrapper materialises it. */
  onNavigate?: (date: Date, range: DateGridRange) => void;
  /** Called with the next selection value and the date that triggered it; the
   * wrapper materialises the selection. The trigger date lets consumers run
   * per-click side effects (Calendar's `onDateClick` / spill-day navigation,
   * Planner's `onDateSelect`) that the computed selection alone can't express. */
  onSelect?: (selection: DateGridSelection, date: Date) => void;
}

export class DateGridController {
  #opts: DateGridOptions;

  /** The roving keyboard focus target (local midnight). Controller-owned. */
  focusedDate = $state<Date>(new Date());
  /** The hovered date, for range-selection preview. Controller-owned. */
  hoveredDate = $state<Date | null>(null);
  /** Direction of the last navigation, for enter/exit transitions. */
  navDirection = $state<NavDirection>(null);
  /** Today (local midnight). Refreshed via {@link refreshToday}. */
  today = $state<Date>(stripTime(new Date()));

  constructor(opts: DateGridOptions) {
    this.#opts = opts;
    this.focusedDate = stripTime(opts.referenceDate);
  }

  // ─── Reflected inputs ────────────────────────────────────────────────────

  get view(): DateGridView {
    return this.#opts.view;
  }
  get referenceDate(): Date {
    return this.#opts.referenceDate;
  }
  get weekStartsOn(): number {
    return this.#opts.weekStartsOn;
  }
  get locale(): string {
    return this.#opts.locale;
  }
  get disabled(): boolean {
    return this.#opts.disabled;
  }
  get selectionMode(): DateGridSelectionMode {
    return this.#opts.selectionMode;
  }

  // ─── Derived geometry ────────────────────────────────────────────────────
  //
  // Exposed as getters (not `$derived` fields): a field initializer would read
  // `this.#opts` before the constructor assigns it. Getters read the reactive
  // option getters lazily, so they are tracked correctly when consumed inside a
  // component's `$derived`/effect — the same shape the legacy CalendarContext
  // used. Geometry math (getMonthGrid etc.) is cheap; wrappers can memoise hot
  // reads in their own `$derived` if a profile ever calls for it.

  /** Cell rows for the current view. The single source of truth for geometry:
   * month → 4–6 week rows; week/day → one row; range → chunked week rows. */
  get cells(): Date[][] {
    return this.#cellsFor(this.#opts.referenceDate);
  }

  /** The 7 dates of the week containing `referenceDate`. */
  get weekDates(): Date[] {
    return getWeekDates(this.#opts.referenceDate, this.#opts.weekStartsOn);
  }

  /** Localized short weekday names, ordered from `weekStartsOn`. */
  get weekdayNames(): string[] {
    return getWeekdayNames(this.#opts.locale, this.#opts.weekStartsOn, 'short');
  }

  /** Localized narrow weekday names, ordered from `weekStartsOn`. */
  get weekdayNamesNarrow(): string[] {
    return getWeekdayNames(this.#opts.locale, this.#opts.weekStartsOn, 'narrow');
  }

  /** First visible date (top-left cell) — the visible-range start. */
  get rangeStart(): Date {
    return this.cells[0][0];
  }

  /** Last visible date (bottom-right cell) — the visible-range end. */
  get rangeEnd(): Date {
    const lastRow = this.cells[this.cells.length - 1];
    return lastRow[lastRow.length - 1];
  }

  /** Localized header title for the current view. */
  get title(): string {
    const ref = this.#opts.referenceDate;
    const locale = this.#opts.locale;
    const view = this.#opts.view;
    if (view === 'month') return formatMonthYear(ref.getFullYear(), ref.getMonth(), locale);
    if (view === 'week') return formatWeekTitle(ref, this.#opts.weekStartsOn, locale);
    if (view === 'day') return formatDayTitle(ref, locale);
    return formatDateRange(this.rangeStart, this.rangeEnd, locale); // range
  }

  get #navBounds(): { canGoBack: boolean; canGoForward: boolean } {
    const { view, referenceDate, minDate, maxDate } = this.#opts;
    if (view === 'month') {
      // Month-granular bounds, matching the legacy Calendar behaviour.
      const { canGoBack, canGoForward } = clampMonth(
        referenceDate.getMonth(),
        referenceDate.getFullYear(),
        minDate,
        maxDate
      );
      return { canGoBack, canGoForward };
    }
    // week/day/range: day-granular bounds against the visible edges.
    const canGoBack = !minDate || stripTime(this.rangeStart) > stripTime(minDate);
    const canGoForward = !maxDate || stripTime(this.rangeEnd) < stripTime(maxDate);
    return { canGoBack, canGoForward };
  }

  get canGoBack(): boolean {
    return this.#navBounds.canGoBack;
  }
  get canGoForward(): boolean {
    return this.#navBounds.canGoForward;
  }

  // ─── Per-day queries ─────────────────────────────────────────────────────

  weekNumberFor(date: Date): number {
    return getWeekNumber(date);
  }

  isToday(date: Date): boolean {
    return isSameDay(date, this.today);
  }

  isWeekend(date: Date): boolean {
    return isWeekend(date);
  }

  /** Outside the focused month (month view) or the requested range (range view). */
  isOutside(date: Date): boolean {
    const { view, referenceDate } = this.#opts;
    if (view === 'month') {
      return !isInMonth(date, referenceDate.getMonth(), referenceDate.getFullYear());
    }
    if (view === 'range') {
      const rs = this.#opts.rangeStart;
      const re = this.#opts.rangeEnd;
      if (rs && re) return !isInRange(date, rs, re);
    }
    return false;
  }

  isDisabled(date: Date): boolean {
    const { disabled, minDate, maxDate, isDateDisabled } = this.#opts;
    if (disabled) return true;
    if (isDateDisabled?.(date)) return true;
    if (minDate && stripTime(date) < stripTime(minDate)) return true;
    if (maxDate && stripTime(date) > stripTime(maxDate)) return true;
    return false;
  }

  isFocused(date: Date): boolean {
    return isSameDay(date, this.focusedDate);
  }

  /** Assemble the shared per-day context for a cell. */
  dayCellInfo(date: Date): DayCellInfo {
    return {
      date,
      isoDate: toIso(date),
      isToday: this.isToday(date),
      isWeekend: this.isWeekend(date),
      isOutside: this.isOutside(date),
      isFocused: this.isFocused(date),
      isDisabled: this.isDisabled(date),
      weekNumber: this.weekNumberFor(date)
    };
  }

  // ─── Selection queries ───────────────────────────────────────────────────

  isSelected(date: Date): boolean {
    const sel = this.#opts.selection;
    if (!sel) return false;
    if (sel instanceof Date) return isSameDay(sel, date);
    if (Array.isArray(sel)) return sel.some((d) => isSameDay(d, date));
    return isSameDay(sel.start, date) || isSameDay(sel.end, date);
  }

  isRangeStart(date: Date): boolean {
    const range = this.#asRange();
    return range ? isSameDay(range.start, date) : false;
  }

  isRangeEnd(date: Date): boolean {
    const range = this.#asRange();
    if (!range) return false;
    return !isSameDay(range.start, range.end) && isSameDay(range.end, date);
  }

  isInSelectedRange(date: Date): boolean {
    const range = this.#asRange();
    if (!range) return false;
    return (
      isInRange(date, range.start, range.end) &&
      !isSameDay(date, range.start) &&
      !isSameDay(date, range.end)
    );
  }

  isInPreviewRange(date: Date): boolean {
    const range = this.#asRange();
    if (!range || !this.hoveredDate) return false;
    // Preview only while a range start is set but not yet completed.
    if (!isSameDay(range.start, range.end)) return false;
    return isInRange(date, range.start, this.hoveredDate) && !isSameDay(date, range.start);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Step the view by `delta` units (months / weeks / days; range shifts by its
   * own span in weeks). Emits the next reference date and visible range. */
  navigate(delta: number): void {
    if (delta === 0) return;
    const { view, referenceDate, minDate, maxDate } = this.#opts;
    this.navDirection = delta > 0 ? 'forward' : 'backward';

    if (view === 'range') {
      // The range geometry follows the explicit rangeStart/rangeEnd inputs, not
      // referenceDate, so navigation shifts that window by its own span and emits
      // the shifted range — the wrapper rebinds rangeStart/rangeEnd from it.
      const { start, end } = this.#orderedRange(referenceDate);
      const spanDays = daysBetween(start, end) + 1;
      const shiftedStart = addDays(start, delta * spanDays);
      const shiftedEnd = addDays(end, delta * spanDays);
      this.#opts.onNavigate?.(shiftedStart, { start: shiftedStart, end: shiftedEnd });
      return;
    }

    let next: Date;
    switch (view) {
      case 'month': {
        const total = referenceDate.getFullYear() * 12 + referenceDate.getMonth() + delta;
        const targetYear = Math.floor(total / 12);
        const targetMonth = ((total % 12) + 12) % 12;
        const clamped = clampMonth(targetMonth, targetYear, minDate, maxDate);
        next = new Date(clamped.year, clamped.month, 1);
        break;
      }
      case 'week':
        next = addDays(referenceDate, delta * 7);
        break;
      case 'day':
        next = addDays(referenceDate, delta);
        break;
    }
    this.#emitNavigate(next);
  }

  /** Jump to today and focus it. */
  goToToday(): void {
    const now = stripTime(new Date());
    this.focusedDate = now;
    this.#emitNavigate(now);
  }

  /** Jump the reference date to a specific date. */
  goTo(date: Date): void {
    this.#emitNavigate(stripTime(date));
  }

  /** Set the roving focus, navigating the view if the date left the visible window. */
  setFocusedDate(date: Date): void {
    const d = stripTime(date);
    const reference = stripTime(this.#opts.referenceDate);
    this.focusedDate = d;
    if (this.#needsNavigationToFocus(d)) {
      this.navDirection = d.getTime() >= reference.getTime() ? 'forward' : 'backward';
      this.#emitNavigate(d);
    }
  }

  /** Move the roving focus by `deltaDays` (keyboard arrows / page keys). */
  moveFocus(deltaDays: number): void {
    this.setFocusedDate(addDays(this.focusedDate, deltaDays));
  }

  setHoveredDate(date: Date | null): void {
    this.hoveredDate = date;
  }

  /** Recompute `today` (call from a midnight timer in the wrapper). */
  refreshToday(): void {
    this.today = stripTime(new Date());
  }

  /** Compute and emit the next selection value for `date` per `selectionMode`. */
  selectDate(date: Date): void {
    if (this.isDisabled(date)) return;
    const { selectionMode, selection } = this.#opts;

    let next: DateGridSelection;
    switch (selectionMode) {
      case 'single':
        next = date;
        break;
      case 'multiple': {
        const current = Array.isArray(selection) ? selection : [];
        const existingIdx = current.findIndex((d) => isSameDay(d, date));
        next = existingIdx >= 0 ? current.filter((_, i) => i !== existingIdx) : [...current, date];
        break;
      }
      case 'range': {
        const current = this.#asRange();
        const hasCompleteRange = current && !isSameDay(current.start, current.end);
        if (!current || hasCompleteRange) {
          next = { start: date, end: date };
        } else {
          next =
            date < current.start
              ? { start: date, end: current.start }
              : { start: current.start, end: date };
        }
        break;
      }
    }
    this.#opts.onSelect?.(next, date);
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  /** The explicit range bounds ordered low→high (tolerating an inverted input),
   * each defaulting to `reference` when the consumer omits them. Keeps range
   * geometry non-empty so the rangeStart/rangeEnd/title getters never throw. */
  #orderedRange(reference: Date): { start: Date; end: Date } {
    const rs = stripTime(this.#opts.rangeStart ?? reference);
    const re = stripTime(this.#opts.rangeEnd ?? reference);
    return rs.getTime() <= re.getTime() ? { start: rs, end: re } : { start: re, end: rs };
  }

  /** Pure cell geometry for an arbitrary reference date (no side effects). */
  #cellsFor(reference: Date): Date[][] {
    const wso = this.#opts.weekStartsOn;
    switch (this.#opts.view) {
      case 'month':
        return getMonthGrid(reference.getFullYear(), reference.getMonth(), wso);
      case 'week':
        return [getWeekDates(reference, wso)];
      case 'day':
        return [[stripTime(reference)]];
      case 'range': {
        const { start, end } = this.#orderedRange(reference);
        return chunkIntoWeeks(startOfWeek(start, wso), endOfWeek(end, wso));
      }
    }
  }

  /** Visible range for an arbitrary reference date, derived from its cells. */
  #rangeFor(reference: Date): DateGridRange {
    const cells = this.#cellsFor(reference);
    const lastRow = cells[cells.length - 1];
    return { start: cells[0][0], end: lastRow[lastRow.length - 1] };
  }

  #emitNavigate(next: Date): void {
    this.#opts.onNavigate?.(next, this.#rangeFor(next));
  }

  /** Whether focusing `date` requires navigating the view to reveal it. */
  #needsNavigationToFocus(date: Date): boolean {
    const { view, referenceDate } = this.#opts;
    switch (view) {
      case 'month':
        return !isInMonth(date, referenceDate.getMonth(), referenceDate.getFullYear());
      case 'week':
        return !this.weekDates.some((d) => isSameDay(d, date));
      case 'day':
        return !isSameDay(date, referenceDate);
      case 'range':
        return !this.cells.some((week) => week.some((d) => isSameDay(d, date)));
    }
  }

  /** The selection as a range, or null when it is not a (range-mode) range value. */
  #asRange(): DateGridRange | null {
    const sel = this.#opts.selection;
    if (this.#opts.selectionMode !== 'range') return null;
    if (!sel || sel instanceof Date || Array.isArray(sel)) return null;
    return sel;
  }
}

/** Chunk an inclusive [start, end] span of full weeks into rows of 7 days. */
function chunkIntoWeeks(start: Date, end: Date): Date[][] {
  const rows: Date[][] = [];
  let cursor = stripTime(start);
  const last = stripTime(end).getTime();
  while (cursor.getTime() <= last) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(cursor);
      cursor = addDays(cursor, 1);
    }
    rows.push(row);
  }
  return rows;
}
