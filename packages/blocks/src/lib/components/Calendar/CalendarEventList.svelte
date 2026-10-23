<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useBlocksI18n } from '#lib';
  import { formatDate } from '#lib/date/index.js';
  import { Button } from '#lib/primitives/Button/index.js';
  import CalendarEventRenderer from './CalendarEventRenderer.svelte';
  import { createSlotHelper, getCalendarContext } from './calendar.context';
  import type { CalendarEvent, EventItemContext } from './calendar.types';

  const bt = useBlocksI18n();

  interface CalendarEventListInternalProps {
    eventItem?: Snippet<[EventItemContext]>;
    onEventClick?: (event: CalendarEvent) => void;
    maxVisible?: number;
    class?: string;
  }

  let {
    eventItem,
    onEventClick,
    maxVisible,
    class: className = ''
  }: CalendarEventListInternalProps = $props();

  const ctx = getCalendarContext();

  const selectedDate = $derived(ctx.selectedDate);
  const eventsWithInfo = $derived(selectedDate ? ctx.getEventsWithDayInfo(selectedDate) : []);
  const dateLabel = $derived(selectedDate ? formatDate(selectedDate, ctx.locale) : '');

  const visibleEvents = $derived(
    maxVisible && maxVisible < eventsWithInfo.length
      ? eventsWithInfo.slice(0, maxVisible)
      : eventsWithInfo
  );
  const hiddenCount = $derived(
    maxVisible && maxVisible < eventsWithInfo.length ? eventsWithInfo.length - maxVisible : 0
  );

  let showAll = $state(false);
  const displayedEvents = $derived(showAll ? eventsWithInfo : visibleEvents);

  const slot = createSlotHelper(ctx);
</script>

{#if selectedDate}
  <!-- biome-ignore lint/a11y/useSemanticElements: a fieldset would add its UA border, padding and min-inline-size for the same group role and name -->
  <div
    class={slot('list', className)}
    role="group"
    aria-live="polite"
    aria-label={bt('calendar.events')}
  >
    <div class={slot('dateHeader')}>{dateLabel}</div>

    {#if eventsWithInfo.length === 0}
      <div class={slot('empty')}>{bt('calendar.noEvents')}</div>
    {:else}
      {#each displayedEvents as info (info.event.id)}
        <CalendarEventRenderer {info} {eventItem} {onEventClick} />
      {/each}

      {#if hiddenCount > 0 && !showAll}
        <Button
          variant="text"
          intent="primary"
          size="sm"
          mint="none"
          class="w-full"
          onclick={() => (showAll = true)}
        >
          {bt('calendar.showMore', { count: hiddenCount })}
        </Button>
      {/if}
    {/if}
  </div>
{/if}
