<script lang="ts">
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getContrastTextColor } from './calendar.engine';
  import type { CalendarEvent } from './calendar.types';

  interface CalendarMultiDayBarProps {
    event: CalendarEvent;
    /** 0-based grid column, the week-number column included when shown. */
    startCol: number;
    spanCols: number;
    isFirstSegment: boolean;
    isLastSegment: boolean;
    onEventClick?: (event: CalendarEvent) => void;
  }

  let {
    event,
    startCol,
    spanCols,
    isFirstSegment,
    isLastSegment,
    onEventClick
  }: CalendarMultiDayBarProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const category = $derived(event.categoryId ? ctx.getCategoryById(event.categoryId) : undefined);

  const bgColor = $derived(category?.color ?? 'var(--color-primary)');

  // A consumer colour needs its label picked; the library's own primary fill
  // has a paired ink already, and it is mode-aware where white is not (white on
  // the dark-mode primary misses AA).
  const textColor = $derived(
    category?.color ? getContrastTextColor(category.color) : 'var(--color-text-on-primary)'
  );

  const roundedClasses = $derived(
    [
      isFirstSegment ? 'rounded-l-md' : 'rounded-l-none',
      isLastSegment ? 'rounded-r-md' : 'rounded-r-none'
    ].join(' ')
  );

  const barHeight = $derived(ctx.size === 'sm' ? 16 : ctx.size === 'lg' ? 24 : 20);
  const barGap = 2;
</script>

<!-- Each bar is a gridcell of its stacking line's row (CalendarGrid), spanning
     the day columns it covers. -->
{#if onEventClick}
  <!-- The pointer goes on this branch, not the slot: the slot also styles the passive <div>. -->
  <button
    type="button"
    role="gridcell"
    aria-colindex={startCol + 1}
    aria-colspan={spanCols}
    class="{slot('multiDayBar')} {roundedClasses} cursor-pointer"
    style="
      grid-column: {startCol + 1} / span {spanCols};
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
    role="gridcell"
    aria-colindex={startCol + 1}
    aria-colspan={spanCols}
    class="{slot('multiDayBar')} {roundedClasses}"
    style="
      grid-column: {startCol + 1} / span {spanCols};
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
