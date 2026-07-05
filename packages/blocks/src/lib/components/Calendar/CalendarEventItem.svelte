<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Badge } from '$lib/primitives/Badge';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { draggableEvent } from './calendar.drag';
  import { stripTime } from '$lib/date';
  import type { CalendarEvent, CalendarEventCategory } from './calendar.types';

  const bt = useBlocksI18n();

  interface CalendarEventItemInternalProps {
    event: CalendarEvent;
    category?: CalendarEventCategory;
    onEventClick?: (event: CalendarEvent) => void;
    dayIndex?: number;
    totalDays?: number;
    isStart?: boolean;
    isEnd?: boolean;
    class?: string;
  }

  let {
    event,
    category,
    onEventClick,
    dayIndex,
    totalDays,
    isStart,
    isEnd,
    class: className = ''
  }: CalendarEventItemInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const isClickable = $derived(!!onEventClick);
  const isDraggable = $derived(ctx.draggable);
  const isMultiDay = $derived((totalDays ?? 1) > 1);
  const multiDayLabel = $derived(
    isMultiDay
      ? bt('calendar.multiDayLabel', { current: (dayIndex ?? 0) + 1, total: totalDays ?? 1 })
      : ''
  );

  function handleDragEnd(targetDate: Date | null) {
    if (!targetDate || !ctx.onEventMove) return;
    const eventDuration = event.end ? event.end.getTime() - event.start.getTime() : 0;
    // Local computation — Date mutation is confined to this scope, not $state.
    const newStart = new Date(targetDate);
    newStart.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds());
    const newEnd =
      eventDuration > 0 ? new Date(newStart.getTime() + eventDuration) : new Date(newStart);
    ctx.onEventMove(event, newStart, newEnd);
  }
</script>

{#snippet eventContent()}
  <div
    class={slot('colorBar')}
    style={category?.color
      ? `background-color: ${category.color}`
      : 'background-color: var(--color-border-default)'}
    aria-hidden="true"
  ></div>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5">
      {#if event.recurrence}
        <span
          class="text-text-tertiary shrink-0"
          aria-label={bt('calendar.recurring')}
          title={bt('calendar.recurring')}>↻</span
        >
      {/if}
      <span class={slot('eventTitle')}>{event.title}</span>
      {#if isMultiDay}
        <Badge variant="soft" intent="secondary" size="xs">
          {multiDayLabel}
        </Badge>
      {/if}
    </div>
    {#if event.description}
      <div class={slot('eventDescription')}>{event.description}</div>
    {/if}
    {#if event.helperText}
      <div class={slot('eventHelper')}>{event.helperText}</div>
    {/if}
  </div>
{/snippet}

{#if isClickable}
  <button
    type="button"
    class="{slot('item', className)} w-full appearance-none text-left {isDraggable
      ? 'cursor-grab'
      : ''}"
    aria-label={event.title}
    onclick={() => onEventClick?.(event)}
    {@attach draggableEvent({ event, disabled: !isDraggable, onDragEnd: handleDragEnd })}
  >
    {@render eventContent()}
  </button>
{:else}
  <div class={slot('item', className)}>
    {@render eventContent()}
  </div>
{/if}
