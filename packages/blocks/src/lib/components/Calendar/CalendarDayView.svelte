<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { fly } from 'svelte/transition';
  import { Badge } from '$lib/primitives/Badge';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { formatDateFull, toIso } from '$lib/date';
  import { swipeable } from '$lib/utils/swipeable';
  import type { CalendarEvent } from './calendar.types';
  import CalendarEventRenderer from './CalendarEventRenderer.svelte';
  import CalendarTimeGrid from './CalendarTimeGrid.svelte';

  const bt = useBlocksI18n();

  interface CalendarDayViewInternalProps {
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { onEventClick, class: className = '' }: CalendarDayViewInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const displayedDate = $derived(ctx.displayedDate);
  const eventsWithInfo = $derived(ctx.getEventsWithDayInfo(displayedDate));
  const dateLabel = $derived(formatDateFull(displayedDate, ctx.locale));
  const dayKey = $derived(toIso(displayedDate));

  // The day view always renders as an hour grid (showTimeGrid is always true
  // for day). All-day events show in a band above the grid; timed events flow
  // through CalendarTimeGrid — no custom `eventItem` here, matching WeekGrid.
  const allDayEvents = $derived(eventsWithInfo.filter((info) => info.event.allDay !== false));
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

        <!-- All-day events -->
        {#if allDayEvents.length > 0}
          <div class={slot('allDayArea')}>
            <div class="flex flex-col gap-1">
              {#each allDayEvents as info (info.event.id)}
                <CalendarEventRenderer {info} {onEventClick} />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Time grid -->
        <CalendarTimeGrid dates={[displayedDate]} {onEventClick} />

        {#if totalEventCount === 0}
          <div class={slot('empty')}>{bt('calendar.noEvents')}</div>
        {/if}
      </div>
    {/key}
  </div>
</div>
