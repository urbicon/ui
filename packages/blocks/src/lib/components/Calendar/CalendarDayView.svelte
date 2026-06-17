<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Badge } from '$lib/primitives/Badge';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { formatDateFull, dateKey } from './calendar.engine';
  import { swipeable } from './calendar.swipeable';
  import type { CalendarEvent, EventItemContext } from './calendar.types';
  import CalendarEventRenderer from './CalendarEventRenderer.svelte';
  import CalendarTimeGrid from './CalendarTimeGrid.svelte';

  const bt = useBlocksI18n();

  interface CalendarDayViewInternalProps {
    eventItem?: Snippet<[EventItemContext]>;
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { eventItem, onEventClick, class: className = '' }: CalendarDayViewInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const displayedDate = $derived(ctx.displayedDate);
  const eventsWithInfo = $derived(ctx.getEventsWithDayInfo(displayedDate));
  const dateLabel = $derived(formatDateFull(displayedDate, ctx.locale));
  const dayKey = $derived(dateKey(displayedDate));

  // Separate all-day vs timed events for time grid mode
  const allDayEvents = $derived(
    ctx.showTimeGrid ? eventsWithInfo.filter((info) => info.event.allDay !== false) : []
  );
  const timedEventCount = $derived(
    ctx.showTimeGrid ? eventsWithInfo.filter((info) => info.event.allDay === false).length : 0
  );
  const totalEventCount = $derived(eventsWithInfo.length);

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
  class={slot('dayView', className)}
  style="overflow: hidden;"
  role="region"
  tabindex={0}
  aria-label={dateLabel}
  onkeydown={handleKeydown}
  {@attach swipeable({
    onSwipeLeft: () => ctx.navigate(1),
    onSwipeRight: () => ctx.navigate(-1),
    enabled: ctx.swipeable
  })}
>
  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key dayKey}
      <div
        in:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
          : { duration: 0 }}
        out:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
          : { duration: 0 }}
      >
        <div class="{slot('dayViewHeader')} flex items-center gap-2">
          {dateLabel}
          {#if totalEventCount > 0}
            <Badge variant="soft" intent="primary" size="xs" counter>
              {totalEventCount}
            </Badge>
          {/if}
        </div>

        {#if ctx.showTimeGrid}
          <!-- Time grid mode -->

          <!-- All-day events -->
          {#if allDayEvents.length > 0}
            <div class={slot('allDayArea')}>
              <div class="flex flex-col gap-1">
                {#each allDayEvents as info (info.event.id)}
                  <CalendarEventRenderer {info} {eventItem} {onEventClick} />
                {/each}
              </div>
            </div>
          {/if}

          <!-- Time grid -->
          <CalendarTimeGrid dates={[displayedDate]} {onEventClick} />

          {#if totalEventCount === 0}
            <div class={slot('empty')}>{bt('calendar.noEvents')}</div>
          {/if}
        {:else}
          <!-- Original list mode -->
          <div class={slot('dayEventList')} aria-live="polite" aria-label={bt('calendar.events')}>
            {#if eventsWithInfo.length === 0}
              <div class={slot('empty')}>{bt('calendar.noEvents')}</div>
            {:else}
              {#each eventsWithInfo as info (info.event.id)}
                <CalendarEventRenderer {info} {eventItem} {onEventClick} />
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>
