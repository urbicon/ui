<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import { Popover } from '$lib/primitives/Popover';
  import { getCalendarContext } from './calendar.context';
  import { calendarVariants } from './calendar.variants';
  import { isSameDay, formatDateFull } from '$lib/date';
  import type { CalendarEvent, DayCellContext } from './calendar.types';
  import CalendarEventPopover from './CalendarEventPopover.svelte';

  interface CalendarDayInternalProps {
    date: Date;
    dayCell?: Snippet<[DayCellContext]>;
    onEventClick?: (event: CalendarEvent) => void;
  }

  let { date, dayCell, onEventClick }: CalendarDayInternalProps = $props();

  const ctx = getCalendarContext();

  const isToday = $derived(ctx.isDateToday(date));
  const isSelected = $derived(ctx.isDateSelected(date));
  const isDisabled = $derived(ctx.isDateDisabled(date));
  const isOutsideMonth = $derived(!ctx.isDateInMonth(date));
  const isInRange = $derived(ctx.isDateInRange(date));
  const isRangeStart = $derived(ctx.isDateRangeStart(date));
  const isRangeEnd = $derived(ctx.isDateRangeEnd(date));
  const isInPreviewRange = $derived(ctx.isDateInPreviewRange(date));
  const isPreviewRangeEnd = $derived(
    ctx.hoveredDate != null && isInPreviewRange && isSameDay(date, ctx.hoveredDate)
  );
  const isFocused = $derived(isSameDay(date, ctx.focusedDate));
  const events = $derived(ctx.getEventsForDate(date));
  const hasEvents = $derived(events.length > 0);

  // `highlightToday={false}` drops out of the *visual* ladder only: a today cell
  // then styles as whatever it would be without today (selected, or default), so
  // a selected today keeps its selection ring instead of falling through to
  // nothing. `data-state` follows the ladder because it mirrors the applied
  // style. The `aria-current="date"` in the markup keeps using the raw `isToday`
  // on purpose — highlightToday is a visual preference, and a screen-reader user
  // must not lose the date pointer because the consumer only wanted the colour
  // gone. Same rule in the four other views.
  const markToday = $derived(isToday && ctx.highlightToday);

  const dayState = $derived.by(() => {
    if (isDisabled) return 'disabled' as const;
    if (isOutsideMonth) return 'outsideMonth' as const;
    if (isRangeStart) return 'rangeStart' as const;
    if (isRangeEnd) return 'rangeEnd' as const;
    if (isInRange) return 'inRange' as const;
    if (isPreviewRangeEnd) return 'previewRangeEnd' as const;
    if (isInPreviewRange) return 'previewRange' as const;
    if (markToday && isSelected) return 'todaySelected' as const;
    if (isSelected) return 'selected' as const;
    if (markToday) return 'today' as const;
    return 'default' as const;
  });

  // Compute per-cell styles via tv() with dayState and hasEvents variants
  const dayStyles = $derived(
    calendarVariants({ variant: ctx.variant, size: ctx.size, dayState, hasEvents })
  );

  const ariaLabel = $derived(formatDateFull(date, ctx.locale));
  const maxDots = 3;
  const visibleDots = $derived(events.slice(0, maxDots));

  // Native tooltip for days with events
  const eventTooltip = $derived.by(() => {
    if (!hasEvents || isOutsideMonth) return undefined;
    const maxShow = 3;
    const titles = events.slice(0, maxShow).map((e) => e.title);
    if (events.length > maxShow) titles.push(`+${events.length - maxShow}`);
    return titles.join('\n');
  });

  function daySlot(key: string, extra?: string) {
    const slotKey = key as keyof typeof ctx.slotClasses;
    const overrides = [ctx.slotClasses?.[slotKey], extra].filter(Boolean).join(' ');
    if (ctx.unstyled) return overrides;
    return (
      (dayStyles as Record<string, (opts: { class: string }) => string>)[key]?.({
        class: overrides
      }) ?? overrides
    );
  }

  // --- Event popover state ---
  const showPopoverEnabled = $derived(ctx.eventPopover && hasEvents && !isOutsideMonth);
  let buttonEl: HTMLButtonElement | undefined = $state();
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

  function handleClick() {
    ctx.selectDate(date);
  }

  function handleDblClick() {
    if (isDisabled) return;
    ctx.onDateCreate?.(date, ctx.view);
  }

  function handleMouseEnter() {
    ctx.setHoveredDate(date);
    if (showPopoverEnabled) openPopover();
  }

  function handleMouseLeave() {
    if (showPopoverEnabled) scheduleClosePopover();
  }

  function handleFocus() {
    ctx.setFocusedDate(date);
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
</script>

{#if dayCell}
  {@render dayCell({
    date,
    events,
    isToday,
    isSelected,
    isDisabled,
    isOutsideMonth,
    isFocused
  })}
{:else if isOutsideMonth && !ctx.showOutsideDays}
  <div class={daySlot('day')} role="gridcell" aria-hidden="true"></div>
{:else}
  <button
    bind:this={buttonEl}
    type="button"
    class={daySlot('day')}
    role="gridcell"
    tabindex={isFocused ? 0 : -1}
    aria-label={ariaLabel}
    aria-selected={isSelected || undefined}
    aria-disabled={isDisabled || undefined}
    aria-current={isToday ? 'date' : undefined}
    data-state={dayState}
    data-date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
    data-drop-target={ctx.draggable ? '' : undefined}
    title={showPopoverEnabled ? undefined : eventTooltip}
    disabled={isDisabled}
    onclick={handleClick}
    ondblclick={handleDblClick}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    onfocus={handleFocus}
    onblur={handleBlur}
  >
    <span class={daySlot('dayNumber')}>
      {date.getDate()}
    </span>
    {#if hasEvents && dayState !== 'outsideMonth'}
      <div class={daySlot('dotContainer')}>
        {#each visibleDots as event (event.id)}
          {@const category = event.categoryId ? ctx.getCategoryById(event.categoryId) : undefined}
          <span
            class={daySlot('dot')}
            style={category?.color
              ? `background-color: ${category.color}`
              : 'background-color: var(--color-text-tertiary)'}
          ></span>
        {/each}
      </div>
    {/if}
  </button>

  {#if showPopoverEnabled && popoverOpen && buttonEl}
    <Popover
      triggerElement={buttonEl}
      bind:open={popoverOpen}
      autoTrigger={false}
      placement="top"
      offsetDistance={8}
      size="sm"
      onmouseenter={cancelClosePopover}
      onmouseleave={scheduleClosePopover}
    >
      <CalendarEventPopover {events} {onEventClick} />
    </Popover>
  {/if}
{/if}
