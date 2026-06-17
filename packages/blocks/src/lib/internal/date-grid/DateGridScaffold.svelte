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
    /** Class for each weekday-header cell. */
    headerClass?: string;
    /** Class for each week row. */
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
  const gridTemplate = $derived(
    `${showWeekNumber ? 'minmax(2rem, auto) ' : ''}repeat(7, minmax(0, 1fr))`
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
    if (handleDateGridKeydown(event, ctx)) {
      // Move DOM focus to follow the controller's roving focus.
      const target = toIso(ctx.focusedDate);
      requestAnimationFrame(() => {
        gridEl?.querySelector<HTMLElement>(`[data-date="${target}"]`)?.focus();
      });
    }
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
    onSwipeLeft: () => ctx.navigate(1),
    onSwipeRight: () => ctx.navigate(-1),
    enabled: swipeEnabled && !ctx.disabled
  })}
>
  <!-- Weekday header -->
  <div role="row" class="grid" style="grid-template-columns: {gridTemplate};">
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
          <div role="row" class="grid {rowClass}" style="grid-template-columns: {gridTemplate};">
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
                onclick={() => ctx.selectDate(date)}
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
