<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Button } from '$lib/primitives/Button';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import {
    getMonthGrid,
    getWeekdayNames,
    formatMonthYear,
    formatDateFull,
    isSameDay
  } from './calendar.engine';

  const bt = useBlocksI18n();

  interface CalendarMiniMonthInternalProps {
    class?: string;
  }

  let { class: className = '' }: CalendarMiniMonthInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  // Own navigation state — starts synced with main calendar
  let miniMonth = $state(ctx.displayedMonth);
  let miniYear = $state(ctx.displayedYear);

  // Sync with main calendar's displayed month/year when they change
  $effect(() => {
    miniMonth = ctx.displayedMonth;
    miniYear = ctx.displayedYear;
  });

  const miniGrid = $derived(getMonthGrid(miniYear, miniMonth, ctx.weekStartsOn));
  const miniTitle = $derived(formatMonthYear(miniYear, miniMonth, ctx.locale));
  const weekdayNames = $derived(getWeekdayNames(ctx.locale, ctx.weekStartsOn, 'narrow'));

  function navigateMini(delta: number) {
    let m = miniMonth + delta;
    let y = miniYear;
    if (m > 11) {
      m = 0;
      y++;
    } else if (m < 0) {
      m = 11;
      y--;
    }
    miniMonth = m;
    miniYear = y;
  }

  function handleDayClick(date: Date) {
    // Navigate main calendar to this date and select it
    ctx.selectDate(date);
    // Also sync view to the clicked day's month
    if (date.getMonth() !== ctx.displayedMonth || date.getFullYear() !== ctx.displayedYear) {
      ctx.goToMonth(date.getMonth(), date.getFullYear());
    }
    // If in week or day view, update displayed date
    if (ctx.view === 'week' || ctx.view === 'day') {
      ctx.navigateDay(0); // triggers a re-render with the newly selected date
    }
  }

  // Keyboard navigation for mini calendar grid
  let focusedMiniDate = $state<Date | null>(null);

  function handleMiniKeydown(e: KeyboardEvent) {
    if (!focusedMiniDate) return;
    // Keyboard-nav local computation — no $state on this Date.

    let newDate: Date | null = null;

    /* eslint-disable svelte/prefer-svelte-reactivity */
    switch (e.key) {
      case 'ArrowRight':
        newDate = new Date(focusedMiniDate);
        newDate.setDate(focusedMiniDate.getDate() + 1);
        break;
      case 'ArrowLeft':
        newDate = new Date(focusedMiniDate);
        newDate.setDate(focusedMiniDate.getDate() - 1);
        break;
      case 'ArrowDown':
        newDate = new Date(focusedMiniDate);
        newDate.setDate(focusedMiniDate.getDate() + 7);
        break;
      case 'ArrowUp':
        newDate = new Date(focusedMiniDate);
        newDate.setDate(focusedMiniDate.getDate() - 7);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleDayClick(focusedMiniDate);
        return;
      default:
        return;
    }
    /* eslint-enable svelte/prefer-svelte-reactivity */

    if (newDate) {
      e.preventDefault();
      focusedMiniDate = newDate;
      // Navigate mini calendar if month changed
      if (newDate.getMonth() !== miniMonth || newDate.getFullYear() !== miniYear) {
        miniMonth = newDate.getMonth();
        miniYear = newDate.getFullYear();
      }
      requestAnimationFrame(() => {
        const dateStr = `${newDate!.getFullYear()}-${String(newDate!.getMonth() + 1).padStart(2, '0')}-${String(newDate!.getDate()).padStart(2, '0')}`;
        const btn = (e.currentTarget as HTMLElement)?.querySelector(
          `[data-mini-date="${dateStr}"]`
        ) as HTMLElement;
        btn?.focus();
      });
    }
  }
</script>

<div class={slot('miniCalendar', className)}>
  <!-- Mini header -->
  <div class={slot('miniCalendarHeader')}>
    <Button
      unstyled
      mint="none"
      class={slot('miniCalendarNavButton')}
      onclick={() => navigateMini(-1)}
      aria-label={bt('calendar.previousMonth')}
    >
      ‹
    </Button>
    <span class={slot('miniCalendarTitle')}>{miniTitle}</span>
    <Button
      unstyled
      mint="none"
      class={slot('miniCalendarNavButton')}
      onclick={() => navigateMini(1)}
      aria-label={bt('calendar.nextMonth')}
    >
      ›
    </Button>
  </div>

  <!-- Weekday headers -->
  <div class="grid grid-cols-7">
    {#each weekdayNames as name (name)}
      <span class={slot('miniCalendarWeekday')}>{name}</span>
    {/each}
  </div>

  <!-- Day grid -->
  <div class="grid grid-cols-7" role="grid" onkeydown={handleMiniKeydown}>
    {#each miniGrid.flat() as date (date.getTime())}
      {@const inMonth = date.getMonth() === miniMonth}
      {@const isToday = isSameDay(date, ctx.today)}
      {@const isSelected = ctx.isDateSelected(date)}
      {@const hasEvents = ctx.getEventsForDate(date).length > 0}
      {@const isMiniFirstDay = isSameDay(date, miniGrid[0][0])}
      {@const isFocusedMini = focusedMiniDate ? isSameDay(date, focusedMiniDate) : false}
      <button
        type="button"
        class="{slot('miniCalendarDay')}
          {!inMonth ? 'opacity-30' : ''}
          {isToday && inMonth ? 'bg-primary text-text-on-primary' : ''}
          {isSelected && !isToday && inMonth ? 'bg-primary-subtle text-primary font-bold' : ''}
          {hasEvents && inMonth && !isToday && !isSelected ? 'font-bold' : ''}"
        tabindex={isFocusedMini || (!focusedMiniDate && isMiniFirstDay) ? 0 : -1}
        role="gridcell"
        aria-label={formatDateFull(date, ctx.locale)}
        aria-selected={isSelected || undefined}
        aria-current={isToday ? 'date' : undefined}
        data-mini-date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
        onclick={() => handleDayClick(date)}
        onfocus={() => {
          focusedMiniDate = date;
        }}
      >
        {date.getDate()}
        {#if hasEvents && inMonth && !isToday}
          <span class="bg-primary absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full"
          ></span>
        {/if}
      </button>
    {/each}
  </div>
</div>
