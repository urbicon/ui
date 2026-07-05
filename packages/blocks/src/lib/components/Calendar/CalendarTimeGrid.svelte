<script lang="ts">
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { isSameDay, toIso } from '$lib/date';
  import { generateTimeSlots, positionEvents } from './calendar.engine';
  import type { CalendarEvent, PositionedEvent } from './calendar.types';
  import CalendarTimeEvent from './CalendarTimeEvent.svelte';

  interface CalendarTimeGridInternalProps {
    dates: Date[];
    onEventClick?: (event: CalendarEvent) => void;
    class?: string;
  }

  let { dates, onEventClick, class: className = '' }: CalendarTimeGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  // Slot height in px — consistent per-hour height across intervals
  const hourHeight = $derived(ctx.size === 'sm' ? 40 : ctx.size === 'lg' ? 64 : 48);
  const slotHeight = $derived(ctx.timeGridInterval === 30 ? hourHeight / 2 : hourHeight);
  const timeSlots = $derived(
    generateTimeSlots(ctx.timeGridStartHour, ctx.timeGridEndHour, ctx.timeGridInterval)
  );
  const totalHeight = $derived(timeSlots.length * slotHeight);

  // Position timed events per date column
  const positionedByDate = $derived.by(() => {
    // Local computation inside $derived — the returned Map is read-only
    // downstream, so SvelteMap's reactive wrapping is unnecessary.
    const map = new Map<string, PositionedEvent[]>();
    for (const date of dates) {
      const key = toIso(date);
      const dayEvents = ctx.getEventsForDate(date).filter((e) => e.allDay === false);
      map.set(key, positionEvents(dayEvents, date, ctx.timeGridStartHour, ctx.timeGridEndHour));
    }
    return map;
  });

  // Current time indicator (updates every minute)
  let currentTime = $state(new Date());

  $effect(() => {
    const id = setInterval(() => {
      currentTime = new Date();
    }, 60_000);
    return () => clearInterval(id);
  });

  const currentTimePercent = $derived.by(() => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const gridStart = ctx.timeGridStartHour * 60;
    const gridEnd = ctx.timeGridEndHour * 60;
    if (minutes < gridStart || minutes > gridEnd) return null;
    return ((minutes - gridStart) / (gridEnd - gridStart)) * 100;
  });

  let gridEl: HTMLDivElement | undefined = $state();

  // Auto-scroll to current time on mount (only once)
  let hasAutoScrolled = false;
  $effect(() => {
    if (!gridEl || currentTimePercent === null || hasAutoScrolled) return;
    const scrollTo = (currentTimePercent / 100) * totalHeight - gridEl.clientHeight / 3;
    gridEl.scrollTop = Math.max(0, scrollTo);
    hasAutoScrolled = true;
  });

  const canCreate = $derived(!!ctx.onTimeSlotCreate);

  function handleSlotClick(date: Date, slotHour: number, slotMinute: number) {
    if (!ctx.onTimeSlotCreate) return;
    // Local Date math handed straight to a callback — not reactive state.
    const start = new Date(date);
    start.setHours(slotHour, slotMinute, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    ctx.onTimeSlotCreate(start, end);
  }
</script>

<div bind:this={gridEl} class={slot('timeGrid', className)}>
  <div class="flex" style="min-height: {totalHeight}px;">
    <!-- Time labels column -->
    <div class="flex shrink-0 flex-col">
      {#each timeSlots as ts (ts.hour * 60 + ts.minute)}
        <div class={slot('timeLabel')} style="height: {slotHeight}px;">
          {ts.label}
        </div>
      {/each}
    </div>

    <!-- Day columns -->
    <div class="flex flex-1">
      {#each dates as date (date.getTime())}
        {@const key = toIso(date)}
        {@const positioned = positionedByDate.get(key) ?? []}
        {@const isToday = isSameDay(date, ctx.today)}

        <div class={slot('timeDayColumn')}>
          <!-- Slot divider lines -->
          {#each timeSlots as ts (ts.hour * 60 + ts.minute)}
            {#if canCreate}
              <button
                type="button"
                class="{slot(
                  'timeSlotRow'
                )} hover:bg-primary-subtle/30 w-full cursor-cell text-left transition-colors"
                style="height: {slotHeight}px;"
                tabindex={-1}
                aria-label={ts.label}
                onclick={() => handleSlotClick(date, ts.hour, ts.minute)}
              ></button>
            {:else}
              <div class={slot('timeSlotRow')} style="height: {slotHeight}px;"></div>
            {/if}
          {/each}

          <!-- Positioned events -->
          {#each positioned as pos (pos.event.id)}
            {@const category = pos.event.categoryId
              ? ctx.getCategoryById(pos.event.categoryId)
              : undefined}
            <CalendarTimeEvent
              event={pos.event}
              {category}
              top={pos.top}
              height={pos.height}
              column={pos.column}
              totalColumns={pos.totalColumns}
              {onEventClick}
            />
          {/each}

          <!-- Current time line -->
          {#if isToday && currentTimePercent !== null}
            <div class={slot('currentTimeLine')} style="top: {currentTimePercent}%;">
              <div class="absolute -top-1 -left-1 size-2 rounded-full bg-red-500"></div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
