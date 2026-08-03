<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getWeekdayNames, isSameDay, toIso } from '$lib/date';
  import { getContrastTextColor } from './calendar.engine';
  import { swipeable } from '$lib/utils/swipeable';
  import type { CalendarEvent } from './calendar.types';
  import CalendarTimeGrid from './CalendarTimeGrid.svelte';

  const bt = useBlocksI18n();

  // The week view renders only as an hour grid (showTimeGrid is always true for
  // week), so events flow through CalendarTimeGrid — no custom `eventItem` here.
  interface CalendarWeekGridInternalProps {
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { onEventClick, class: className = '' }: CalendarWeekGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const weekdayNames = $derived(getWeekdayNames(ctx.locale, ctx.weekStartsOn, 'short'));
  const weekKey = $derived(toIso(ctx.weekDates[0]));

  // All-day events per date, drawn in the band above the hour grid.
  const allDayByDate = $derived.by(() => {
    const map = new Map<string, Array<{ event: CalendarEvent; color: string }>>();
    for (const date of ctx.weekDates) {
      const key = toIso(date);
      const allDay = ctx
        .getEventsForDate(date)
        .filter((e) => e.allDay !== false)
        .map((e) => ({
          event: e,
          color: e.categoryId
            ? (ctx.getCategoryById(e.categoryId)?.color ?? 'oklch(0.65 0.15 250)')
            : 'oklch(0.65 0.15 250)'
        }));
      if (allDay.length > 0) map.set(key, allDay);
    }
    return map;
  });

  const hasAnyAllDay = $derived(allDayByDate.size > 0);

  function handleDayClick(date: Date) {
    ctx.selectDate(date);
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const headers = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-weekday]')
    );
    const currentIdx = headers.indexOf(target);
    if (currentIdx < 0) return;

    let nextIdx: number;

    switch (e.key) {
      case 'ArrowRight':
        nextIdx = Math.min(currentIdx + 1, headers.length - 1);
        break;
      case 'ArrowLeft':
        nextIdx = Math.max(currentIdx - 1, 0);
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = headers.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (ctx.weekDates[currentIdx]) {
          handleDayClick(ctx.weekDates[currentIdx]);
        }
        return;
      default:
        return;
    }

    if (nextIdx !== currentIdx) {
      e.preventDefault();
      headers[nextIdx]?.focus();
    }
  }
</script>

<div
  class={slot('weekTimeLayout', className)}
  role="grid"
  tabindex={0}
  aria-label={bt('calendar.weekView')}
  onkeydown={handleKeydown}
  style="overflow: hidden;"
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
  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key weekKey}
      <div
        in:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
          : { duration: 0 }}
        out:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
          : { duration: 0 }}
      >
        <!-- Day headers row. `markToday` gates the *look* (this is the
             full-bleed primary block issue #97 was filed over); `aria-current`
             stays on the raw `isToday` so the semantics survive the preference. -->
        <div class="grid grid-cols-7">
          {#each ctx.weekDates as date, dayIdx (toIso(date))}
            {@const isToday = isSameDay(date, ctx.today)}
            {@const markToday = isToday && ctx.highlightToday}
            {@const isSelected = ctx.isDateSelected(date)}
            <button
              type="button"
              class="{slot('weekColumnHeader')} {markToday
                ? 'bg-primary text-text-on-primary'
                : ''} {isSelected && !markToday ? 'bg-primary-subtle' : ''}"
              data-weekday={dayIdx}
              onclick={() => handleDayClick(date)}
              tabindex={dayIdx === 0 ? 0 : -1}
              aria-label="{weekdayNames[dayIdx]} {date.getDate()}"
              aria-current={isToday ? 'date' : undefined}
            >
              <span class="{slot('weekColumnDayName')} {markToday ? 'text-text-on-primary' : ''}">
                {weekdayNames[dayIdx]}
              </span>
              <span class="{slot('weekColumnDayNumber')} {markToday ? 'text-text-on-primary' : ''}">
                {date.getDate()}
              </span>
            </button>
          {/each}
        </div>

        <!-- All-day events band -->
        {#if hasAnyAllDay}
          <div class="grid grid-cols-7 {slot('allDayArea')}">
            {#each ctx.weekDates as date (toIso(date))}
              {@const key = toIso(date)}
              {@const items = allDayByDate.get(key) ?? []}
              <div class="flex min-h-5 flex-col gap-px px-0.5">
                {#each items as item (item.event.id)}
                  <button
                    type="button"
                    class={slot('weekAllDayEvent')}
                    style="background-color: {item.color}; color: {getContrastTextColor(
                      item.color
                    )};"
                    onclick={() => onEventClick?.(item.event)}
                    title={item.event.title}
                  >
                    {item.event.title}
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Hour grid -->
        <CalendarTimeGrid dates={ctx.weekDates} {onEventClick} />
      </div>
    {/key}
  </div>
</div>
