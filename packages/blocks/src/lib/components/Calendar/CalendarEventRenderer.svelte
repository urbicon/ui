<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getCalendarContext } from './calendar.context';
  import type { CalendarEvent, EventDayInfo, EventItemContext } from './calendar.types';
  import CalendarEventItem from './CalendarEventItem.svelte';

  interface CalendarEventRendererInternalProps {
    info: EventDayInfo;
    eventItem?: Snippet<[EventItemContext]>;
    onEventClick?: (event: CalendarEvent) => void;
  }

  let { info, eventItem, onEventClick }: CalendarEventRendererInternalProps = $props();

  const ctx = getCalendarContext();

  const category = $derived(
    info.event.categoryId ? ctx.getCategoryById(info.event.categoryId) : undefined
  );

  const context: EventItemContext = $derived({
    event: info.event,
    category,
    dayIndex: info.totalDays > 1 ? info.dayIndex : undefined,
    totalDays: info.totalDays > 1 ? info.totalDays : undefined,
    isStart: info.totalDays > 1 ? info.isStart : undefined,
    isEnd: info.totalDays > 1 ? info.isEnd : undefined
  });
</script>

{#if eventItem}
  {@render eventItem(context)}
{:else}
  <CalendarEventItem
    event={info.event}
    {category}
    dayIndex={context.dayIndex}
    totalDays={context.totalDays}
    isStart={context.isStart}
    isEnd={context.isEnd}
    {onEventClick}
  />
{/if}
