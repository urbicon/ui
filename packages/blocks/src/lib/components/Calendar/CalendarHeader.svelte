<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Tooltip } from '$lib/primitives/Tooltip';
  import { Popover } from '$lib/primitives/Popover';
  import { SegmentGroup, SegmentItem } from '$lib/primitives/SegmentGroup';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import ChevronLeftIcon from '$lib/icons/ChevronLeftIcon.svelte';
  import ChevronRightIcon from '$lib/icons/ChevronRightIcon.svelte';
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte';
  import CalendarIcon from '$lib/icons/CalendarIcon.svelte';
  import { getCalendarContext } from './calendar.context';
  import { formatMonthShort, formatMonthYear } from '$lib/date';
  import type { CalendarHeaderProps, CalendarSlotName, CalendarViewMode } from './index';

  const bt = useBlocksI18n();

  let {
    children,
    showToday = true,
    showViewSwitcher = true,
    class: className = '',
    unstyled: unstyledProp,
    slotClasses: slotClassesProp = {},
    ...restProps
  }: CalendarHeaderProps = $props();

  const ctx = getCalendarContext();

  function slot(key: CalendarSlotName, extra?: string) {
    const overrides = [
      ctx.slotClasses?.[key],
      slotClassesProp?.[key as keyof typeof slotClassesProp],
      extra
    ]
      .filter(Boolean)
      .join(' ');
    const isUnstyled = unstyledProp ?? ctx.unstyled;
    if (isUnstyled) return overrides;
    const styles = ctx.styles as Record<CalendarSlotName, (args: { class: string }) => string>;
    return styles[key]?.({ class: overrides }) ?? overrides;
  }

  // View-aware aria-labels for navigation buttons
  const prevLabel = $derived.by(() => {
    switch (ctx.view) {
      case 'month':
        return bt('calendar.previousMonth');
      case 'year':
        return bt('calendar.previousYear');
      case 'week':
        return bt('calendar.previousWeek');
      case 'day':
        return bt('calendar.previousDay');
      case 'agenda':
        return bt('calendar.previousMonth');
    }
  });

  const nextLabel = $derived.by(() => {
    switch (ctx.view) {
      case 'month':
        return bt('calendar.nextMonth');
      case 'year':
        return bt('calendar.nextYear');
      case 'week':
        return bt('calendar.nextWeek');
      case 'day':
        return bt('calendar.nextDay');
      case 'agenda':
        return bt('calendar.nextMonth');
    }
  });

  // View switcher config — filtered by ctx.views
  const allViewButtons = [
    { view: 'month' as const, label: () => bt('calendar.viewMonth'), shortLabel: 'M' },
    { view: 'week' as const, label: () => bt('calendar.viewWeek'), shortLabel: 'W' },
    { view: 'day' as const, label: () => bt('calendar.viewDay'), shortLabel: 'T' },
    { view: 'year' as const, label: () => bt('calendar.viewYear'), shortLabel: 'J' },
    { view: 'agenda' as const, label: () => bt('calendar.viewAgenda'), shortLabel: 'A' }
  ];
  const viewButtons = $derived(allViewButtons.filter((vb) => ctx.views.includes(vb.view)));

  // Map calendar size to SegmentGroup size
  const viewSwitcherSize = $derived(
    ctx.size === 'sm' ? ('sm' as const) : ctx.size === 'md' ? ('sm' as const) : ('md' as const)
  );

  // Nav button icon size based on calendar size
  const navIconSize = $derived(ctx.size === 'sm' ? 14 : 16);
  const pickerIconSize = $derived(ctx.size === 'sm' ? 12 : 14);

  // Month/Year Quick-Pick
  let monthPickerOpen = $state(false);
  // Writable state (not $derived): needs both external sync and local mutation.
  let pickerYear = $state(ctx.displayedYear);

  // Keep pickerYear in sync when navigation changes
  $effect(() => {
    pickerYear = ctx.displayedYear;
  });

  // Close picker when calendar becomes disabled
  $effect(() => {
    if (ctx.disabled) monthPickerOpen = false;
  });

  const months = $derived(
    Array.from({ length: 12 }, (_, i) => ({
      index: i,
      label: formatMonthShort(i, ctx.locale),
      isCurrent: i === ctx.displayedMonth && pickerYear === ctx.displayedYear
    }))
  );

  function selectMonth(month: number) {
    ctx.goToMonth(month, pickerYear);
    if (ctx.view === 'year') ctx.setView('month');
    monthPickerOpen = false;
  }

  // The month name used to set the calendar's width: the title is the widest
  // thing in the header, and paging March → September dragged the whole grid
  // with it (measured 212 → 268 px in de-DE, a 56 px step per month change).
  //
  // The reservation below holds the width of the longest title the ACTIVE
  // locale can produce, by laying all twelve months in the same grid cell and
  // showing one. A `min-width` in px/rem would be a magic number per size ×
  // language — "September" is not the longest month name everywhere — and this
  // reads the same Intl formatter the title itself comes from.
  //
  // Month-based views only. `week`/`day` titles carry day numbers that vary in
  // width on their own, so there is no fixed set to reserve for; `year` is a
  // bare number and never moved.
  const reservesMonthWidth = $derived(ctx.view === 'month' || ctx.view === 'agenda');
  const monthTitleVariants = $derived(
    reservesMonthWidth
      ? Array.from({ length: 12 }, (_, month) => ({
          month,
          label: formatMonthYear(ctx.displayedYear, month, ctx.locale)
        }))
      : []
  );
</script>

{#if children}
  <div class={slot('header', className)} {...restProps}>
    {@render children()}
  </div>
{:else}
  <!--
    All header buttons render on the internal CoreIconButton (was `<Button
    unstyled mint="none">`, which emitted only the call-site classes). The
    core's plumbing overlaps the navButton slot's old baseline (inline-flex
    centring, focus-visible reset, disabled opacity/cursor — now supplied by
    the core, stripped from the slot); the deliberate deltas it introduces are
    documented on the slot in calendar.variants.ts.
  -->
  <div class={slot('header', className)} {...restProps}>
    <div class={slot('nav')}>
      <CoreIconButton
        class={slot('navButton')}
        onclick={() => ctx.navigate(-1)}
        disabled={!ctx.canGoBack || ctx.disabled}
        aria-label={prevLabel}
      >
        <ChevronLeftIcon size={navIconSize} />
      </CoreIconButton>
    </div>

    <div class="flex items-center gap-2">
      <Popover bind:open={monthPickerOpen} placement="bottom">
        {#snippet trigger()}
          <button
            type="button"
            class={[
              slot('title'),
              'hover:text-primary inline-flex cursor-pointer items-center gap-1 transition-colors',
              ctx.disabled && 'pointer-events-none cursor-not-allowed opacity-50'
            ]}
            aria-expanded={monthPickerOpen}
            aria-haspopup="dialog"
            disabled={ctx.disabled}
          >
            {#if reservesMonthWidth}
              <!--
                The eleven other months sit in the same grid cell as the title,
                hidden, so the cell holds the width of the longest and the title
                stops moving the grid.

                The caret rides INSIDE the visible cell, not beside the stack: as
                a sibling it would be pushed out to the reserved width and float
                in dead space next to a short month ("Mai 2026" with the caret
                placed for "September 2026"). In the cell it tracks the text
                while the reservation keeps holding the box open.

                `aria-hidden` on the reservations is belt and braces —
                `visibility: hidden` already takes them out of the a11y tree, but
                that depends on the consumer's build emitting `.invisible`, and
                the failure mode without it is the button announcing twelve month
                names.

                Deliberately NO `whitespace-nowrap`: measured, it changes nothing
                about the reservation (the cell still holds the longest title, 0
                px of travel across twelve months) and it would raise the
                header's min-content from 103 px to 148 px — turning a title that
                used to wrap in a 280 px sidebar into permanent overflow.
              -->
              <span class="grid">
                {#each monthTitleVariants as variant (variant.month)}
                  <span
                    class="invisible col-start-1 row-start-1 flex items-center gap-1"
                    aria-hidden="true"
                  >
                    {variant.label}
                    <ChevronDownIcon size={pickerIconSize} />
                  </span>
                {/each}
                <span class="col-start-1 row-start-1 flex items-center gap-1">
                  {ctx.headerTitle}
                  <ChevronDownIcon
                    size={pickerIconSize}
                    class="transition-transform {monthPickerOpen ? 'rotate-180' : ''}"
                  />
                </span>
              </span>
            {:else}
              {ctx.headerTitle}
              <ChevronDownIcon
                size={pickerIconSize}
                class="transition-transform {monthPickerOpen ? 'rotate-180' : ''}"
              />
            {/if}
          </button>
        {/snippet}
        <div class="min-w-48 p-3">
          <div class="mb-2 flex items-center justify-between">
            <CoreIconButton
              class={slot('navButton')}
              onclick={() => pickerYear--}
              aria-label={bt('calendar.previousYear')}
            >
              <ChevronLeftIcon size={pickerIconSize} />
            </CoreIconButton>
            <span class="text-text-primary font-semibold tabular-nums">{pickerYear}</span>
            <CoreIconButton
              class={slot('navButton')}
              onclick={() => pickerYear++}
              aria-label={bt('calendar.nextYear')}
            >
              <ChevronRightIcon size={pickerIconSize} />
            </CoreIconButton>
          </div>
          <div class="grid grid-cols-3 gap-1">
            {#each months as m (m.index)}
              <!--
                Text-labelled month cell on the same CoreIconButton as the nav
                buttons (removes the last CalendarHeader→Button edge). The core
                REQUIRES aria-label, so it gets the visible label — the accessible
                name stays the identical string. Never rendered disabled (the
                picker closes when the calendar is disabled), so the core's
                disabled plumbing is inert here.
              -->
              <CoreIconButton
                class="text-text-primary rounded-md px-2 py-1.5 text-sm transition-colors
                  {m.isCurrent
                  ? 'bg-primary-subtle ring-primary text-primary font-semibold ring-1'
                  : 'hover:bg-surface-hover'}
                  focus-visible:ring-primary/50 focus-visible:ring-2"
                onclick={() => selectMonth(m.index)}
                aria-label={m.label}
              >
                {m.label}
              </CoreIconButton>
            {/each}
          </div>
        </div>
      </Popover>
    </div>

    <div class="flex items-center gap-1">
      {#if showViewSwitcher}
        <SegmentGroup
          value={ctx.view}
          size={viewSwitcherSize}
          disabled={ctx.disabled}
          onValueChange={(v) => ctx.setView(v as CalendarViewMode)}
          ariaLabel={bt('calendar.viewSwitcher')}
        >
          {#each viewButtons as vb (vb.view)}
            <SegmentItem value={vb.view}>
              {ctx.size === 'sm' ? vb.shortLabel : vb.label()}
            </SegmentItem>
          {/each}
        </SegmentGroup>
      {/if}

      {#if showToday}
        <Tooltip label={bt('calendar.today')}>
          <CoreIconButton
            class="{slot('navButton')} ml-1"
            onclick={() => ctx.goToToday()}
            disabled={!ctx.canGoToToday || ctx.disabled}
            aria-label={bt('calendar.today')}
          >
            <CalendarIcon size={navIconSize} />
          </CoreIconButton>
        </Tooltip>
      {/if}

      <CoreIconButton
        class={slot('navButton')}
        onclick={() => ctx.navigate(1)}
        disabled={!ctx.canGoForward || ctx.disabled}
        aria-label={nextLabel}
      >
        <ChevronRightIcon size={navIconSize} />
      </CoreIconButton>
    </div>
  </div>
{/if}
