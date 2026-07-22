<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getWeekNumber, toIso } from '$lib/date';
  import { handleDateGridKeydown } from '$lib/internal/date-grid';
  import { getMultiDayEventLayout } from './calendar.engine';
  import { swipeable } from '$lib/utils/swipeable';
  import type { CalendarEvent, DayCellContext } from './calendar.types';
  import CalendarWeekdayHeader from './CalendarWeekdayHeader.svelte';
  import CalendarDay from './CalendarDay.svelte';
  import CalendarMultiDayBar from './CalendarMultiDayBar.svelte';

  const bt = useBlocksI18n();

  interface CalendarGridInternalProps {
    dayCell?: Snippet<[DayCellContext]>;
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { dayCell, onEventClick, class: className = '' }: CalendarGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const gridKey = $derived(`${ctx.displayedYear}-${ctx.displayedMonth}`);

  // Compute multi-day bar layout
  const multiDayLayout = $derived(getMultiDayEventLayout(ctx.events as CalendarEvent[], ctx.grid));

  // Map event IDs to events for quick lookup
  const eventById = $derived.by(() => {
    const map = new Map<string, CalendarEvent>();
    for (const e of ctx.events) {
      map.set(e.id, e);
    }
    return map;
  });

  const barHeight = $derived(ctx.size === 'sm' ? 16 : ctx.size === 'lg' ? 24 : 20);
  const barGap = 2;

  // Roving-focus keyboard nav runs through the shared date-grid handler (the same
  // one Planner's DateGridScaffold uses) so the ARIA key map — arrows, Home/End,
  // Page(±month), Shift+Page(±year), Enter/Space — lives in one place. The
  // CalendarContext satisfies DateGridKeyboardTarget (moveFocus/setFocusedDate/
  // selectDate all delegate to the shared controller).
  let gridEl = $state<HTMLElement | null>(null);

  function handleKeydown(event: KeyboardEvent) {
    if (!handleDateGridKeydown(event, ctx)) return;
    // CalendarDay uses pure roving tabindex with no isFocused-driven .focus(), so
    // this rAF is the only thing that moves real DOM focus onto the landed day.
    // The controller clamps focus to [minDate, maxDate], so target the day that
    // actually took the roving tabindex (ctx.focusedDate), not the raw key intent.
    const target = toIso(ctx.focusedDate);
    requestAnimationFrame(() => {
      gridEl?.querySelector<HTMLElement>(`[data-date="${target}"]`)?.focus();
    });
  }
</script>

<div
  bind:this={gridEl}
  class={slot('grid', className)}
  role="grid"
  tabindex={0}
  aria-label={bt('calendar.calendarGrid')}
  onkeydown={handleKeydown}
  onmouseleave={() => ctx.setHoveredDate(null)}
  style="overflow: hidden; position: relative;"
  {@attach swipeable({
    // Direction-gated like the header arrows (the DateGridScaffold pattern): a
    // swipe at the bound is inert — no navDirection flip, no clamped no-op emit.
    onSwipeLeft: () => {
      if (ctx.canGoForward) ctx.navigate(1);
    },
    onSwipeRight: () => {
      if (ctx.canGoBack) ctx.navigate(-1);
    },
    enabled: ctx.swipeable && !ctx.disabled
  })}
>
  <CalendarWeekdayHeader />

  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key gridKey}
      <div
        in:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
          : { duration: 0 }}
        out:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
          : { duration: 0 }}
      >
        {#each ctx.grid as week, weekIdx (week[0] ? toIso(week[0]) : weekIdx)}
          {@const weekLayout = multiDayLayout[weekIdx]}
          {@const maxBarRow =
            weekLayout?.segments.length > 0
              ? Math.max(...weekLayout.segments.map((s) => s.row)) + 1
              : 0}
          {@const _barAreaHeight = maxBarRow * (barHeight + barGap)}

          {#if weekLayout && weekLayout.segments.length > 0}
            <div
              class={slot('multiDayBarContainer')}
              style="grid-template-columns: repeat({ctx.showWeekNumbers
                ? 8
                : 7}, minmax(0, 1fr)); grid-template-rows: repeat({maxBarRow}, auto);"
            >
              {#each weekLayout.segments as seg (seg.eventId + '-' + weekIdx)}
                {@const event = eventById.get(seg.eventId)}
                {@const colOffset = ctx.showWeekNumbers ? 1 : 0}
                {#if event}
                  <CalendarMultiDayBar
                    {event}
                    startCol={seg.startCol + colOffset}
                    spanCols={seg.spanCols}
                    isFirstSegment={seg.isFirstSegment}
                    isLastSegment={seg.isLastSegment}
                    row={seg.row}
                    {onEventClick}
                  />
                {/if}
              {/each}
            </div>
          {/if}

          <div class="{slot('weekRow')} {ctx.showWeekNumbers ? 'grid-cols-8' : ''}" role="row">
            {#if ctx.showWeekNumbers}
              <span class={slot('weekNumber')} role="rowheader">
                {getWeekNumber(week[3])}
              </span>
            {/if}
            {#each week as date (date.toISOString())}
              <CalendarDay {date} {dayCell} {onEventClick} />
            {/each}
          </div>
        {/each}
      </div>
    {/key}
  </div>
</div>
