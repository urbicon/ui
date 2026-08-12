<script lang="ts">
  import { useBlocksI18n } from '$lib';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import {
    getMonthGrid,
    getWeekdayNames,
    formatMonthYear,
    formatDateFull,
    isSameDay
  } from '$lib/date';

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
    if (ctx.view === 'week' || ctx.view === 'day') {
      // selectDate only updates the selection — it never moves the reference
      // date, so jump the week/day grid to the clicked day explicitly.
      ctx.goToDate(date);
    } else if (date.getMonth() !== ctx.displayedMonth || date.getFullYear() !== ctx.displayedYear) {
      // Month-based views (month handled its own spill-jump in selectDate;
      // agenda lands here) only need to sync to the clicked day's month.
      ctx.goToMonth(date.getMonth(), date.getFullYear());
    }
  }

  // Keyboard navigation for mini calendar grid
  let focusedMiniDate = $state<Date | null>(null);

  function handleMiniKeydown(e: KeyboardEvent) {
    if (!focusedMiniDate) return;
    // Keyboard-nav local computation — no $state on this Date.

    let newDate: Date | null = null;

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
  <!-- Mini header. Nav buttons render on the internal CoreIconButton (was
       `<Button unstyled mint="none">`); the plumbing/slot split is documented
       on the miniCalendarNavButton slot in calendar.variants.ts. Never
       disabled, so the core's disabled plumbing is inert here. -->
  <div class={slot('miniCalendarHeader')}>
    <CoreIconButton
      class={slot('miniCalendarNavButton')}
      onclick={() => navigateMini(-1)}
      aria-label={bt('calendar.previousMonth')}
    >
      ‹
    </CoreIconButton>
    <span class={slot('miniCalendarTitle')}>{miniTitle}</span>
    <CoreIconButton
      class={slot('miniCalendarNavButton')}
      onclick={() => navigateMini(1)}
      aria-label={bt('calendar.nextMonth')}
    >
      ›
    </CoreIconButton>
  </div>

  <!-- Weekday headers — narrow names duplicate in many locales (de-DE: M, D,
       M, D, F, S, S), so the key needs the column position to stay unique. -->
  <div class="grid grid-cols-7">
    {#each weekdayNames as name, i (`${i}-${name}`)}
      <span class={slot('miniCalendarWeekday')}>{name}</span>
    {/each}
  </div>

  <!-- Day grid -->
  <div class="grid grid-cols-7" role="grid" onkeydown={handleMiniKeydown}>
    {#each miniGrid.flat() as date (date.getTime())}
      {@const inMonth = date.getMonth() === miniMonth}
      {@const isToday = isSameDay(date, ctx.today)}
      {@const markToday = isToday && ctx.highlightToday}
      {@const isSelected = ctx.isDateSelected(date)}
      {@const hasEvents = ctx.getEventsForDate(date).length > 0}
      {@const isMiniFirstDay = isSameDay(date, miniGrid[0][0])}
      {@const isFocusedMini = focusedMiniDate ? isSameDay(date, focusedMiniDate) : false}
      <button
        type="button"
        class="{slot('miniCalendarDay')}
          {!inMonth ? 'opacity-30' : ''}
          {markToday && inMonth ? 'bg-primary text-text-on-primary' : ''}
          {isSelected && !markToday && inMonth
          ? 'bg-primary-subtle text-primary-text font-bold'
          : ''}
          {hasEvents && inMonth && !markToday && !isSelected ? 'font-bold' : ''}"
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
        {#if hasEvents && inMonth && !markToday}
          <span class="bg-primary absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full"
          ></span>
        {/if}
      </button>
    {/each}
  </div>
</div>
