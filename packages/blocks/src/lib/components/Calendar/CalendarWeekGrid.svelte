<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getWeekdayNames, isSameDay, dateKey, getContrastTextColor } from './calendar.engine';
  import { swipeable } from './calendar.swipeable';
  import type { CalendarEvent, EventItemContext } from './calendar.types';
  import CalendarEventRenderer from './CalendarEventRenderer.svelte';
  import CalendarTimeGrid from './CalendarTimeGrid.svelte';

  const bt = useBlocksI18n();

  interface CalendarWeekGridInternalProps {
    eventItem?: Snippet<[EventItemContext]>;
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { eventItem, onEventClick, class: className = '' }: CalendarWeekGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const weekdayNames = $derived(getWeekdayNames(ctx.locale, ctx.weekStartsOn, 'short'));
  const weekKey = $derived(dateKey(ctx.weekDates[0]));

  // All-day events per date (for time grid mode)
  const allDayByDate = $derived.by(() => {
    if (!ctx.showTimeGrid) return null;
    const map = new Map<string, Array<{ event: CalendarEvent; color: string }>>(); // eslint-disable-line svelte/prefer-svelte-reactivity
    for (const date of ctx.weekDates) {
      const key = dateKey(date);
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

  const hasAnyAllDay = $derived(ctx.showTimeGrid && allDayByDate !== null && allDayByDate.size > 0);

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
  class={ctx.showTimeGrid ? slot('weekTimeLayout', className) : slot('weekGrid', className)}
  role="grid"
  tabindex={0}
  aria-label={bt('calendar.weekView')}
  onkeydown={handleKeydown}
  style="overflow: hidden;"
  {@attach swipeable({
    onSwipeLeft: () => ctx.navigate(1),
    onSwipeRight: () => ctx.navigate(-1),
    enabled: ctx.swipeable
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
        {#if ctx.showTimeGrid}
          <!-- Time grid mode: headers row + all-day area + time grid -->
          <div class="grid grid-cols-7">
            {#each ctx.weekDates as date, dayIdx (date.toISOString())}
              {@const isToday = isSameDay(date, ctx.today)}
              {@const isSelected = ctx.isDateSelected(date)}
              <button
                type="button"
                class="{slot('weekColumnHeader')} {isToday
                  ? 'bg-primary text-text-on-primary'
                  : ''} {isSelected && !isToday ? 'bg-primary-subtle' : ''}"
                data-weekday={dayIdx}
                onclick={() => handleDayClick(date)}
                tabindex={dayIdx === 0 ? 0 : -1}
                aria-label="{weekdayNames[dayIdx]} {date.getDate()}"
                aria-selected={isSelected || undefined}
                aria-current={isToday ? 'date' : undefined}
              >
                <span class="{slot('weekColumnDayName')} {isToday ? 'text-text-on-primary' : ''}">
                  {weekdayNames[dayIdx]}
                </span>
                <span class="{slot('weekColumnDayNumber')} {isToday ? 'text-text-on-primary' : ''}">
                  {date.getDate()}
                </span>
              </button>
            {/each}
          </div>

          <!-- All-day events area -->
          {#if hasAnyAllDay && allDayByDate}
            <div class="grid grid-cols-7 {slot('allDayArea')}">
              {#each ctx.weekDates as date (date.toISOString())}
                {@const key = dateKey(date)}
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

          <!-- Time grid -->
          <CalendarTimeGrid dates={ctx.weekDates} {onEventClick} />
        {:else}
          <!-- Original column layout (no time grid) -->
          <div class="col-span-7 grid grid-cols-subgrid">
            {#each ctx.weekDates as date, dayIdx (date.toISOString())}
              {@const isToday = isSameDay(date, ctx.today)}
              {@const isSelected = ctx.isDateSelected(date)}
              {@const eventsWithInfo = ctx.getEventsWithDayInfo(date)}
              <div class={slot('weekColumn')} role="gridcell">
                <button
                  type="button"
                  class="{slot('weekColumnHeader')} {isToday
                    ? 'bg-primary text-text-on-primary'
                    : ''} {isSelected && !isToday ? 'bg-primary-subtle' : ''}"
                  data-weekday={dayIdx}
                  onclick={() => handleDayClick(date)}
                  tabindex={dayIdx === 0 ? 0 : -1}
                  aria-label="{weekdayNames[dayIdx]} {date.getDate()}"
                  aria-selected={isSelected || undefined}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <span class="{slot('weekColumnDayName')} {isToday ? 'text-text-on-primary' : ''}">
                    {weekdayNames[dayIdx]}
                  </span>
                  <span
                    class="{slot('weekColumnDayNumber')} {isToday ? 'text-text-on-primary' : ''}"
                  >
                    {date.getDate()}
                  </span>
                </button>

                {#if eventsWithInfo.length > 0}
                  <div class={slot('weekEventList')}>
                    {#each eventsWithInfo as info (info.event.id)}
                      <CalendarEventRenderer {info} {eventItem} {onEventClick} />
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>
