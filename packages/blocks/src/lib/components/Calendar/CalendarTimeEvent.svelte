<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Popover } from '$lib/primitives/Popover';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { draggableEvent, resizableEvent } from './calendar.drag';
  import { getContrastTextColor } from './calendar.engine';
  import type { CalendarEvent, DateCategory } from './calendar.types';
  import CalendarEventPopover from './CalendarEventPopover.svelte';

  interface CalendarTimeEventInternalProps {
    event: CalendarEvent;
    category?: DateCategory;
    top: number;
    height: number;
    column: number;
    totalColumns: number;
    onEventClick?: (event: CalendarEvent) => void;
  }

  let {
    event,
    category,
    top,
    height,
    column,
    totalColumns,
    onEventClick
  }: CalendarTimeEventInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const bgColor = $derived(category?.color ?? 'oklch(0.65 0.15 250)');
  const textColor = $derived(getContrastTextColor(bgColor));
  const widthPercent = $derived(100 / totalColumns);
  const leftPercent = $derived(column * widthPercent);
  // Overlap order, capped below the current-time line (z-10) and the pinned
  // head strip (z-30…50) — the day column opens no stacking context, so an
  // uncapped column index would eventually paint an event over the weekday
  // buttons. Past the cap the ties resolve by DOM order, which is the same
  // later-column-on-top the index expressed.
  const stackIndex = $derived(Math.min(column + 1, 9));
  const isDraggable = $derived(ctx.draggable);
  const isResizable = $derived(ctx.resizable);

  let eventEl: HTMLButtonElement | undefined = $state();

  // --- Event popover state ---
  const showPopoverEnabled = $derived(ctx.eventPopover);
  let popoverOpen = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function openPopover() {
    clearTimeout(closeTimer);
    hoverTimer = setTimeout(() => {
      popoverOpen = true;
    }, 300);
  }

  function scheduleClosePopover() {
    clearTimeout(hoverTimer);
    closeTimer = setTimeout(() => {
      popoverOpen = false;
    }, 150);
  }

  function cancelClosePopover() {
    clearTimeout(closeTimer);
  }

  function handleMouseEnter() {
    if (showPopoverEnabled) openPopover();
  }

  function handleMouseLeave() {
    if (showPopoverEnabled) scheduleClosePopover();
  }

  function handleFocus() {
    if (showPopoverEnabled) {
      clearTimeout(closeTimer);
      popoverOpen = true;
    }
  }

  function handleBlur() {
    if (showPopoverEnabled) scheduleClosePopover();
  }

  onDestroy(() => {
    clearTimeout(hoverTimer);
    clearTimeout(closeTimer);
  });

  function handleDragEnd(targetDate: Date | null) {
    if (!targetDate || !ctx.onEventMove) return;
    const eventDuration = event.end ? event.end.getTime() - event.start.getTime() : 60 * 60 * 1000;
    const newStart = new Date(targetDate);
    newStart.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds());
    const newEnd = new Date(newStart.getTime() + eventDuration);
    ctx.onEventMove(event, newStart, newEnd);
  }

  function handleResizeEnd(ev: CalendarEvent, newEnd: Date) {
    ctx.onEventResize?.(ev, newEnd);
  }

  // The box the resize maps pixels to minutes against: the day column this event
  // is positioned in, whose top edge IS `timeGridStartHour` and whose height is
  // the whole day. Not the scroll port — that used to be found by sniffing for
  // the nearest scrollable ancestor, and since #96 the nearest one is a grid
  // that also carries the week's pinned head/all-day strip above the hours, so
  // both the offset and the denominator were wrong: an event dragged to end at
  // 12:00 committed as 13:00 at the md defaults (calendar.drag.test.ts pins the
  // arithmetic for both views). The sniffing had a second, silent failure too —
  // its `[class*="overflow-y"]` fallback stopped matching when the slot became
  // `overflow-auto`. `parentElement` is the same element by construction; the
  // attribute says so out loud and survives a wrapper.
  function getDayColumnEl(): HTMLElement | null {
    return eventEl?.closest<HTMLElement>('[data-day-column]') ?? eventEl?.parentElement ?? null;
  }
</script>

<button
  bind:this={eventEl}
  type="button"
  class="{slot('timeEvent')} {isDraggable ? 'cursor-grab' : onEventClick ? 'cursor-pointer' : ''}"
  style="
    top: {top}%;
    height: {height}%;
    left: {leftPercent}%;
    width: calc({widthPercent}% - 2px);
    background-color: {bgColor};
    color: {textColor};
    z-index: {stackIndex};
  "
  title={showPopoverEnabled ? undefined : event.title}
  onclick={() => onEventClick?.(event)}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onfocus={handleFocus}
  onblur={handleBlur}
  {@attach draggableEvent({ event, disabled: !isDraggable, onDragEnd: handleDragEnd })}
>
  <span class="block truncate font-medium">{event.title}</span>
  {#if event.description && height > 5}
    <span class="block truncate opacity-80">{event.description}</span>
  {/if}

  {#if isResizable && eventEl}
    <div
      class="absolute right-0 bottom-0 left-0 h-1.5 cursor-row-resize rounded-b-md hover:bg-white/30"
      {@attach resizableEvent({
        event,
        dayColumnEl: getDayColumnEl() ?? eventEl.parentElement!,
        eventEl,
        startHour: ctx.timeGridStartHour,
        endHour: ctx.timeGridEndHour,
        disabled: !isResizable,
        onResizeEnd: handleResizeEnd
      })}
    ></div>
  {/if}
</button>

{#if showPopoverEnabled && popoverOpen && eventEl}
  <Popover
    triggerElement={eventEl}
    bind:open={popoverOpen}
    autoTrigger={false}
    placement="top"
    offsetDistance={8}
    size="sm"
    onmouseenter={cancelClosePopover}
    onmouseleave={scheduleClosePopover}
  >
    <CalendarEventPopover events={[event]} {onEventClick} />
  </Popover>
{/if}
