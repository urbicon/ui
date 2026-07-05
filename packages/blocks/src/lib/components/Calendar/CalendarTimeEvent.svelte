<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Popover } from '$lib/primitives/Popover';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { draggableEvent, resizableEvent } from './calendar.drag';
  import { getContrastTextColor } from './calendar.engine';
  import type { CalendarEvent, CalendarEventCategory } from './calendar.types';
  import CalendarEventPopover from './CalendarEventPopover.svelte';

  interface CalendarTimeEventInternalProps {
    event: CalendarEvent;
    category?: CalendarEventCategory;
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

  function getGridEl(): HTMLElement | null {
    let el: HTMLElement | null = eventEl ?? null;
    while (el) {
      if (el.scrollHeight > el.clientHeight && el.style.overflowY !== 'hidden') {
        return el;
      }
      el = el.parentElement;
    }
    return eventEl?.closest('[class*="overflow-y"]') ?? null;
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
    z-index: {column + 1};
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
        gridEl: getGridEl() ?? eventEl.parentElement!,
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
