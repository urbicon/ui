<script lang="ts" generics="T = unknown">
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  import { useBlocksI18n } from '$lib';
  import { formatDateRange, stripTime, toIso } from '$lib/date';
  import { getContrastTextColor } from '$lib/internal/contrast';
  import { DateGridController, type DateRange, type DateGridView } from '$lib/internal/date-grid';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { ResourceTimelineProps } from './index';
  import { setResourceTimelineContext } from './resource-timeline.context';
  import { getTimelineDays, getTimelineWindow, layoutTimeline } from './resource-timeline.engine';
  import {
    handleResourceTimelineKeydown,
    type ResourceTimelineKeyboardTarget
  } from './resource-timeline.keyboard';
  import type {
    ResourceTimelineContext,
    ResourceTimelineSlotName,
    TimelineCellContext,
    TimelineDayContext,
    TimelineHeaderContext,
    TimelineLaneContext,
    TimelineSpanContext
  } from './resource-timeline.types';
  import {
    resourceTimelineVariants,
    type ResourceTimelineVariants
  } from './resource-timeline.variants';
  import ResourceTimelineHeader from './ResourceTimelineHeader.svelte';

  let {
    // Content / data
    resources = [],
    groups,
    items = [],
    getResourceId,
    getRange,
    getId,
    getLabel,
    getCategoryId,
    categories = [],
    // Window
    view = 'week',
    days = 14,
    value = $bindable(undefined),
    weekStartsOn = 1,
    locale = 'auto',
    // Constraints
    minDate,
    maxDate,
    isDateDisabled,
    // Variants
    variant = 'default',
    size = 'md',
    // Behavior
    highlightToday = true,
    highlightWeekend = false,
    stickyResourceColumn = true,
    maxRowsPerLane,
    showLegend = true,
    disabled = false,
    // Callbacks
    onNavigate,
    onItemClick,
    onCellClick,
    // Snippets
    header,
    dayHeader,
    resourceLabel,
    groupLabel,
    span: spanSnippet,
    cell,
    legend,
    empty,
    // Styling
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ResourceTimelineProps<T> = $props();

  // --- Locale resolution (same contract as Planner/Calendar) ---
  const i18nLocale = useI18n();
  const resolvedLocale = $derived(resolveDateLocale(locale, i18nLocale.locale));
  const bt = useBlocksI18n();

  // --- BlocksConfig integration ---
  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: ResourceTimelineVariants = $derived({ variant, size });
  const styles = $derived(resourceTimelineVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ResourceTimeline', preset, variantProps, slotClassesProp)
  );
  // `structural` is library-authored (the pinned column, the view's own grid
  // rules) and folds BEFORE the consumer's `slotClasses` entry; `className` is
  // the consumer's `class` prop and folds after it. Each is one source, so the
  // ladder holds in both directions instead of the library winning by position.
  function slot(name: ResourceTimelineSlotName, structural?: string, className?: string): string {
    const sources = [structural, slotClasses?.[name], className];
    if (unstyled) return resolveClassChain(...sources);
    const fn = styles[name] as ((args: { class: (string | undefined)[] }) => string) | undefined;
    return fn?.({ class: sources }) ?? resolveClassChain(...sources);
  }

  // --- Reference date: controlled by `value`, else internal state seeded once ---
  let internalRef = $state(stripTime(value ?? new Date()));
  const referenceDate = $derived(value !== undefined ? stripTime(value) : internalRef);
  function setReference(next: Date) {
    const d = stripTime(next);
    internalRef = d;
    if (value !== undefined) value = d;
  }

  // --- The window. Derived here, NOT from `controller.rangeStart/rangeEnd`:
  // those come from `cells`, which pads a range to whole weeks — exact for a
  // Monday-anchored 14-day window, two days too wide for a mid-week one. ---
  const dayCount = $derived(view === 'week' ? 7 : Math.max(1, Math.floor(days)));
  const win = $derived(getTimelineWindow(referenceDate, view, dayCount, weekStartsOn));
  const dayList = $derived(getTimelineDays(win));

  // Read the prop at call time, not at construction: handing the controller the
  // `isDateDisabled` prop itself would capture whatever it was on the first
  // render and quietly ignore every later value (`state_referenced_locally`).
  function checkDateDisabled(date: Date): boolean {
    return isDateDisabled?.(date) ?? false;
  }

  // --- Headless mechanics: navigation, bounds, today. The controller runs in
  // `range` mode for `view="days"` so its span-preserving window clamp applies;
  // only its *geometry* getters are bypassed (see the window comment above). ---
  const controller = new DateGridController({
    get referenceDate() {
      return referenceDate;
    },
    get view() {
      return (view === 'week' ? 'week' : 'range') as DateGridView;
    },
    get weekStartsOn() {
      return weekStartsOn;
    },
    get locale() {
      return resolvedLocale;
    },
    get selectionMode() {
      return 'single' as const;
    },
    get selection() {
      return undefined;
    },
    get rangeStart() {
      return win.start;
    },
    get rangeEnd() {
      return win.end;
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
    isDateDisabled: checkDateDisabled,
    onNavigate: handleNavigate
  });

  function handleNavigate(next: Date, _range: DateRange) {
    setReference(next);
    const shifted = getTimelineWindow(next, view, dayCount, weekStartsOn);
    onNavigate?.(next, { start: shifted.start, end: shifted.end });
  }

  // Midnight refresh for `today` — re-arms after each update via the reactive read.
  $effect(() => {
    const _today = controller.today;
    if (typeof window === 'undefined') return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeout = setTimeout(() => controller.refreshToday(), midnight.getTime() - now.getTime());
    return () => clearTimeout(timeout);
  });

  // --- Layout ---
  const lanes = $derived(
    layoutTimeline<T>({
      resources,
      groups,
      items,
      getResourceId,
      getRange,
      getId,
      getCategoryId,
      categories,
      window: win,
      maxRows: maxRowsPerLane
    })
  );

  function bucket(
    map: Map<number, TimelineSpanContext<T>[]>,
    key: number,
    s: TimelineSpanContext<T>
  ) {
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }

  /**
   * Two indexes over one walk of a lane's spans, so they cannot disagree:
   * `byStart` are the bars a cell **renders** (a bar is one absolutely
   * positioned element anchored in its first visible cell), `coverage` are the
   * spans a cell is **covered by**. Activation and `isOccupied` read coverage —
   * resolving by start column alone made Enter on day 2 of a stay fire the
   * "add booking" hook while a click on that same day hit the overhanging bar.
   */
  const laneSpans = $derived(
    lanes.map((lane) => {
      const byStart = new Map<number, TimelineSpanContext<T>[]>();
      const coverage = new Map<number, TimelineSpanContext<T>[]>();
      for (const s of lane.spans) {
        bucket(byStart, s.startCol, s);
        for (let c = s.startCol; c < s.startCol + s.spanCols; c++) bucket(coverage, c, s);
      }
      return { byStart, coverage };
    })
  );

  // --- Roving focus. Clamped on read rather than reset in an effect, so a data
  // change cannot silently move the user's cursor to (0, 0). ---
  let focusedLaneRaw = $state(0);
  let focusedDayRaw = $state(0);
  const focusedLane = $derived(Math.min(focusedLaneRaw, Math.max(0, lanes.length - 1)));
  const focusedDay = $derived(Math.min(focusedDayRaw, Math.max(0, dayCount - 1)));

  let trackEl = $state<HTMLElement | null>(null);

  const keyboardTarget: ResourceTimelineKeyboardTarget = {
    get laneCount() {
      return lanes.length;
    },
    get dayCount() {
      return dayCount;
    },
    get disabled() {
      return disabled;
    },
    get focusedLane() {
      return focusedLane;
    },
    get focusedDay() {
      return focusedDay;
    },
    focusCell: (lane, day) => {
      focusedLaneRaw = lane;
      focusedDayRaw = day;
    },
    navigateWindow: (delta) => controller.navigate(delta),
    activateCell: (lane, day) => activate(lane, day)
  };

  /** Marks our own bars, so the grid can tell them from a `cell` snippet's controls. */
  const SPAN_MARKER = 'data-rt-span';

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target !== event.currentTarget) {
      // Interactive children (a `cell` snippet's buttons/inputs) keep their own
      // keys — but a bar is a `<button>`, so a click leaves DOM focus on it and
      // the grid would answer no arrow key at all until the user shift-Tabbed
      // back out to a cell. Navigation is taken over for a focused bar;
      // Enter/Space stay the button's own activation.
      if (event.key === 'Enter' || event.key === ' ') return;
      if (!target?.closest(`[${SPAN_MARKER}]`)) return;
    }
    if (!handleResourceTimelineKeydown(event, keyboardTarget)) return;
    const lane = focusedLane;
    const day = focusedDay;
    requestAnimationFrame(() => {
      trackEl?.querySelector<HTMLElement>(`[data-lane="${lane}"][data-day="${day}"]`)?.focus();
    });
  }

  // Interactive content inside a cell owns its own clicks — mirrors the keydown
  // guard, but a `cell` snippet fills the gridcell, so a strict
  // target===currentTarget check would make activation unreachable.
  const INTERACTIVE_SELECTOR =
    'button, a[href], input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"]';

  function isCellDisabled(lane: TimelineLaneContext<T>, date: Date): boolean {
    return disabled || lane.resource.disabled === true || controller.isDisabled(date);
  }

  /**
   * Fire `onItemClick` for a bar — gated on the cell the bar is anchored in, so
   * the pointer and the keyboard apply the *same* rule: a bar the component
   * renders `aria-disabled` cannot be activated by either. (Its own start cell,
   * not the cell the user acted on, because a click anywhere along a bar is
   * delivered by the element that lives in its first visible column.)
   */
  function emitSpan(laneIndex: number, span: TimelineSpanContext<T>) {
    const lane = lanes[laneIndex];
    const date = dayList[span.startCol];
    if (!lane || !date || isCellDisabled(lane, date)) return;
    onItemClick?.(span.item, span.resource);
  }

  // Repeated activation of one cell walks its stacked bars, top row first, and
  // wraps. Without it only row 0 would ever be reachable: the bars carry
  // `tabindex={-1}` (the grid keeps a single tab stop) and Enter would activate
  // the same one forever — precisely the case lane stacking exists for.
  let activationKey = '';
  let activationIndex = 0;

  /**
   * Enter/Space or a click on a cell: a span **covering** it wins over the
   * empty-cell hook — not merely one starting there. A bar overhangs the cells
   * of every day it covers, so a pointer on day 3 of a stay hits the bar; the
   * keyboard has to reach the same item rather than offer "add booking".
   */
  function activate(laneIndex: number, dayIndex: number) {
    const lane = lanes[laneIndex];
    const date = dayList[dayIndex];
    if (!lane || !date) return;
    focusedLaneRaw = laneIndex;
    focusedDayRaw = dayIndex;

    const covering = laneSpans[laneIndex]?.coverage.get(dayIndex);
    if (covering && covering.length > 0) {
      const key = `${laneIndex}:${dayIndex}`;
      if (key !== activationKey) {
        activationKey = key;
        activationIndex = 0;
      }
      const span = covering[activationIndex % covering.length];
      activationIndex = (activationIndex + 1) % covering.length;
      emitSpan(laneIndex, span);
      return;
    }

    activationKey = '';
    if (isCellDisabled(lane, date)) return;
    onCellClick?.(lane.resource, date);
  }

  function handleCellClick(event: MouseEvent, laneIndex: number, dayIndex: number) {
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    activate(laneIndex, dayIndex);
  }

  /** A click on the bar itself — moves the cursor to its anchor cell, then fires. */
  function activateSpan(laneIndex: number, span: TimelineSpanContext<T>) {
    focusedLaneRaw = laneIndex;
    focusedDayRaw = span.startCol;
    activationKey = '';
    emitSpan(laneIndex, span);
  }

  // --- Per-day / per-cell contexts ---
  const weekdayFormatter = $derived(new Intl.DateTimeFormat(resolvedLocale, { weekday: 'short' }));

  function dayContext(date: Date, index: number): TimelineDayContext {
    return {
      date,
      isoDate: toIso(date),
      index,
      isToday: controller.isToday(date),
      isWeekend: controller.isWeekend(date),
      isDisabled: controller.isDisabled(date),
      weekday: weekdayFormatter.format(date),
      weekNumber: controller.weekNumberFor(date)
    };
  }

  function cellContext(
    lane: TimelineLaneContext<T>,
    laneIndex: number,
    date: Date,
    dayIndex: number
  ): TimelineCellContext {
    return {
      resource: lane.resource,
      date,
      isoDate: toIso(date),
      isToday: controller.isToday(date),
      isWeekend: controller.isWeekend(date),
      isDisabled: isCellDisabled(lane, date),
      isOccupied: laneSpans[laneIndex]?.coverage.has(dayIndex) ?? false
    };
  }

  // --- Title. `view="week"` is the controller's own; `view="days"` formats the
  // UNPADDED window, which the controller's `title` cannot (its range title
  // reads the week-padded cells). ---
  const title = $derived(
    view === 'week' ? controller.title : formatDateRange(win.start, win.end, resolvedLocale)
  );

  const headerContext = $derived<TimelineHeaderContext>({
    title,
    rangeStart: win.start,
    rangeEnd: win.end,
    weekNumber: controller.weekNumberFor(referenceDate),
    view,
    navigate: (delta) => controller.navigate(delta),
    goToToday: () => controller.goToToday(),
    goTo: (date) => controller.goTo(date),
    canGoBack: controller.canGoBack,
    canGoForward: controller.canGoForward,
    canGoToToday: controller.canGoToToday
  });

  const timelineCtx: ResourceTimelineContext = {
    get view() {
      return view;
    },
    get title() {
      return title;
    },
    get rangeStart() {
      return win.start;
    },
    get rangeEnd() {
      return win.end;
    },
    get weekNumber() {
      return controller.weekNumberFor(referenceDate);
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
    get locale() {
      return resolvedLocale;
    },
    get disabled() {
      return disabled;
    },
    navigate: (delta) => controller.navigate(delta),
    goToToday: () => controller.goToToday(),
    goTo: (date) => controller.goTo(date),
    get unstyled() {
      return unstyled;
    },
    slot
  };
  setResourceTimelineContext(timelineCtx);

  // `repeat()` cannot take a `var()` count, so the template is assembled here
  // (the day count is the one value the stylesheet cannot know) while every
  // width in it stays a custom property the size axis owns.
  const trackStyle = $derived(
    `--rt-cols:var(--rt-lane-w) repeat(${dayCount}, minmax(var(--rt-day-w), 1fr));` +
      `--rt-min-w:calc(var(--rt-lane-w) + ${dayCount} * var(--rt-day-w));`
  );

  const stickyColumn = $derived(stickyResourceColumn ? 'sticky left-0 z-20' : '');
  // The pinned column paints over the scroll port's leading `--rt-lane-w`, and
  // `focus()` scrolls a cell to the port's *nearest edge* — so an ArrowLeft into
  // the off-screen part would park the roving cell underneath it. Same prop as
  // the pin itself, so the padding cannot outlive the column that needs it.
  const stickyScrollPadding = $derived(
    stickyResourceColumn ? '[scroll-padding-inline-start:var(--rt-lane-w)]' : ''
  );

  function spanStyle(s: TimelineSpanContext<T>): string {
    const geometry = `--rt-span:${s.spanCols};--rt-row:${s.row};`;
    if (!s.category) return geometry;
    return `${geometry}background-color:${s.category.color};color:${getContrastTextColor(s.category.color)};`;
  }
</script>

<div {...restProps} class={slot('base', undefined, className)}>
  <div class="sr-only" aria-live="polite" role="status">{title}</div>

  {#if header}
    {@render header(headerContext)}
  {:else}
    <ResourceTimelineHeader />
  {/if}

  <!-- The scroll port. `overflow-x` lives HERE and never on the root, so a
       window wider than the viewport scrolls the track instead of the page.
       Without lanes there is no grid at all: a day axis over nothing is a
       skeleton, and the empty state below says the same thing once. -->
  {#if lanes.length > 0}
    <div
      bind:this={trackEl}
      role="grid"
      aria-label={bt('resourceTimeline.grid')}
      aria-colcount={dayCount + 1}
      aria-disabled={disabled || undefined}
      class={slot('track', stickyScrollPadding)}
      style={trackStyle}
    >
      <div role="row" class={slot('dayHeaderRow')}>
        <span role="columnheader" aria-colindex={1} class={slot('corner', stickyColumn)}></span>
        {#each dayList as date, dayIndex (toIso(date))}
          {@const info = dayContext(date, dayIndex)}
          <!-- `aria-current="date"` reads the controller's raw `isToday`, so the
               visual `highlightToday` preference never costs the semantic pointer
               — the rule Calendar's today paths and DateGridScaffold follow. -->
          <span
            role="columnheader"
            aria-colindex={dayIndex + 2}
            aria-current={info.isToday ? 'date' : undefined}
            class={[
              slot('dayHeader'),
              highlightToday && info.isToday && 'text-primary-text font-semibold',
              highlightWeekend && info.isWeekend && 'bg-surface-subtle'
            ]}
          >
            {#if dayHeader}
              {@render dayHeader(info)}
            {:else}
              <span class={slot('dayHeaderWeekday')}>{info.weekday}</span>
              <span class={slot('dayHeaderDate')}>{info.date.getDate()}</span>
            {/if}
          </span>
        {/each}
      </div>

      <div role="rowgroup" class={slot('body')}>
        {#each lanes as lane, laneIndex (lane.resource.id)}
          {#if lane.group && lane.group.id !== lanes[laneIndex - 1]?.group?.id}
            <div role="row" class={slot('groupRow')}>
              <span
                role="rowheader"
                aria-colindex={1}
                aria-colspan={dayCount + 1}
                class={slot('groupLabel', stickyColumn)}
              >
                {#if groupLabel}
                  {@render groupLabel({
                    group: lane.group,
                    resources: lanes
                      .filter((l) => l.group?.id === lane.group?.id)
                      .map((l) => l.resource)
                  })}
                {:else}
                  {lane.group.label}
                {/if}
              </span>
            </div>
          {/if}

          <div role="row" class={slot('lane')} style="--rt-rows:{lane.rows}">
            <span role="rowheader" aria-colindex={1} class={slot('laneHeader', stickyColumn)}>
              {#if resourceLabel}
                {@render resourceLabel({ resource: lane.resource })}
              {:else}
                <span class={slot('laneLabel')}>{lane.resource.label}</span>
                {#if lane.resource.description}
                  <span class={slot('laneDescription')}>{lane.resource.description}</span>
                {/if}
              {/if}
            </span>

            {#each dayList as date, dayIndex (toIso(date))}
              {@const c = cellContext(lane, laneIndex, date, dayIndex)}
              <div
                role="gridcell"
                data-lane={laneIndex}
                data-day={dayIndex}
                data-date={c.isoDate}
                aria-colindex={dayIndex + 2}
                aria-disabled={c.isDisabled || undefined}
                aria-current={c.isToday ? 'date' : undefined}
                tabindex={laneIndex === focusedLane && dayIndex === focusedDay ? 0 : -1}
                class={[
                  slot('dayCell'),
                  highlightWeekend && c.isWeekend && 'bg-surface-subtle',
                  highlightToday && c.isToday && 'bg-primary-subtle',
                  c.isDisabled && 'cursor-not-allowed opacity-40'
                ]}
                onclick={(event) => handleCellClick(event, laneIndex, dayIndex)}
                onkeydown={onKeydown}
              >
                {#if cell}
                  {@render cell(c)}
                {/if}

                {#each laneSpans[laneIndex]?.byStart.get(dayIndex) ?? [] as s (s.id)}
                  <button
                    type="button"
                    data-rt-span=""
                    class={[
                      slot('span'),
                      !s.isStart && 'rounded-l-none',
                      !s.isEnd && 'rounded-r-none',
                      !s.category && 'bg-primary'
                    ]}
                    style={spanStyle(s)}
                    tabindex={-1}
                    aria-label={getLabel?.(s.item) ?? bt('resourceTimeline.occupied')}
                    onclick={(event) => {
                      event.stopPropagation();
                      activateSpan(laneIndex, s);
                    }}
                  >
                    {#if spanSnippet}
                      {@render spanSnippet(s)}
                    {:else if getLabel}
                      <span class={slot('spanLabel')}>{getLabel(s.item)}</span>
                    {/if}
                  </button>
                {/each}

                {#if lane.overflow > 0 && dayIndex === dayCount - 1}
                  <span class={slot('overflow')}>
                    {bt('resourceTimeline.moreItems', { count: lane.overflow })}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class={slot('empty')}>
      {#if empty}
        {@render empty()}
      {:else}
        {bt('resourceTimeline.noResources')}
      {/if}
    </div>
  {/if}

  {#if showLegend && categories.length > 0}
    {#if legend}
      {@render legend({ categories })}
    {:else}
      <div class={slot('legend')}>
        {#each categories as category (category.id)}
          <span class={slot('legendItem')}>
            <span class={slot('legendDot')} style="background-color:{category.color}"></span>
            <span class={slot('legendLabel')}>{category.label}</span>
          </span>
        {/each}
      </div>
    {/if}
  {/if}
</div>
