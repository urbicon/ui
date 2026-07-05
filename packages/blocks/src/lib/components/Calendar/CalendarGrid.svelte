<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getWeekNumber, toIso } from '$lib/date';
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

  // Keyboard navigation handler
  // Local Date copies for keyboard nav — not reactive state.
  function handleKeydown(e: KeyboardEvent) {
    const current = new Date(ctx.focusedDate);
    let newDate: Date | null = null;

    switch (e.key) {
      case 'ArrowRight':
        newDate = new Date(current);
        newDate.setDate(current.getDate() + 1);
        break;
      case 'ArrowLeft':
        newDate = new Date(current);
        newDate.setDate(current.getDate() - 1);
        break;
      case 'ArrowDown':
        newDate = new Date(current);
        newDate.setDate(current.getDate() + 7);
        break;
      case 'ArrowUp':
        newDate = new Date(current);
        newDate.setDate(current.getDate() - 7);
        break;
      case 'Home':
        if (e.ctrlKey || e.metaKey) {
          newDate = new Date(ctx.displayedYear, ctx.displayedMonth, 1);
        } else {
          newDate = new Date(current);
          newDate.setDate(current.getDate() - ((current.getDay() - ctx.weekStartsOn + 7) % 7));
        }
        break;
      case 'End':
        if (e.ctrlKey || e.metaKey) {
          newDate = new Date(ctx.displayedYear, ctx.displayedMonth + 1, 0);
        } else {
          newDate = new Date(current);
          newDate.setDate(
            current.getDate() + (6 - ((current.getDay() - ctx.weekStartsOn + 7) % 7))
          );
        }
        break;
      case 'PageDown':
        newDate = new Date(current);
        newDate.setMonth(current.getMonth() + 1);
        break;
      case 'PageUp':
        newDate = new Date(current);
        newDate.setMonth(current.getMonth() - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        ctx.selectDate(ctx.focusedDate);
        return;
      case 'Escape':
        return;
      default:
        return;
    }

    if (newDate) {
      e.preventDefault();
      ctx.setFocusedDate(newDate);

      requestAnimationFrame(() => {
        const dateStr = `${newDate!.getFullYear()}-${String(newDate!.getMonth() + 1).padStart(2, '0')}-${String(newDate!.getDate()).padStart(2, '0')}`;
        const button = (e.currentTarget as HTMLElement)?.querySelector(
          `[data-date="${dateStr}"]`
        ) as HTMLElement;
        button?.focus();
      });
    }
  }
</script>

<div
  class={slot('grid', className)}
  role="grid"
  tabindex={0}
  aria-label={bt('calendar.calendarGrid')}
  onkeydown={handleKeydown}
  onmouseleave={() => ctx.setHoveredDate(null)}
  style="overflow: hidden; position: relative;"
  {@attach swipeable({
    onSwipeLeft: () => ctx.navigate(1),
    onSwipeRight: () => ctx.navigate(-1),
    enabled: ctx.swipeable
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
