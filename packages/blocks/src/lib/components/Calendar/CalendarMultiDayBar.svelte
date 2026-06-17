<script lang="ts">
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getContrastTextColor } from './calendar.engine';
  import type { CalendarEvent } from './calendar.types';

  interface CalendarMultiDayBarProps {
    event: CalendarEvent;
    startCol: number;
    spanCols: number;
    isFirstSegment: boolean;
    isLastSegment: boolean;
    row: number;
    onEventClick?: (event: CalendarEvent) => void;
  }

  let {
    event,
    startCol,
    spanCols,
    isFirstSegment,
    isLastSegment,
    row,
    onEventClick
  }: CalendarMultiDayBarProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const category = $derived(event.categoryId ? ctx.getCategoryById(event.categoryId) : undefined);

  const bgColor = $derived(category?.color ?? 'var(--color-primary)');

  const textColor = $derived(getContrastTextColor(bgColor));

  const roundedClasses = $derived(
    [
      isFirstSegment ? 'rounded-l-md' : 'rounded-l-none',
      isLastSegment ? 'rounded-r-md' : 'rounded-r-none'
    ].join(' ')
  );

  const barHeight = $derived(ctx.size === 'sm' ? 16 : ctx.size === 'lg' ? 24 : 20);
  const barGap = 2;
</script>

{#if onEventClick}
  <button
    type="button"
    class="{slot('multiDayBar')} {roundedClasses}"
    style="
      grid-column: {startCol + 1} / span {spanCols};
      grid-row: {row + 1};
      background-color: {bgColor};
      color: {textColor};
      height: {barHeight}px;
      margin-bottom: {barGap}px;
    "
    title={event.title}
    aria-label={event.title}
    onclick={() => onEventClick?.(event)}
  >
    {#if isFirstSegment}
      <span class="truncate">{event.title}</span>
    {/if}
  </button>
{:else}
  <div
    class="{slot('multiDayBar')} {roundedClasses}"
    style="
      grid-column: {startCol + 1} / span {spanCols};
      grid-row: {row + 1};
      background-color: {bgColor};
      color: {textColor};
      height: {barHeight}px;
      margin-bottom: {barGap}px;
    "
    title={event.title}
  >
    {#if isFirstSegment}
      <span class="truncate">{event.title}</span>
    {/if}
  </div>
{/if}
