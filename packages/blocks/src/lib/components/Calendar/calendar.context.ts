import { createOptionalContext } from '$lib/utils/optional-context';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarViewMode,
  DateRange,
  EventDayInfo
} from './calendar.types';
import type { CalendarSlotName } from './index';

export interface CalendarContext {
  // Navigation
  readonly displayedMonth: number;
  readonly displayedYear: number;
  readonly displayedDate: Date;
  readonly today: Date;

  // View
  readonly view: CalendarViewMode;
  readonly views: CalendarViewMode[];

  // Selection
  readonly selectionMode: 'single' | 'range' | 'multiple';
  readonly selectedDate: Date | null;
  readonly selectedDates: Date[];
  readonly selectedRange: DateRange | null;

  // Events
  readonly events: CalendarEvent[];
  readonly categories: CalendarEventCategory[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsWithDayInfo: (date: Date) => EventDayInfo[];
  getCategoryById: (id: string) => CalendarEventCategory | undefined;

  // Styling
  readonly size: 'sm' | 'md' | 'lg';
  readonly variant: 'default' | 'bordered' | 'ghost';
  readonly locale: string;
  readonly weekStartsOn: number;
  readonly showWeekNumbers: boolean;
  readonly showOutsideDays: boolean;
  readonly fixedWeeks: boolean;
  readonly disabled: boolean;

  // Navigation constraints
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;

  // Computed
  readonly grid: Date[][];
  readonly weekdays: string[];
  readonly headerTitle: string;
  readonly weekDates: Date[];
  readonly yearMonths: { month: number; year: number }[];

  // Focused date (for keyboard nav)
  readonly focusedDate: Date;

  // Hovered date (for range preview)
  readonly hoveredDate: Date | null;

  // Actions – view-specific navigation
  navigate: (delta: number) => void;
  navigateMonth: (delta: number) => void;
  navigateWeek: (delta: number) => void;
  navigateDay: (delta: number) => void;
  navigateYear: (delta: number) => void;
  goToToday: () => void;
  selectDate: (date: Date) => void;
  setFocusedDate: (date: Date) => void;
  setHoveredDate: (date: Date | null) => void;
  setView: (view: CalendarViewMode) => void;
  /** Navigate to a specific month (used by year grid drill-down). */
  goToMonth: (month: number, year: number) => void;

  // Date queries
  isDateDisabled: (date: Date) => boolean;
  isDateSelected: (date: Date) => boolean;
  isDateToday: (date: Date) => boolean;
  isDateInRange: (date: Date) => boolean;
  isDateRangeStart: (date: Date) => boolean;
  isDateRangeEnd: (date: Date) => boolean;
  isDateInPreviewRange: (date: Date) => boolean;
  isDateInMonth: (date: Date) => boolean;

  // Animation
  readonly navDirection: 'forward' | 'backward' | null;
  readonly shouldAnimate: boolean;
  readonly swipeable: boolean;

  // Time grid
  readonly showTimeGrid: boolean;
  readonly timeGridStartHour: number;
  readonly timeGridEndHour: number;
  readonly timeGridInterval: 30 | 60;

  // Event popover
  readonly eventPopover: boolean;

  // Event creation
  onDateCreate?: (date: Date, view: CalendarViewMode) => void;
  onTimeSlotCreate?: (start: Date, end: Date) => void;

  // Mini calendar
  readonly showMiniCalendar: boolean;
  readonly miniCalendarPosition: 'left' | 'right';

  // Drag & drop
  readonly draggable: boolean;
  onEventMove?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;

  // Resize
  readonly resizable: boolean;
  onEventResize?: (event: CalendarEvent, newEnd: Date) => void;

  // Styling helpers
  readonly unstyled: boolean;
  readonly slotClasses: Partial<Record<CalendarSlotName, string>>;
  readonly styles: ReturnType<typeof import('./calendar.variants').calendarVariants>;
}

// Use the optional helper so the wrapper below can throw its own
// descriptive error instead of Svelte's generic missing_context.
const [getCalendarContextRaw, setCalendarContext] = createOptionalContext<CalendarContext>();

export { setCalendarContext };

export function getCalendarContext(): CalendarContext {
  const ctx = getCalendarContextRaw();
  if (!ctx) {
    throw new Error('Calendar sub-components must be used inside a <Calendar> parent.');
  }
  return ctx;
}

/**
 * Create a slot-class helper bound to a CalendarContext.
 * Replaces the 15x-duplicated `slot()` pattern in sub-components.
 */
export function createSlotHelper(ctx: CalendarContext) {
  return (key: CalendarSlotName, extra?: string) => {
    const overrides = [ctx.slotClasses?.[key], extra].filter(Boolean).join(' ');
    if (ctx.unstyled) return overrides;
    const styleFn = (ctx.styles as Record<string, (opts?: { class?: string }) => string>)[key];
    return styleFn?.({ class: overrides }) ?? overrides;
  };
}
