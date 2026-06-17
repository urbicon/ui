<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { calendarVariants } from './calendar.variants';
  import { setCalendarContext, type CalendarContext } from './calendar.context';
  import {
    getMonthGrid,
    getWeekdayNames,
    getWeekDates,
    getYearMonths,
    formatMonthYear,
    formatWeekTitle,
    formatDayTitle,
    isSameDay,
    isInRange,
    isInMonth,
    clampMonth,
    toIso,
    stripTime
  } from '$lib/date';
  import { getEventDayInfo, expandRecurrence } from './calendar.engine';
  import type { CalendarProps } from './index';
  import type {
    CalendarEvent,
    CalendarEventCategory,
    CalendarViewMode,
    DateRange,
    EventDayInfo
  } from './calendar.types';
  import CalendarHeader from './CalendarHeader.svelte';
  import CalendarGrid from './CalendarGrid.svelte';
  import CalendarYearGrid from './CalendarYearGrid.svelte';
  import CalendarWeekGrid from './CalendarWeekGrid.svelte';
  import CalendarDayView from './CalendarDayView.svelte';
  import CalendarAgendaView from './CalendarAgendaView.svelte';
  import CalendarLegend from './CalendarLegend.svelte';
  import CalendarEventList from './CalendarEventList.svelte';
  import CalendarMiniMonth from './CalendarMiniMonth.svelte';

  let {
    // Data
    events = [],
    categories = [],
    // View
    view = $bindable('month'),
    views = ['month', 'week', 'day', 'year', 'agenda'] as CalendarViewMode[],
    // Selection
    selectionMode = 'single',
    value = $bindable(undefined),
    defaultMonth,
    defaultYear,
    // Locale
    locale = 'de-DE',
    weekStartsOn = 1,
    showWeekNumbers = false,
    // Grid
    showOutsideDays = true,
    fixedWeeks = false,
    // Navigation constraints
    minDate,
    maxDate,
    disabledDates = [],
    isDateDisabled: isDateDisabledProp,
    // Variants
    variant = 'default',
    size = 'md',
    // Callbacks
    onValueChange,
    onMonthChange,
    onViewChange,
    onDateClick,
    onEventClick,
    onWeekChange,
    onDayChange,
    onDateCreate,
    onTimeSlotCreate,
    // Custom rendering
    dayCell,
    eventItem,
    header,
    showLegend,
    showEventList,
    // Agenda
    agendaDays = 30,
    // Time grid
    showTimeGrid: showTimeGridProp,
    timeGridStartHour = 7,
    timeGridEndHour = 20,
    timeGridInterval = 60,
    // Event popover
    eventPopover = false,
    // Mini calendar
    showMiniCalendar = false,
    miniCalendarPosition = 'left',
    // Drag & drop
    draggable = false,
    onEventMove,
    // Resize
    resizable = false,
    onEventResize,
    // Header
    showViewSwitcher = true,
    // Animation
    animated = true,
    swipeable: swipeableProp = true,
    // Standard
    disabled = false,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: CalendarProps = $props();

  // --- BlocksConfig integration ---
  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Calendar?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Calendar', preset),
      slotClassesProp
    )
  );

  // --- Variant styles ---
  const styles = $derived(calendarVariants({ variant, size }));

  // --- Animation state ---
  let navDirection = $state<'forward' | 'backward' | null>(null);
  let prefersReducedMotion = $state(false);
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });
  const shouldAnimate = $derived(animated && !prefersReducedMotion);

  // --- Time grid ---
  // Week and day views always show time grid; month/year/agenda respect the prop
  const showTimeGrid = $derived.by(() => {
    if (view === 'week' || view === 'day') return true;
    return showTimeGridProp ?? events.some((e) => e.allDay === false);
  });

  // --- Internal state ---
  let today = $state(stripTime(new Date()));

  // The month/year the grid opens on. Priority:
  //   1. the first selected date — a populated picker opens on its
  //      selection, never on a stale `defaultMonth`
  //   2. `defaultMonth` / `defaultYear` props — fallback when no value
  //   3. today
  // Read at mount time only; the user can navigate freely afterwards
  // without us snapping back. Remount (e.g. via the popover's
  // open/close cycle in DatePicker) to land on the current selection.
  function firstDateOf(v: CalendarProps['value']): Date | undefined {
    if (v instanceof Date) return v;
    if (Array.isArray(v) && v.length > 0) return v[0];
    if (v && typeof v === 'object' && 'start' in v) return v.start;
    return undefined;
  }
  const initialAnchor = firstDateOf(value);
  let displayedMonth = $state(initialAnchor?.getMonth() ?? defaultMonth ?? today.getMonth());
  let displayedYear = $state(initialAnchor?.getFullYear() ?? defaultYear ?? today.getFullYear());
  let displayedDate = $state(new Date(initialAnchor ?? today));
  let focusedDate = $state(new Date(initialAnchor ?? today));
  let hoveredDate = $state<Date | null>(null);

  // Midnight update for `today` — re-arms after each update via reactive dependency on `today`
  $effect(() => {
    // Reading `today` creates a reactive dependency so the effect re-runs after each midnight update
    const _current = today;

    const now = new Date();
    const midnight = new Date(now); // eslint-disable-line svelte/prefer-svelte-reactivity
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      today = stripTime(new Date());
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  });

  // Uncontrolled fallback
  let internalValue = $state<CalendarProps['value']>(undefined);
  const effectiveValue = $derived(value !== undefined ? value : internalValue);

  // --- Derived: showEventList auto-logic ---
  const effectiveShowEventList = $derived(showEventList ?? events.length > 0);

  // --- Derived: grid data per view ---
  const grid = $derived(getMonthGrid(displayedYear, displayedMonth, weekStartsOn));
  const weekdays = $derived(getWeekdayNames(locale, weekStartsOn, 'short'));
  const weekDates = $derived(getWeekDates(displayedDate, weekStartsOn));
  const yearMonths = $derived(getYearMonths(displayedYear));

  // --- Derived: view-aware header title ---
  const headerTitle = $derived.by(() => {
    switch (view) {
      case 'month':
        return formatMonthYear(displayedYear, displayedMonth, locale);
      case 'year':
        return String(displayedYear);
      case 'week':
        return formatWeekTitle(displayedDate, weekStartsOn, locale);
      case 'day':
        return formatDayTitle(displayedDate, locale);
      case 'agenda':
        return formatMonthYear(displayedYear, displayedMonth, locale);
    }
  });

  // --- Derived: navigation constraints ---
  const navState = $derived(clampMonth(displayedMonth, displayedYear, minDate, maxDate));

  // --- Derived: visible range for recurrence expansion ---
  const visibleRange = $derived.by(() => {
    switch (view) {
      case 'month': {
        // grid covers padding days from prev/next month
        const first = grid[0]?.[0] ?? new Date(displayedYear, displayedMonth, 1);
        const lastWeek = grid[grid.length - 1] ?? [];
        const last =
          lastWeek[lastWeek.length - 1] ?? new Date(displayedYear, displayedMonth + 1, 0);
        return { start: first, end: last };
      }
      case 'year': {
        return {
          start: new Date(displayedYear, 0, 1),
          end: new Date(displayedYear, 11, 31)
        };
      }
      case 'week': {
        return { start: weekDates[0], end: weekDates[6] };
      }
      case 'day': {
        return { start: displayedDate, end: displayedDate };
      }
      case 'agenda': {
        const start = new Date(displayedYear, displayedMonth, 1);
        const end = new Date(start); // eslint-disable-line svelte/prefer-svelte-reactivity
        end.setDate(end.getDate() + agendaDays);
        return { start, end };
      }
    }
  });

  // --- Derived: expand recurring events for the visible range ---
  const expandedEvents = $derived.by(() => {
    const hasRecurring = events.some((e) => e.recurrence);
    if (!hasRecurring) return events;
    return events.flatMap((e) =>
      e.recurrence ? expandRecurrence(e, visibleRange.start, visibleRange.end) : [e]
    );
  });

  // --- Derived: event index (O(1) lookup by date, supports multi-day events) ---
  const eventsByDate = $derived.by(() => {
    const map = new SvelteMap<string, CalendarEvent[]>();
    for (const event of expandedEvents) {
      const startDay = stripTime(event.start);
      const endDay = event.end ? stripTime(event.end) : startDay;
      let current = new Date(startDay); // eslint-disable-line svelte/prefer-svelte-reactivity
      while (current <= endDay) {
        const key = toIso(current);
        const arr = map.get(key);
        if (arr) {
          arr.push(event);
        } else {
          map.set(key, [event]);
        }
        current = new Date(current);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  });

  // --- Derived: category lookup ---
  const categoryMap = $derived.by(() => {
    const map = new SvelteMap<string, CalendarEventCategory>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  });

  // --- Derived: disabled dates set for O(1) lookup ---
  const disabledDatesSet = $derived(new Set(disabledDates.map((d) => toIso(d))));

  // --- Derived: legend visibility ---
  const effectiveShowLegend = $derived(showLegend ?? categories.length > 0);

  // --- Derived: selected date for event list ---
  const selectedDateForList = $derived.by(() => {
    if (!effectiveValue) return null;
    if (effectiveValue instanceof Date) return effectiveValue;
    if (Array.isArray(effectiveValue)) return effectiveValue[effectiveValue.length - 1] ?? null;
    return effectiveValue.start;
  });

  // --- Helpers ---
  function getEventsForDate(date: Date): CalendarEvent[] {
    return eventsByDate.get(toIso(date)) ?? [];
  }

  function getEventsWithDayInfo(date: Date): EventDayInfo[] {
    const evts = getEventsForDate(date);
    return evts.map((event) => {
      const info = getEventDayInfo(event, date);
      return { event, ...info };
    });
  }

  function getCategoryById(id: string): CalendarEventCategory | undefined {
    return categoryMap.get(id);
  }

  function checkIsDateDisabled(date: Date): boolean {
    if (disabled) return true;
    if (isDateDisabledProp?.(date)) return true;
    if (disabledDatesSet.has(toIso(date))) return true;
    if (minDate && stripTime(date) < stripTime(minDate)) return true;
    if (maxDate && stripTime(date) > stripTime(maxDate)) return true;
    return false;
  }

  function checkIsDateSelected(date: Date): boolean {
    if (!effectiveValue) return false;
    if (effectiveValue instanceof Date) return isSameDay(effectiveValue, date);
    if (Array.isArray(effectiveValue)) return effectiveValue.some((d) => isSameDay(d, date));
    return isSameDay(effectiveValue.start, date) || isSameDay(effectiveValue.end, date);
  }

  function checkIsDateInRange(date: Date): boolean {
    if (!effectiveValue || selectionMode !== 'range') return false;
    if (effectiveValue instanceof Date || Array.isArray(effectiveValue)) return false;
    const range = effectiveValue as DateRange;
    return (
      isInRange(date, range.start, range.end) &&
      !isSameDay(date, range.start) &&
      !isSameDay(date, range.end)
    );
  }

  function checkIsDateInPreviewRange(date: Date): boolean {
    if (selectionMode !== 'range' || !hoveredDate) return false;
    if (!effectiveValue || effectiveValue instanceof Date || Array.isArray(effectiveValue))
      return false;
    const range = effectiveValue as DateRange;
    // Only show preview when range start is set but not completed (start === end)
    if (!isSameDay(range.start, range.end)) return false;
    return isInRange(date, range.start, hoveredDate) && !isSameDay(date, range.start);
  }

  function checkIsDateRangeStart(date: Date): boolean {
    if (!effectiveValue || selectionMode !== 'range') return false;
    if (effectiveValue instanceof Date || Array.isArray(effectiveValue)) return false;
    return isSameDay((effectiveValue as DateRange).start, date);
  }

  function checkIsDateRangeEnd(date: Date): boolean {
    if (!effectiveValue || selectionMode !== 'range') return false;
    if (effectiveValue instanceof Date || Array.isArray(effectiveValue)) return false;
    const range = effectiveValue as DateRange;
    return !isSameDay(range.start, range.end) && isSameDay(range.end, date);
  }

  // --- Navigation ---
  function navigateMonth(delta: number) {
    const total = displayedYear * 12 + displayedMonth + delta;
    let newYear = Math.floor(total / 12);
    let newMonth = ((total % 12) + 12) % 12;
    const clamped = clampMonth(newMonth, newYear, minDate, maxDate);
    displayedMonth = clamped.month;
    displayedYear = clamped.year;
    displayedDate = new Date(displayedYear, displayedMonth, 1);
    onMonthChange?.(displayedMonth, displayedYear);
  }

  function navigateWeek(delta: number) {
    const d = new Date(displayedDate); // eslint-disable-line svelte/prefer-svelte-reactivity
    d.setDate(d.getDate() + delta * 7);
    displayedDate = d;
    displayedMonth = d.getMonth();
    displayedYear = d.getFullYear();
    onWeekChange?.(d);
  }

  function navigateDay(delta: number) {
    const d = new Date(displayedDate); // eslint-disable-line svelte/prefer-svelte-reactivity
    d.setDate(d.getDate() + delta);
    displayedDate = d;
    displayedMonth = d.getMonth();
    displayedYear = d.getFullYear();
    onDayChange?.(d);
  }

  function navigateYear(delta: number) {
    displayedYear += delta;
    onMonthChange?.(displayedMonth, displayedYear);
  }

  function navigate(delta: number) {
    navDirection = delta > 0 ? 'forward' : 'backward';
    switch (view) {
      case 'month':
      case 'agenda':
        navigateMonth(delta);
        break;
      case 'year':
        navigateYear(delta);
        break;
      case 'week':
        navigateWeek(delta);
        break;
      case 'day':
        navigateDay(delta);
        break;
    }
  }

  function goToToday() {
    const now = new Date();
    displayedMonth = now.getMonth();
    displayedYear = now.getFullYear();
    displayedDate = new Date(now);
    focusedDate = new Date(now);
    onMonthChange?.(displayedMonth, displayedYear);
  }

  function goToMonth(month: number, year: number) {
    displayedMonth = month;
    displayedYear = year;
    displayedDate = new Date(year, month, 1);
  }

  // --- Selection ---
  function selectDate(date: Date) {
    if (checkIsDateDisabled(date)) return;

    // Navigate to clicked month if outside current displayed month
    const clickedMonth = date.getMonth();
    const clickedYear = date.getFullYear();
    if (clickedMonth !== displayedMonth || clickedYear !== displayedYear) {
      displayedMonth = clickedMonth;
      displayedYear = clickedYear;
      onMonthChange?.(displayedMonth, displayedYear);
    }

    onDateClick?.(date);

    let newValue: CalendarProps['value'];

    switch (selectionMode) {
      case 'single':
        newValue = date;
        break;
      case 'multiple': {
        const current = Array.isArray(effectiveValue) ? effectiveValue : [];
        const existingIdx = current.findIndex((d) => isSameDay(d, date));
        if (existingIdx >= 0) {
          newValue = current.filter((_, i) => i !== existingIdx);
        } else {
          newValue = [...current, date];
        }
        break;
      }
      case 'range': {
        const current =
          effectiveValue && !Array.isArray(effectiveValue) && !(effectiveValue instanceof Date)
            ? (effectiveValue as DateRange)
            : null;
        const hasCompleteRange = current && !isSameDay(current.start, current.end);
        if (!current || hasCompleteRange) {
          // New range start
          newValue = { start: date, end: date };
        } else {
          // Complete the range
          newValue =
            date < current.start
              ? { start: date, end: current.start }
              : { start: current.start, end: date };
        }
        break;
      }
    }

    if (newValue !== undefined) {
      if (value !== undefined) {
        value = newValue;
      } else {
        internalValue = newValue;
      }
      onValueChange?.(newValue!);
    }
  }

  function setFocusedDate(date: Date) {
    focusedDate = date;
    if (!isInMonth(date, displayedMonth, displayedYear)) {
      displayedMonth = date.getMonth();
      displayedYear = date.getFullYear();
      onMonthChange?.(displayedMonth, displayedYear);
    }
  }

  function setHoveredDate(date: Date | null) {
    hoveredDate = date;
  }

  function setView(v: CalendarViewMode) {
    view = v;
    // Sync displayedDate from month/year when switching to week/day
    // Clamp day-of-month to prevent overflow (e.g. 31 Feb → 28 Feb)
    if (v === 'week' || v === 'day') {
      const maxDay = new Date(displayedYear, displayedMonth + 1, 0).getDate();
      const day = Math.min(displayedDate.getDate(), maxDay);
      displayedDate = new Date(displayedYear, displayedMonth, day);
    }
    onViewChange?.(v);
  }

  // --- Context ---
  const ctx: CalendarContext = {
    get displayedMonth() {
      return displayedMonth;
    },
    get displayedYear() {
      return displayedYear;
    },
    get displayedDate() {
      return displayedDate;
    },
    get today() {
      return today;
    },
    get view() {
      return view;
    },
    get views() {
      return views;
    },
    get selectionMode() {
      return selectionMode;
    },
    get selectedDate() {
      return selectedDateForList;
    },
    get selectedDates() {
      if (!effectiveValue) return [];
      if (effectiveValue instanceof Date) return [effectiveValue];
      if (Array.isArray(effectiveValue)) return effectiveValue;
      return [effectiveValue.start, effectiveValue.end];
    },
    get selectedRange() {
      if (!effectiveValue || effectiveValue instanceof Date || Array.isArray(effectiveValue))
        return null;
      return effectiveValue as DateRange;
    },
    get events() {
      return expandedEvents;
    },
    get categories() {
      return categories;
    },
    getEventsForDate,
    getEventsWithDayInfo,
    getCategoryById,
    get size() {
      return size;
    },
    get variant() {
      return variant;
    },
    get locale() {
      return locale;
    },
    get weekStartsOn() {
      return weekStartsOn;
    },
    get showWeekNumbers() {
      return showWeekNumbers;
    },
    get showOutsideDays() {
      return showOutsideDays;
    },
    get fixedWeeks() {
      return fixedWeeks;
    },
    get disabled() {
      return disabled;
    },
    get canGoBack() {
      return navState.canGoBack;
    },
    get canGoForward() {
      return navState.canGoForward;
    },
    get grid() {
      return grid;
    },
    get weekdays() {
      return weekdays;
    },
    get headerTitle() {
      return headerTitle;
    },
    get weekDates() {
      return weekDates;
    },
    get yearMonths() {
      return yearMonths;
    },
    get focusedDate() {
      return focusedDate;
    },
    get hoveredDate() {
      return hoveredDate;
    },
    navigate,
    navigateMonth,
    navigateWeek,
    navigateDay,
    navigateYear,
    goToToday,
    goToMonth,
    selectDate,
    setFocusedDate,
    setHoveredDate,
    setView,
    isDateDisabled: checkIsDateDisabled,
    isDateSelected: checkIsDateSelected,
    isDateToday: (date: Date) => isSameDay(date, today),
    isDateInRange: checkIsDateInRange,
    isDateRangeStart: checkIsDateRangeStart,
    isDateRangeEnd: checkIsDateRangeEnd,
    isDateInPreviewRange: checkIsDateInPreviewRange,
    isDateInMonth: (date: Date) => isInMonth(date, displayedMonth, displayedYear),
    get navDirection() {
      return navDirection;
    },
    get shouldAnimate() {
      return shouldAnimate;
    },
    get swipeable() {
      return swipeableProp;
    },
    get showTimeGrid() {
      return showTimeGrid;
    },
    get timeGridStartHour() {
      return timeGridStartHour;
    },
    get timeGridEndHour() {
      return timeGridEndHour;
    },
    get timeGridInterval() {
      return timeGridInterval;
    },
    get eventPopover() {
      return eventPopover;
    },
    get onDateCreate() {
      return onDateCreate;
    },
    get onTimeSlotCreate() {
      return onTimeSlotCreate;
    },
    get showMiniCalendar() {
      return showMiniCalendar;
    },
    get miniCalendarPosition() {
      return miniCalendarPosition;
    },
    get draggable() {
      return draggable;
    },
    get onEventMove() {
      return onEventMove;
    },
    get resizable() {
      return resizable;
    },
    get onEventResize() {
      return onEventResize;
    },
    get unstyled() {
      return unstyled;
    },
    get slotClasses() {
      return slotClasses;
    },
    get styles() {
      return styles;
    }
  };

  setCalendarContext(ctx);
</script>

{#if children}
  <div
    class={unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })}
    {...restProps}
  >
    <div class="sr-only" aria-live="polite" role="status">{headerTitle}</div>
    {@render children()}
  </div>
{:else}
  <div
    class={unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })}
    {...restProps}
  >
    <div class="sr-only" aria-live="polite" role="status">{headerTitle}</div>

    {#if header}
      {@render header({
        view,
        month: displayedMonth,
        year: displayedYear,
        title: headerTitle,
        navigate,
        navigateMonth,
        goToToday,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward
      })}
    {:else}
      <CalendarHeader {showViewSwitcher} />
    {/if}

    {#if showMiniCalendar && (view === 'week' || view === 'day' || view === 'agenda')}
      <div class="flex {miniCalendarPosition === 'right' ? 'flex-row-reverse' : ''}">
        <CalendarMiniMonth />
        <div class="min-w-0 flex-1">
          {#if view === 'week'}
            <CalendarWeekGrid {eventItem} {onEventClick} />
          {:else if view === 'day'}
            <CalendarDayView {eventItem} {onEventClick} />
          {:else if view === 'agenda'}
            <CalendarAgendaView {eventItem} {onEventClick} {agendaDays} />
          {/if}
        </div>
      </div>
    {:else if view === 'month'}
      <CalendarGrid {dayCell} {onEventClick} />
    {:else if view === 'year'}
      <CalendarYearGrid />
    {:else if view === 'week'}
      <CalendarWeekGrid {eventItem} {onEventClick} />
    {:else if view === 'day'}
      <CalendarDayView {eventItem} {onEventClick} />
    {:else if view === 'agenda'}
      <CalendarAgendaView {eventItem} {onEventClick} {agendaDays} />
    {/if}

    {#if effectiveShowLegend}
      <CalendarLegend />
    {/if}

    {#if effectiveShowEventList && selectedDateForList && view === 'month'}
      <CalendarEventList {eventItem} {onEventClick} />
    {/if}
  </div>
{/if}
