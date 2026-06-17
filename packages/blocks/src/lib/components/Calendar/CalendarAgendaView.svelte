<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { formatDate, toIso, stripTime } from '$lib/date';
  import { swipeable } from './calendar.swipeable';
  import type { CalendarEvent, EventDayInfo, EventItemContext } from './calendar.types';
  import CalendarEventRenderer from './CalendarEventRenderer.svelte';

  const bt = useBlocksI18n();

  interface CalendarAgendaViewInternalProps {
    eventItem?: Snippet<[EventItemContext]>;
    onEventClick?: (event: CalendarEvent) => void;
    agendaDays?: number;
    class?: string;
  }

  let {
    eventItem,
    onEventClick,
    agendaDays = 30,
    class: className = ''
  }: CalendarAgendaViewInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  // Generate days with events for the agenda period
  const agendaEntries = $derived.by(() => {
    const start = stripTime(new Date(ctx.displayedYear, ctx.displayedMonth, 1));
    const entries: Array<{
      date: Date;
      dateLabel: string;
      isToday: boolean;
      events: EventDayInfo[];
    }> = [];

    for (let i = 0; i < agendaDays; i++) {
      const d = new Date(start); // eslint-disable-line svelte/prefer-svelte-reactivity
      d.setDate(start.getDate() + i);
      const dayEvents = ctx.getEventsWithDayInfo(d);
      if (dayEvents.length === 0) continue;

      entries.push({
        date: d,
        dateLabel: formatDate(d, ctx.locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        isToday: ctx.isDateToday(d),
        events: dayEvents
      });
    }

    return entries;
  });

  const agendaKey = $derived(`${ctx.displayedYear}-${ctx.displayedMonth}`);

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        ctx.navigate(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        ctx.navigate(1);
        break;
    }
  }
</script>

<div
  class={slot('agendaView', className)}
  role="region"
  tabindex={0}
  aria-label={bt('calendar.agendaView')}
  onkeydown={handleKeydown}
  {@attach swipeable({
    onSwipeLeft: () => ctx.navigate(1),
    onSwipeRight: () => ctx.navigate(-1),
    enabled: ctx.swipeable
  })}
  style="overflow: hidden;"
>
  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key agendaKey}
      <div
        in:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
          : { duration: 0 }}
        out:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
          : { duration: 0 }}
      >
        {#if agendaEntries.length === 0}
          <div class={slot('empty')}>{bt('calendar.noEvents')}</div>
        {:else}
          {#each agendaEntries as entry (toIso(entry.date))}
            <section class={slot('agendaDayGroup')}>
              <div
                class="{slot('agendaDayHeader')} {entry.isToday ? 'text-primary font-bold' : ''}"
              >
                {entry.dateLabel}
              </div>
              <div class={slot('agendaEventList')}>
                {#each entry.events as info (info.event.id)}
                  <CalendarEventRenderer {info} {eventItem} {onEventClick} />
                {/each}
              </div>
            </section>
          {/each}
        {/if}
      </div>
    {/key}
  </div>
</div>
