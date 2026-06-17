<script lang="ts">
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import type { CalendarEvent } from './calendar.types';

  interface CalendarEventPopoverInternalProps {
    events: CalendarEvent[];
    onEventClick?: (event: CalendarEvent) => void;
  }

  let { events, onEventClick }: CalendarEventPopoverInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);
</script>

<div class={slot('eventPopover')}>
  {#each events as event (event.id)}
    {@const category = event.categoryId ? ctx.getCategoryById(event.categoryId) : undefined}
    <button
      type="button"
      class={slot('eventPopoverItem')}
      onclick={(e) => {
        e.stopPropagation();
        onEventClick?.(event);
      }}
    >
      <span
        class="size-2 shrink-0 rounded-full"
        style={category?.color
          ? `background-color: ${category.color}`
          : 'background-color: var(--color-text-tertiary)'}
      ></span>
      <span class="text-text-primary truncate font-medium">{event.title}</span>
      {#if event.description}
        <span class="text-text-secondary ml-auto truncate">{event.description}</span>
      {/if}
    </button>
  {/each}
</div>
