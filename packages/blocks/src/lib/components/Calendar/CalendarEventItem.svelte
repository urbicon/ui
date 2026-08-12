<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Badge } from '$lib/primitives/Badge';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { draggableEvent } from './calendar.drag';
  import { formatTimeRange, toIsoDateTime } from '$lib/date';
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

  // `allDay` defaults to `true`, so only an explicit `false` states that this
  // event happens AT a time — the same test the time grid and the all-day band
  // use. An all-day event gets no time line at all; there is none to show.
  //
  // A row of a multi-day event shows the half of the span that is true for THIS
  // day: the start on its first day, "until 17:00" on its last. `event.start` is
  // the same instant on every day the event spans, so printing it unqualified on
  // day 2 of 3 would claim the event starts this morning — and the end time,
  // which is the only clock statement the last day can make, would otherwise
  // appear on no day at all (`formatTimeRange` drops an `end` that is not on the
  // start's calendar day, or the row would carry both full dates). A middle day
  // has no time to state and shows none; the "Day 2 of 3" badge carries it.
  // Without dayIndex/totalDays the item stands alone — the single-day case.
  const eventTime = $derived.by(() => {
    if (event.allDay !== false) return null;
    if (!isMultiDay || isStart === true) {
      return { at: event.start, text: formatTimeRange(event.start, event.end, ctx.locale) };
    }
    if (isEnd === true && event.end) {
      return {
        at: event.end,
        text: bt('calendar.untilTime', { time: formatTimeRange(event.end, undefined, ctx.locale) })
      };
    }
    return null;
  });

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
      {#if eventTime}
        <!-- `datetime` carries the very instant the text states — the start on a
             start row, the end on an end row — so the machine-readable value and
             the rendered one can never disagree. -->
        <time class={slot('eventTime')} datetime={toIsoDateTime(eventTime.at)}
          >{eventTime.text}</time
        >
      {/if}
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
  <!-- No `aria-label`: it would REPLACE the row's content as the accessible
       name, and everything this row renders is real text a listener wants —
       the clock time, the "Day 2 of 3" badge, the description, the helper. The
       label held only the title until #95, so the other four were already
       inaudible; naming the button from its own content is what keeps a second
       copy from going stale the next time the row grows a line. The only
       non-text child, the category colour bar, is `aria-hidden`. -->
  <button
    type="button"
    class="{slot('item', className)} w-full appearance-none text-left {isDraggable
      ? 'cursor-grab'
      : ''}"
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
