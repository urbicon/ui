<script lang="ts">
  import { formatDateRange } from '#lib/date/index.js';
  import { createSlotHelper, getCalendarContext } from './calendar.context';
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

  // The dates are in the name because the column is not: Chromium's
  // accessibility tree places a cell by DOM order and ignores aria-colindex and
  // aria-colspan, so a bar's cell reports neither its days nor their headers.
  const label = $derived(
    `${event.title}, ${formatDateRange(event.start, event.end ?? event.start, ctx.locale)}`
  );
  // `title` stays only on the first segment, as the tooltip for its truncated
  // text. A continuation segment shows no text, and with the name already set
  // VoiceOver reads its title as a redundant hint.

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
    title={isFirstSegment ? event.title : undefined}
    aria-label={label}
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
    title={isFirstSegment ? event.title : undefined}
    aria-label={label}
  >
    {#if isFirstSegment}
      <span class="truncate">{event.title}</span>
    {/if}
  </div>
{/if}
