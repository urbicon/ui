<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { isSameDay, toIso } from '$lib/date';
  import { generateTimeSlots, positionEvents } from './calendar.engine';
  import type { CalendarEvent, PositionedEvent } from './calendar.types';
  import CalendarTimeEvent from './CalendarTimeEvent.svelte';

  interface CalendarTimeGridInternalProps {
    dates: Date[];
    onEventClick?: (event: CalendarEvent) => void;
    /**
     * Head cell for one date, rendered as the top row of the grid (the week
     * view's weekday buttons). It belongs *inside* this component rather than
     * above it because the grid is the horizontal scroll container: a head row
     * living outside it would keep its own seven equal columns and drift out of
     * step with the day columns the moment the grid scrolls. Sticky to the top,
     * so it survives the vertical scroll it now shares with the hours.
     */
    columnHeader?: Snippet<[{ date: Date; index: number }]>;
    /**
     * All-day band cell for one date — same alignment argument as
     * `columnHeader`, and rendered into the *same* cell as it, below the head.
     * One pinned strip rather than two stacked sticky rows: the second would
     * need the first's measured height as its `top`, and an unpinned band
     * scrolls out of sight the moment the grid jumps to the current time.
     * Either snippet alone builds the strip on its own.
     */
    columnAllDay?: Snippet<[{ date: Date; index: number }]>;
    /**
     * Reports whether the day columns currently overflow the grid sideways.
     * The week layout owns a swipe gesture on the same axis and has to know
     * which of the two the finger belongs to — and that cannot be inferred from
     * the viewport, only measured: it depends on the card's width, the day count
     * and `--blocks-calendar-day-min-width`. Called on mount and whenever the
     * grid resizes, only on change.
     */
    onHorizontalOverflow?: (overflowing: boolean) => void;
    class?: string;
  }

  let {
    dates,
    onEventClick,
    columnHeader,
    columnAllDay,
    onHorizontalOverflow,
    class: className = ''
  }: CalendarTimeGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  // Slot height in px — consistent per-hour height across intervals. The hour
  // height comes from the context already resolved (the `timeGridHourHeight`
  // prop, else the size-derived default), so this file no longer owns the
  // size→height coupling that made a long day's card height unreachable.
  const slotHeight = $derived(
    ctx.timeGridInterval === 30 ? ctx.timeGridHourHeight / 2 : ctx.timeGridHourHeight
  );
  const timeSlots = $derived(
    generateTimeSlots(ctx.timeGridStartHour, ctx.timeGridEndHour, ctx.timeGridInterval)
  );
  const totalHeight = $derived(timeSlots.length * slotHeight);

  // Position timed events per date column
  const positionedByDate = $derived.by(() => {
    // Local computation inside $derived — the returned Map is read-only
    // downstream, so SvelteMap's reactive wrapping is unnecessary.
    const map = new Map<string, PositionedEvent[]>();
    for (const date of dates) {
      const key = toIso(date);
      const dayEvents = ctx.getEventsForDate(date).filter((e) => e.allDay === false);
      map.set(key, positionEvents(dayEvents, date, ctx.timeGridStartHour, ctx.timeGridEndHour));
    }
    return map;
  });

  // Current time indicator (updates every minute)
  let currentTime = $state(new Date());

  $effect(() => {
    const id = setInterval(() => {
      currentTime = new Date();
    }, 60_000);
    return () => clearInterval(id);
  });

  const currentTimePercent = $derived.by(() => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const gridStart = ctx.timeGridStartHour * 60;
    const gridEnd = ctx.timeGridEndHour * 60;
    if (minutes < gridStart || minutes > gridEnd) return null;
    return ((minutes - gridStart) / (gridEnd - gridStart)) * 100;
  });

  let gridEl: HTMLDivElement | undefined = $state();
  let hourGutterEl: HTMLDivElement | undefined = $state();

  // Auto-scroll to current time on mount (only once). The hour rows no longer
  // start at scrollTop 0 — the pinned head strip sits above them inside the same
  // scroll port — so the offset is read off the layout (`offsetTop` against the
  // positioned grid; the gutter is sticky on the horizontal axis only, so its
  // vertical offset is the strip's height) instead of being assumed to be zero.
  // The `relative` on the `timeGrid` slot is what `offsetTop` resolves against;
  // calendar.variants.test.ts holds it there.
  let hasAutoScrolled = false;
  $effect(() => {
    if (!gridEl || currentTimePercent === null || hasAutoScrolled) return;
    const hoursTop = hourGutterEl?.offsetTop ?? 0;
    const scrollTo = hoursTop + (currentTimePercent / 100) * totalHeight - gridEl.clientHeight / 3;
    gridEl.scrollTop = Math.max(0, scrollTo);
    hasAutoScrolled = true;
  });

  // Does the grid actually overflow sideways? Reported up rather than guessed
  // from the viewport, because the answer is a layout fact: card width against
  // day count × `--blocks-calendar-day-min-width`. A ResizeObserver on the port
  // covers the case that changes it (the card being resized); the column count
  // is read here so a view/date change re-measures too.
  let reportedOverflow: boolean | undefined;
  $effect(() => {
    const el = gridEl;
    const report = onHorizontalOverflow;
    void dates.length; // read as a dependency: a changed column count re-measures
    if (!el || !report) return;
    const measure = () => {
      // 1 px of slack: fractional track widths round the two apart on their own.
      const overflowing = el.scrollWidth - el.clientWidth > 1;
      if (overflowing === reportedOverflow) return;
      reportedOverflow = overflowing;
      report(overflowing);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const canCreate = $derived(!!ctx.onTimeSlotCreate);

  function handleSlotClick(date: Date, slotHour: number, slotMinute: number) {
    if (!ctx.onTimeSlotCreate) return;
    // Local Date math handed straight to a callback — not reactive state.
    const start = new Date(date);
    start.setHours(slotHour, slotMinute, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    ctx.onTimeSlotCreate(start, end);
  }
</script>

<!--
  Only the day COUNT is inline; the track list itself is on the `timeGrid` slot
  (`auto` gutter + `minmax(--blocks-calendar-day-min-width, 1fr)` per day), so
  `unstyled` strips the column system with the rest of the look instead of
  leaving an inline declaration no class can beat. Seven columns past the
  container width therefore scroll instead of shrinking to the ~50 px per day a
  390 px phone used to hand them (issue #96). Day view passes one date and never
  reaches the threshold.
-->
<div
  bind:this={gridEl}
  class={slot('timeGrid', className)}
  style="--blocks-calendar-day-count: {dates.length};"
>
  <!-- Pinned strip: the corner sits over both sticky axes, the day heads over
       the vertical one. Head and all-day band share ONE cell per column so a
       single `sticky top-0` carries both — see `columnAllDay` above. -->
  {#if columnHeader || columnAllDay}
    <div class={slot('timeCorner')}></div>
    {#each dates as date, i (date.getTime())}
      <div class={slot('timeHeadCell')}>
        {#if columnHeader}
          {@render columnHeader({ date, index: i })}
        {/if}
        {#if columnAllDay}
          <div class={slot('allDayArea')}>
            {@render columnAllDay({ date, index: i })}
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  <!-- Time labels column: stays put while the day columns scroll under it -->
  <div bind:this={hourGutterEl} class={slot('timeGutter')}>
    {#each timeSlots as ts (ts.hour * 60 + ts.minute)}
      <div class={slot('timeLabel')} style="height: {slotHeight}px;">
        {ts.label}
      </div>
    {/each}
  </div>

  <!-- Day columns. `data-day-column` is not decoration: it is the box that
       spans exactly startHour…endHour, and the resize handle maps pixels to
       minutes against it (calendar.drag.ts). The scroll port cannot serve —
       since #96 it also holds the pinned strip above the hours. -->
  {#each dates as date (date.getTime())}
    {@const key = toIso(date)}
    {@const positioned = positionedByDate.get(key) ?? []}
    {@const isToday = isSameDay(date, ctx.today)}

    <div data-day-column class={slot('timeDayColumn')}>
      <!-- Slot divider lines -->
      {#each timeSlots as ts (ts.hour * 60 + ts.minute)}
        {#if canCreate}
          <button
            type="button"
            class="{slot(
              'timeSlotRow'
            )} hover:bg-primary-subtle/30 w-full cursor-cell text-left transition-colors"
            style="height: {slotHeight}px;"
            tabindex={-1}
            aria-label={ts.label}
            onclick={() => handleSlotClick(date, ts.hour, ts.minute)}
          ></button>
        {:else}
          <div class={slot('timeSlotRow')} style="height: {slotHeight}px;"></div>
        {/if}
      {/each}

      <!-- Positioned events -->
      {#each positioned as pos (pos.event.id)}
        {@const category = pos.event.categoryId
          ? ctx.getCategoryById(pos.event.categoryId)
          : undefined}
        <CalendarTimeEvent
          event={pos.event}
          {category}
          top={pos.top}
          height={pos.height}
          column={pos.column}
          totalColumns={pos.totalColumns}
          {onEventClick}
        />
      {/each}

      <!-- Current time line -->
      {#if isToday && currentTimePercent !== null}
        <div class={slot('currentTimeLine')} style="top: {currentTimePercent}%;">
          <!-- Dot matches the line: the shared `live` ("now") accent, not danger. -->
          <div class="bg-live absolute -top-1 -left-1 size-2 rounded-full"></div>
        </div>
      {/if}
    </div>
  {/each}
</div>
