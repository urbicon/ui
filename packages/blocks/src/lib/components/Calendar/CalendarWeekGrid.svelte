<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getWeekdayNames, isSameDay, toIso } from '$lib/date';
  import { getContrastTextColor } from './calendar.engine';
  import { swipeable } from '$lib/utils/swipeable';
  import type { CalendarEvent } from './calendar.types';
  import CalendarTimeGrid from './CalendarTimeGrid.svelte';

  const bt = useBlocksI18n();

  // No custom `eventItem` reaches this view: it renders no event snippet of its
  // own, and hands the all-day band to CalendarTimeGrid, which pins it in its
  // own header.
  interface CalendarWeekGridInternalProps {
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { onEventClick, class: className = '' }: CalendarWeekGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const weekdayNames = $derived(getWeekdayNames(ctx.locale, ctx.weekStartsOn, 'short'));
  const weekKey = $derived(toIso(ctx.weekDates[0]));

  // All-day events per date, drawn in the band above the hour grid.
  const allDayByDate = $derived.by(() => {
    const map = new Map<string, Array<{ event: CalendarEvent; color: string }>>();
    for (const date of ctx.weekDates) {
      const key = toIso(date);
      const allDay = ctx
        .getEventsForDate(date)
        .filter((e) => e.allDay !== false)
        .map((e) => ({
          event: e,
          color: e.categoryId
            ? (ctx.getCategoryById(e.categoryId)?.color ?? 'oklch(0.65 0.15 250)')
            : 'oklch(0.65 0.15 250)'
        }));
      if (allDay.length > 0) map.set(key, allDay);
    }
    return map;
  });

  const hasAnyAllDay = $derived(allDayByDate.size > 0);

  // Who owns a horizontal finger drag: the hour grid's scroller while the seven
  // columns overflow it, this layout's swipe while they fit. Measured by the
  // grid (below) rather than assumed, because passing the axis to the scroller
  // unconditionally gives the swipe up at every width — Chromium fires
  // `pointercancel` on a horizontal drag whenever `touch-action` is left at
  // `auto`, whether or not anything can scroll (the measurement is in
  // `swipeable`'s `touchAction` doc).
  let daysOverflow = $state(false);

  function handleDayClick(date: Date) {
    ctx.selectDate(date);
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const headers = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-weekday]')
    );
    const currentIdx = headers.indexOf(target);
    if (currentIdx < 0) return;

    let nextIdx: number;

    switch (e.key) {
      case 'ArrowRight':
        nextIdx = Math.min(currentIdx + 1, headers.length - 1);
        break;
      case 'ArrowLeft':
        nextIdx = Math.max(currentIdx - 1, 0);
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = headers.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (ctx.weekDates[currentIdx]) {
          handleDayClick(ctx.weekDates[currentIdx]);
        }
        return;
      default:
        return;
    }

    if (nextIdx !== currentIdx) {
      e.preventDefault();
      // The day heads live inside the horizontally scrolling grid, so moving the
      // roving focus also brings the day into view — `focus()` scrolls its
      // scroll ports to the element by default. That is the whole reason the
      // heads sit in the grid instead of above it.
      headers[nextIdx]?.focus();
    }
  }
</script>

<div
  class={slot('weekTimeLayout', className)}
  role="grid"
  tabindex={0}
  aria-label={bt('calendar.weekView')}
  onkeydown={handleKeydown}
  style="overflow: hidden;"
  {@attach swipeable({
    // Direction-gated like the header arrows (the DateGridScaffold pattern): a
    // swipe at the bound is inert — no navDirection flip, no clamped no-op emit.
    onSwipeLeft: () => {
      if (ctx.canGoForward) ctx.navigate(1);
    },
    onSwipeRight: () => {
      if (ctx.canGoBack) ctx.navigate(-1);
    },
    enabled: ctx.swipeable && !ctx.disabled,
    // `pan-y` on an ancestor forbids the browser the very pan the hour grid
    // needs once seven columns no longer fit (Blink intersects the property down
    // the tree), so the axis is handed over — but only while there is something
    // to scroll. Giving it up unconditionally would cost the swipe at every
    // width, not just the narrow ones: see `daysOverflow` above.
    touchAction: daysOverflow ? null : 'pan-y'
  })}
>
  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key weekKey}
      <!--
        `min-w-0` is what lets the grid inside scroll instead of being clipped.
        This div is a grid item with visible overflow, so its automatic minimum
        size is the hour grid's min-content width — seven day tracks at their
        minimum. Measured in Chromium against a 360 px card: without it the
        wrapper lays out at 712 px and nothing ever scrolls (clientWidth 712 =
        scrollWidth 712, the layout's `overflow: hidden` swallowing the rest);
        with it, clientWidth 360 against scrollWidth 712. The scroll container
        itself is exempt from the rule (`overflow: auto` ⇒ automatic minimum size
        0) — only this wrapper between it and the layout needs telling.
      -->
      <div
        class="min-w-0"
        in:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
          : { duration: 0 }}
        out:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
          : { duration: 0 }}
      >
        <!-- Heads and all-day band are rendered BY the hour grid, as one pinned
             strip in its top row: it owns the column track list, so this is the
             only way the three stay in one column system while the grid scrolls
             sideways — and being pinned is what keeps the all-day band on screen
             when the grid jumps to the current time on mount. -->
        <CalendarTimeGrid
          dates={ctx.weekDates}
          {onEventClick}
          columnHeader={weekdayHead}
          columnAllDay={hasAnyAllDay ? allDayCell : undefined}
          onHorizontalOverflow={(overflowing) => (daysOverflow = overflowing)}
        />
      </div>
    {/key}
  </div>
</div>

<!-- Day head. `markToday` gates the *look* (this is the full-bleed primary block
     issue #97 was filed over); `aria-current` stays on the raw `isToday` so the
     semantics survive the preference. No width class: the head is the first
     child of its cell's flex column, so stretch alignment already gives it the
     full column — including under `unstyled`, where a hardcoded one would have
     been the single class the consumer could not strip. -->
{#snippet weekdayHead({ date, index }: { date: Date; index: number })}
  {@const isToday = isSameDay(date, ctx.today)}
  {@const markToday = isToday && ctx.highlightToday}
  {@const isSelected = ctx.isDateSelected(date)}
  <button
    type="button"
    class="{slot('weekColumnHeader')} {markToday
      ? 'bg-primary text-text-on-primary'
      : ''} {isSelected && !markToday ? 'bg-primary-subtle' : ''}"
    data-weekday={index}
    onclick={() => handleDayClick(date)}
    tabindex={index === 0 ? 0 : -1}
    aria-label="{weekdayNames[index]} {date.getDate()}"
    aria-current={isToday ? 'date' : undefined}
  >
    <span class="{slot('weekColumnDayName')} {markToday ? 'text-text-on-primary' : ''}">
      {weekdayNames[index]}
    </span>
    <span class="{slot('weekColumnDayNumber')} {markToday ? 'text-text-on-primary' : ''}">
      {date.getDate()}
    </span>
  </button>
{/snippet}

{#snippet allDayCell({ date }: { date: Date; index: number })}
  {@const items = allDayByDate.get(toIso(date)) ?? []}
  <div class="flex min-h-5 flex-col gap-px">
    {#each items as item (item.event.id)}
      <button
        type="button"
        class={slot('weekAllDayEvent')}
        style="background-color: {item.color}; color: {getContrastTextColor(item.color)};"
        onclick={() => onEventClick?.(item.event)}
        title={item.event.title}
      >
        {item.event.title}
      </button>
    {/each}
  </div>
{/snippet}
