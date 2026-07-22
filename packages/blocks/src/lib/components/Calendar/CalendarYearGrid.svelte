<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { fly } from 'svelte/transition';
  import { getCalendarContext, createSlotHelper } from './calendar.context';
  import { getMonthGrid, formatMonthShort, isSameDay } from '$lib/date';
  import { swipeable } from '$lib/utils/swipeable';

  const bt = useBlocksI18n();

  interface CalendarYearGridInternalProps {
    class?: string;
  }

  let { class: className = '' }: CalendarYearGridInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);

  const miniMonths = $derived(
    ctx.yearMonths.map(({ month, year }) => ({
      month,
      year,
      label: formatMonthShort(month, ctx.locale),
      grid: getMonthGrid(year, month, ctx.weekStartsOn),
      isCurrent: month === ctx.today.getMonth() && year === ctx.today.getFullYear(),
      isDisplayed: month === ctx.displayedMonth && year === ctx.displayedYear
    }))
  );

  function handleMonthClick(month: number) {
    ctx.goToMonth(month, ctx.displayedYear);
    ctx.setView('month');
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const buttons = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-month]')
    );
    const currentIdx = buttons.indexOf(target);
    if (currentIdx < 0) return;

    let nextIdx: number;

    switch (e.key) {
      case 'ArrowRight':
        nextIdx = Math.min(currentIdx + 1, buttons.length - 1);
        break;
      case 'ArrowLeft':
        nextIdx = Math.max(currentIdx - 1, 0);
        break;
      case 'ArrowDown':
        nextIdx = Math.min(currentIdx + 3, buttons.length - 1);
        break;
      case 'ArrowUp':
        nextIdx = Math.max(currentIdx - 3, 0);
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = buttons.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleMonthClick(currentIdx);
        return;
      default:
        return;
    }

    if (nextIdx !== currentIdx) {
      e.preventDefault();
      buttons[nextIdx]?.focus();
    }
  }
</script>

<div
  class={slot('yearGrid', className)}
  role="grid"
  tabindex={0}
  aria-label={bt('calendar.yearView')}
  onkeydown={handleKeydown}
  style="overflow: hidden;"
  {@attach swipeable({
    // Direction-gated like the header arrows (the DateGridScaffold pattern): a
    // swipe at the bound is inert — no navDirection flip, no clamped no-op
    // emit. In year view the gate is month-granular (the controller maps year
    // onto month bounds): whenever it blocks, the year step would have clamped
    // back onto the displayed month/year anyway — never a real change.
    onSwipeLeft: () => {
      if (ctx.canGoForward) ctx.navigate(1);
    },
    onSwipeRight: () => {
      if (ctx.canGoBack) ctx.navigate(-1);
    },
    enabled: ctx.swipeable && !ctx.disabled
  })}
>
  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key ctx.displayedYear}
      <div
        class="grid grid-cols-3"
        in:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
          : { duration: 0 }}
        out:fly={ctx.shouldAnimate && ctx.navDirection
          ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
          : { duration: 0 }}
      >
        {#each miniMonths as mini (mini.month)}
          <button
            type="button"
            class="{slot('yearMonth')} {mini.isCurrent
              ? 'bg-primary-subtle ring-primary ring-1'
              : ''}"
            data-month={mini.month}
            onclick={() => handleMonthClick(mini.month)}
            aria-label="{mini.label} {ctx.displayedYear}"
          >
            <span class="{slot('yearMonthTitle')} {mini.isCurrent ? 'text-primary font-bold' : ''}"
              >{mini.label}</span
            >
            <div class="grid w-full grid-cols-7 gap-px">
              {#each mini.grid.flat() as date (date.toISOString())}
                {@const inMonth = date.getMonth() === mini.month}
                {@const events = ctx.getEventsForDate(date)}
                {@const hasEvents = events.length > 0}
                {@const isToday = isSameDay(date, ctx.today)}
                <span
                  class="{slot('yearMiniDay')}
                  {!inMonth ? 'invisible' : ''}
                  {hasEvents && inMonth ? 'text-text-primary bg-primary-subtle/30 font-bold' : ''}
                  {isToday && inMonth ? 'bg-primary text-text-on-primary rounded-full' : ''}"
                >
                  {#if inMonth}
                    {date.getDate()}
                    {#if hasEvents && !isToday}
                      <span
                        class="{slot('yearMiniDot')} block"
                        style="background-color: var(--color-primary)"
                      ></span>
                    {/if}
                  {/if}
                </span>
              {/each}
            </div>
          </button>
        {/each}
      </div>
    {/key}
  </div>
</div>
