<script lang="ts">
  import { SvelteMap, MediaQuery } from 'svelte/reactivity';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { calendarVariants, type CalendarVariants } from './calendar.variants';
  import { setCalendarContext, type CalendarContext } from './calendar.context';
  import {
    getYearMonths,
    formatMonthYear,
    isInMonth,
    toIso,
    stripTime,
    addDays,
    clampMonth,
    clampDate,
    daysInMonth
  } from '$lib/date';
  import { DateGridController } from '$lib/internal/date-grid';
  import type { DateGridSelection, DateGridView } from '$lib/internal/date-grid';
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
    defaultDate,
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

  // --- Variant styles + slot-class cascade ---
  // `variantProps` feeds both the tv() style computation and the slot-class
  // cascade (so provider `overrides` can match the active variant/size).
  // Annotation is mandatory: without it the string literals widen to `string`
  // and tsc rejects the call. The root only drives `variant`/`size`; the
  // per-cell `dayState`/`hasEvents` axes are applied by sub-components.
  const variantProps: CalendarVariants = $derived({ variant, size });
  const styles = $derived(calendarVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Calendar', preset, variantProps, slotClassesProp)
  );

  // --- Animation state ---
  const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
  const shouldAnimate = $derived(animated && !reducedMotion.current);

  // --- Reference date: the single anchor the grid is built around ---
  // Priority:
  //   1. the first selected date — a populated picker opens on its selection
  //   2. `defaultDate` — an explicit day anchor (the only one that anchors a
  //      week/day view on a specific week without also selecting that day)
  //   3. `defaultMonth` / `defaultYear` — month/year anchor (resolves to the 1st;
  //      fine for month/year views, but a week/day view then opens on the 1st's
  //      week, which can fall mostly in the prior month — use `defaultDate` there)
  //   4. today
  // Read at mount time only; the user navigates freely afterwards. Remount (e.g.
  // via DatePicker's popover open/close) to re-anchor on the current selection.
  function firstDateOf(v: CalendarProps['value']): Date | undefined {
    if (v instanceof Date) return v;
    if (Array.isArray(v) && v.length > 0) return v[0];
    if (v && typeof v === 'object' && 'start' in v) return v.start;
    return undefined;
  }
  function resolveInitialReference(
    v: CalendarProps['value'],
    date: Date | undefined,
    month: number | undefined,
    year: number | undefined
  ): Date {
    const anchor = firstDateOf(v) ?? date;
    if (anchor) return stripTime(anchor);
    const today = stripTime(new Date());
    if (month == null && year == null) return today;
    return new Date(year ?? today.getFullYear(), month ?? today.getMonth(), 1);
  }
  // Uncontrolled seed: capture only the initial default*; later changes to the
  // default* props must not move the user's navigated month.
  // svelte-ignore state_referenced_locally
  let referenceDate = $state(
    resolveInitialReference(value, defaultDate, defaultMonth, defaultYear)
  );

  // The month/year derived from the single reference date.
  const displayedMonth = $derived(referenceDate.getMonth());
  const displayedYear = $derived(referenceDate.getFullYear());

  // Calendar exposes five views; the headless core handles only cell-based ones.
  // Map year/agenda onto `month` (they reuse month geometry + month navigation).
  const gridViewMode = $derived<DateGridView>(
    view === 'year' || view === 'agenda' ? 'month' : view
  );

  // --- Uncontrolled fallback ---
  let internalValue = $state<CalendarProps['value']>(undefined);
  const effectiveValue = $derived(value !== undefined ? value : internalValue);

  // --- Extra disable predicate (min/max handled by the controller) ---
  const disabledDatesSet = $derived(new Set(disabledDates.map((d) => toIso(d))));
  function checkExtraDisabled(date: Date): boolean {
    if (isDateDisabledProp?.(date)) return true;
    if (disabledDatesSet.has(toIso(date))) return true;
    return false;
  }

  // --- Headless date-grid controller: the shared mechanics engine ---
  // Calendar owns the source of truth (referenceDate, value); the controller
  // computes geometry/queries and reports navigation/selection back via callbacks.
  const controller = new DateGridController({
    get referenceDate() {
      return referenceDate;
    },
    get view() {
      return gridViewMode;
    },
    get weekStartsOn() {
      return weekStartsOn;
    },
    get locale() {
      return locale;
    },
    get selectionMode() {
      return selectionMode;
    },
    get selection() {
      return effectiveValue as DateGridSelection | undefined;
    },
    get rangeStart() {
      return undefined;
    },
    get rangeEnd() {
      return undefined;
    },
    get minDate() {
      return minDate;
    },
    get maxDate() {
      return maxDate;
    },
    get disabled() {
      return disabled;
    },
    isDateDisabled: checkExtraDisabled,
    onNavigate: handleNavigate,
    onSelect: handleSelect
  });

  function handleNavigate(next: Date) {
    referenceDate = next;
    if (view === 'week') onWeekChange?.(next);
    else if (view === 'day') onDayChange?.(next);
    else onMonthChange?.(next.getMonth(), next.getFullYear());
  }

  function handleSelect(selection: DateGridSelection, date: Date) {
    // Date-picker behaviour: clicking an outside (spill) day in the month grid
    // navigates to that month. Confined to month view — week/day anchors must
    // not jump when a cell from an adjacent month is picked. The anchor is
    // clamped to [minDate, maxDate] (a spill day at the edge of a partially
    // out-of-range month must not push referenceDate past the bound), and
    // onMonthChange reports the landed month so it stays consistent with it.
    if (
      view === 'month' &&
      (date.getMonth() !== displayedMonth || date.getFullYear() !== displayedYear)
    ) {
      const anchor = clampDate(new Date(date.getFullYear(), date.getMonth(), 1), minDate, maxDate);
      referenceDate = anchor;
      onMonthChange?.(anchor.getMonth(), anchor.getFullYear());
    }
    onDateClick?.(date);
    const next = selection as CalendarProps['value'];
    if (value !== undefined) {
      value = next;
    } else {
      internalValue = next;
    }
    onValueChange?.(next!);
  }

  // Midnight refresh for `today` — re-arms after each update via the reactive read.
  $effect(() => {
    const _current = controller.today;
    if (typeof window === 'undefined') return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const timeout = setTimeout(() => controller.refreshToday(), msUntilMidnight);
    return () => clearTimeout(timeout);
  });

  // --- Time grid: week/day always show it; month/year/agenda respect the prop ---
  const showTimeGrid = $derived.by(() => {
    if (view === 'week' || view === 'day') return true;
    return showTimeGridProp ?? events.some((e) => e.allDay === false);
  });

  // --- Derived: view-aware header title (year/agenda are Calendar-specific) ---
  const headerTitle = $derived.by(() => {
    if (view === 'year') return String(displayedYear);
    if (view === 'agenda') return formatMonthYear(displayedYear, displayedMonth, locale);
    return controller.title; // month / week / day
  });

  const yearMonths = $derived(getYearMonths(displayedYear));

  // --- Derived: visible range for recurrence expansion ---
  const visibleRange = $derived.by(() => {
    if (view === 'year') {
      return { start: new Date(displayedYear, 0, 1), end: new Date(displayedYear, 11, 31) };
    }
    if (view === 'agenda') {
      const start = new Date(displayedYear, displayedMonth, 1);
      const end = new Date(start);
      end.setDate(end.getDate() + agendaDays);
      return { start, end };
    }
    // month / week / day: the controller's cell-edge range
    return { start: controller.rangeStart, end: controller.rangeEnd };
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
      let current = startDay;
      while (current <= endDay) {
        const key = toIso(current);
        const arr = map.get(key);
        if (arr) {
          arr.push(event);
        } else {
          map.set(key, [event]);
        }
        current = addDays(current, 1);
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

  // --- Derived: legend / event-list visibility ---
  const effectiveShowEventList = $derived(showEventList ?? events.length > 0);
  const effectiveShowLegend = $derived(showLegend ?? categories.length > 0);

  // --- Derived: selected date for event list ---
  const selectedDateForList = $derived.by(() => {
    if (!effectiveValue) return null;
    if (effectiveValue instanceof Date) return effectiveValue;
    if (Array.isArray(effectiveValue)) return effectiveValue[effectiveValue.length - 1] ?? null;
    return effectiveValue.start;
  });

  // --- Event helpers ---
  function getEventsForDate(date: Date): CalendarEvent[] {
    return eventsByDate.get(toIso(date)) ?? [];
  }

  function getEventsWithDayInfo(date: Date): EventDayInfo[] {
    return getEventsForDate(date).map((event) => {
      const info = getEventDayInfo(event, date);
      return { event, ...info };
    });
  }

  function getCategoryById(id: string): CalendarEventCategory | undefined {
    return categoryMap.get(id);
  }

  // --- Navigation ---
  // `navigate` is view-aware (header + swipe). The named navigators are the
  // explicit header-snippet/mini-calendar API and mutate the reference date
  // directly so they work regardless of the active view.
  function navigate(delta: number) {
    if (view === 'year') {
      navigateYear(delta);
    } else {
      controller.navigate(delta); // month / week / day (agenda maps to month)
    }
  }

  // Move `referenceDate` to a bounded month/year and return the clamped result.
  // clampMonth keeps the month within [minDate, maxDate]; the day-of-month is
  // preserved (so a later switch to week/day view anchors on a real in-month
  // day, not the 1st's possibly-prior-month week) and then `clampDate` keeps a
  // boundary month from landing before minDate / after maxDate. Shared by every
  // programmatic month/year jump so none can escape the navigable range.
  function setReferenceMonth(month: number, year: number): { month: number; year: number } {
    const clamped = clampMonth(month, year, minDate, maxDate);
    const day = Math.min(referenceDate.getDate(), daysInMonth(clamped.year, clamped.month));
    referenceDate = clampDate(new Date(clamped.year, clamped.month, day), minDate, maxDate);
    return clamped;
  }

  function navigateMonth(delta: number) {
    const total = displayedYear * 12 + displayedMonth + delta;
    const targetYear = Math.floor(total / 12);
    const targetMonth = ((total % 12) + 12) % 12;
    controller.navDirection = delta > 0 ? 'forward' : 'backward';
    const clamped = setReferenceMonth(targetMonth, targetYear);
    onMonthChange?.(clamped.month, clamped.year);
  }

  // These named navigators mutate referenceDate directly (the custom-header /
  // mini-calendar surface), bypassing controller.navigate — so they clamp to
  // [minDate, maxDate] themselves, mirroring the clamp the controller now applies
  // to the main swipe / keyboard / header-arrow path.
  function navigateWeek(delta: number) {
    controller.navDirection = delta > 0 ? 'forward' : 'backward';
    referenceDate = clampDate(addDays(referenceDate, delta * 7), minDate, maxDate);
    onWeekChange?.(referenceDate);
  }

  function navigateDay(delta: number) {
    controller.navDirection = delta > 0 ? 'forward' : 'backward';
    referenceDate = clampDate(addDays(referenceDate, delta), minDate, maxDate);
    onDayChange?.(referenceDate);
  }

  function navigateYear(delta: number) {
    controller.navDirection = delta > 0 ? 'forward' : 'backward';
    const clamped = setReferenceMonth(displayedMonth, displayedYear + delta);
    onMonthChange?.(clamped.month, clamped.year);
  }

  function goToToday() {
    controller.goToToday();
  }

  // A programmatic month jump (header month/year picker, year-grid month tap,
  // mini-calendar) reports the landed month like the arrow navigators do — the
  // clamped result, so a bounds-corrected pick still notifies the consumer.
  function goToMonth(month: number, year: number) {
    const clamped = setReferenceMonth(month, year);
    onMonthChange?.(clamped.month, clamped.year);
  }

  function setView(v: CalendarViewMode) {
    view = v;
    onViewChange?.(v);
  }

  // --- Selection / focus / hover delegate straight to the controller ---
  function selectDate(date: Date) {
    controller.selectDate(date);
  }

  function setFocusedDate(date: Date) {
    controller.setFocusedDate(date);
  }

  function moveFocus(deltaDays: number) {
    controller.moveFocus(deltaDays);
  }

  function setHoveredDate(date: Date | null) {
    controller.setHoveredDate(date);
  }

  // --- Context: a facade over the controller (mechanics) + Calendar-specific
  // state (events, view chrome, time grid, drag, styling). Sub-components keep
  // reading one context; the mechanics are now sourced from the shared engine. ---
  const ctx: CalendarContext = {
    get displayedMonth() {
      return displayedMonth;
    },
    get displayedYear() {
      return displayedYear;
    },
    get displayedDate() {
      return referenceDate;
    },
    get today() {
      return controller.today;
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
      return controller.canGoBack;
    },
    get canGoForward() {
      return controller.canGoForward;
    },
    get canGoToToday() {
      return controller.canGoToToday;
    },
    get grid() {
      return controller.cells;
    },
    get weekdays() {
      return controller.weekdayNames;
    },
    get headerTitle() {
      return headerTitle;
    },
    get weekDates() {
      return controller.weekDates;
    },
    get yearMonths() {
      return yearMonths;
    },
    get focusedDate() {
      return controller.focusedDate;
    },
    get hoveredDate() {
      return controller.hoveredDate;
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
    moveFocus,
    setHoveredDate,
    setView,
    isDateDisabled: (date: Date) => controller.isDisabled(date),
    isDateSelected: (date: Date) => controller.isSelected(date),
    isDateToday: (date: Date) => controller.isToday(date),
    isDateInRange: (date: Date) => controller.isInSelectedRange(date),
    isDateRangeStart: (date: Date) => controller.isRangeStart(date),
    isDateRangeEnd: (date: Date) => controller.isRangeEnd(date),
    isDateInPreviewRange: (date: Date) => controller.isInPreviewRange(date),
    // View-independent (always relative to the displayed month), unlike the
    // controller's view-aware `isOutside` — the mini-calendar relies on this.
    isDateInMonth: (date: Date) => isInMonth(date, displayedMonth, displayedYear),
    get navDirection() {
      return controller.navDirection;
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
        canGoBack: controller.canGoBack,
        canGoForward: controller.canGoForward,
        canGoToToday: controller.canGoToToday
      })}
    {:else}
      <CalendarHeader {showViewSwitcher} />
    {/if}

    {#if showMiniCalendar && (view === 'week' || view === 'day' || view === 'agenda')}
      <div class="flex {miniCalendarPosition === 'right' ? 'flex-row-reverse' : ''}">
        <CalendarMiniMonth />
        <div class="min-w-0 flex-1">
          {#if view === 'week'}
            <CalendarWeekGrid {onEventClick} />
          {:else if view === 'day'}
            <CalendarDayView {onEventClick} />
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
      <CalendarWeekGrid {onEventClick} />
    {:else if view === 'day'}
      <CalendarDayView {onEventClick} />
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
