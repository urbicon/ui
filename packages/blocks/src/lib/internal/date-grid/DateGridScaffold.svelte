<!--
  DateGridScaffold — the shared cell-grid chrome for date-grid views.

  Renders the invisible mechanics (role="grid" + roving-tabindex keyboard, the
  weekday header, an optional week-number column, swipe navigation and the
  navigate transition) and calls a `cell` snippet per day. The visible per-day
  markup is entirely the consumer's: Calendar layers event bars via `weekOverlay`
  and Planner buckets items inside `cell`.

  Covers the cell-based views only (month 6×7, week, range). Calendar's time-grid
  / day views render through their own components against the same context.
-->
<script lang="ts">
  import { toIso } from '$lib/date';
  import { swipeable } from '$lib/utils/swipeable';
  import type { Snippet } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { fly } from 'svelte/transition';
  import { getDateGridContext } from './date-grid.context';
  import { handleDateGridKeydown } from './date-grid.keyboard';
  import type { DayCellInfo, DayHeaderInfo } from './date-grid.types';

  interface Props {
    /** Per-day cell content (required). */
    cell: Snippet<[DayCellInfo]>;
    /** Per-column weekday header content; defaults to the localized short name. */
    dayHeader?: Snippet<[DayHeaderInfo]>;
    /** Per-week overlay drawn above the row (e.g. multi-day event bars). */
    weekOverlay?: Snippet<[{ week: Date[]; weekIndex: number }]>;
    /** Show the ISO week-number column on the left. */
    showWeekNumber?: boolean;
    /** Enter/exit transition on navigate (respects prefers-reduced-motion). */
    animated?: boolean;
    /** Enable horizontal swipe-to-navigate. */
    swipeable?: boolean;
    /** Accessible label for the grid. */
    ariaLabel?: string;
    /** Class for the grid container. */
    class?: string;
    /** Class for the weekday-header row (e.g. `max-md:hidden` to stack on mobile). */
    headerRowClass?: string;
    /** Class for each weekday-header cell. */
    headerClass?: string;
    /** Class for each week row (e.g. `max-md:grid-cols-1` to stack on mobile). */
    rowClass?: string;
    /** Class for each day gridcell. */
    cellClass?: string;
    /** Class for the week-number cell. */
    weekNumberClass?: string;
  }

  let {
    cell,
    dayHeader,
    weekOverlay,
    showWeekNumber = false,
    animated = true,
    swipeable: swipeEnabled = true,
    ariaLabel = 'Date grid',
    class: className = '',
    headerRowClass = '',
    headerClass = '',
    rowClass = '',
    cellClass = '',
    weekNumberClass = ''
  }: Props = $props();

  const ctx = getDateGridContext();

  const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
  const shouldAnimate = $derived(animated && !reducedMotion.current);

  // A stable identity for the visible window — drives the navigate transition.
  const navKey = $derived(toIso(ctx.rangeStart) + '|' + ctx.view);
  // Static Tailwind column classes (not an inline grid-template) so a consumer
  // can override them per breakpoint — e.g. Planner stacks the week on mobile
  // via `rowClass="max-md:grid-cols-1"`. Both literals must appear verbatim so
  // Tailwind emits them.
  const gridColsClass = $derived(
    showWeekNumber ? 'grid-cols-[minmax(2rem,auto)_repeat(7,minmax(0,1fr))]' : 'grid-cols-7'
  );

  const headerInfos = $derived.by<DayHeaderInfo[]>(() => {
    const singleWeek = ctx.view === 'week';
    return ctx.weekdayNames.map((weekday, index) => {
      const dayOfWeek = (ctx.weekStartsOn + index) % 7;
      return {
        weekday,
        weekdayNarrow: ctx.weekdayNamesNarrow[index],
        index,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        date: singleWeek ? ctx.weekDates[index] : undefined
      };
    });
  });

  let gridEl = $state<HTMLElement | null>(null);

  function onKeydown(event: KeyboardEvent) {
    // Drive grid navigation only from the cell itself; interactive children
    // (a Planner cell's buttons/inputs) keep their own Enter/Space/arrow keys.
    if (event.target !== event.currentTarget) return;
    if (handleDateGridKeydown(event, ctx)) {
      // Move DOM focus to follow the controller's roving focus.
      const target = toIso(ctx.focusedDate);
      requestAnimationFrame(() => {
        gridEl?.querySelector<HTMLElement>(`[data-date="${target}"]`)?.focus();
      });
    }
  }

  // Interactive content inside a cell (a Planner cell's buttons/links/inputs)
  // owns its own clicks — only a click on the cell body itself selects the day.
  // Mirrors the keydown guard, but the cell content fills the gridcell, so a
  // strict target===currentTarget check would make selection unreachable.
  const INTERACTIVE_SELECTOR =
    'button, a[href], input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"]';
  function onCellClick(event: MouseEvent, date: Date) {
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    ctx.selectDate(date);
  }

  const transitionIn = $derived(
    shouldAnimate && ctx.navDirection
      ? { x: ctx.navDirection === 'forward' ? 40 : -40, duration: 200 }
      : { duration: 0 }
  );
  const transitionOut = $derived(
    shouldAnimate && ctx.navDirection
      ? { x: ctx.navDirection === 'forward' ? -40 : 40, duration: 150 }
      : { duration: 0 }
  );
</script>

<div
  bind:this={gridEl}
  role="grid"
  tabindex={-1}
  aria-label={ariaLabel}
  aria-disabled={ctx.disabled || undefined}
  class={className}
  style="position: relative; overflow: hidden;"
  onmouseleave={() => ctx.setHoveredDate(null)}
  {@attach swipeable({
    // Direction-gated like the header arrows: a swipe at the bound should be
    // inert (no navDirection flip, no clamped no-op emit), matching the
    // disabled arrow button for the same direction.
    onSwipeLeft: () => {
      if (ctx.canGoForward) ctx.navigate(1);
    },
    onSwipeRight: () => {
      if (ctx.canGoBack) ctx.navigate(-1);
    },
    enabled: swipeEnabled && !ctx.disabled
  })}
>
  <!-- Weekday header -->
  <div role="row" class="grid {gridColsClass} {headerRowClass}">
    {#if showWeekNumber}
      <span role="columnheader" aria-hidden="true" class={weekNumberClass}></span>
    {/if}
    {#each headerInfos as info (info.index)}
      <span role="columnheader" class={headerClass}>
        {#if dayHeader}
          {@render dayHeader(info)}
        {:else}
          {info.weekday}
        {/if}
      </span>
    {/each}
  </div>

  <!-- Cell body (transitions on navigate) -->
  <div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
    {#key navKey}
      <div in:fly={transitionIn} out:fly={transitionOut}>
        {#each ctx.cells as week, weekIndex (toIso(week[0]))}
          {#if weekOverlay}
            {@render weekOverlay({ week, weekIndex })}
          {/if}
          <div role="row" class="grid {gridColsClass} {rowClass}">
            {#if showWeekNumber}
              <span role="rowheader" class={weekNumberClass}>
                {ctx.weekNumberFor(week[3] ?? week[0])}
              </span>
            {/if}
            {#each week as date (toIso(date))}
              {@const info = ctx.dayCellInfo(date)}
              <div
                role="gridcell"
                data-date={info.isoDate}
                aria-selected={ctx.isSelected(date) || undefined}
                aria-disabled={info.isDisabled || undefined}
                tabindex={info.isFocused ? 0 : -1}
                class="focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] {cellClass}"
                onclick={(event) => onCellClick(event, date)}
                onkeydown={onKeydown}
                onmouseenter={() => ctx.setHoveredDate(date)}
              >
                {@render cell(info)}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/key}
  </div>
</div>
