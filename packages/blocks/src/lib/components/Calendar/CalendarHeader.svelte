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
  import type { CalendarVariants } from './calendar.variants';
  import { formatMonthShort, formatMonthYear } from '$lib/date';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { CalendarHeaderProps, CalendarSlotName, CalendarViewMode } from './index';

  const bt = useBlocksI18n();

  let {
    children,
    showToday = true,
    showViewSwitcher = true,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    ...restProps
  }: CalendarHeaderProps = $props();

  const ctx = getCalendarContext();

  // `extra` carries consumer classes only. It is the last rung of the chain,
  // so a library class put here would beat the consumer's own `slotClasses`
  // entry in a shared bucket — it belongs in `variants` instead.
  const unstyled = $derived(unstyledProp || ctx.unstyled);

  function slot(key: CalendarSlotName, extra?: string, variants?: CalendarVariants) {
    const overrides = resolveClassChain(
      ctx.slotClasses?.[key],
      slotClassesProp?.[key as keyof typeof slotClassesProp],
      extra
    );
    if (unstyled) return overrides;
    const styles = ctx.styles as Record<
      CalendarSlotName,
      (args: CalendarVariants & { class: string }) => string
    >;
    return styles[key]?.({ ...variants, class: overrides }) ?? overrides;
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
      // The agenda steps its own window, so the label names what actually
      // moves: a single day when `agendaDays` is 1, a range otherwise.
      case 'agenda':
        return ctx.agendaWindow.days === 1
          ? bt('calendar.previousDay')
          : bt('calendar.previousRange');
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
        return ctx.agendaWindow.days === 1 ? bt('calendar.nextDay') : bt('calendar.nextRange');
    }
  });

  // View switcher config — filtered by ctx.views. Both label forms come from
  // the dictionary: the short ones used to be hardcoded German initials
  // ('T' for Tag, 'J' for Jahr), which read as nonsense in every other
  // language — and they are on screen far more often now that the narrow
  // header falls back to them.
  const allViewButtons = [
    {
      view: 'month' as const,
      label: () => bt('calendar.viewMonth'),
      shortLabel: () => bt('calendar.viewMonthShort')
    },
    {
      view: 'week' as const,
      label: () => bt('calendar.viewWeek'),
      shortLabel: () => bt('calendar.viewWeekShort')
    },
    {
      view: 'day' as const,
      label: () => bt('calendar.viewDay'),
      shortLabel: () => bt('calendar.viewDayShort')
    },
    {
      view: 'year' as const,
      label: () => bt('calendar.viewYear'),
      shortLabel: () => bt('calendar.viewYearShort')
    },
    {
      view: 'agenda' as const,
      label: () => bt('calendar.viewAgenda'),
      shortLabel: () => bt('calendar.viewAgendaShort')
    }
  ];
  const viewButtons = $derived(allViewButtons.filter((vb) => ctx.views.includes(vb.view)));

  // Below `sm` the header stops being a wrapping row and becomes a three-column
  // grid: `‹ · title · ›` on the first line, view switcher + today on the
  // second. Wrapping alone decided the line break by width, which split the two
  // chevrons across lines — `‹` stayed with the title, `›` travelled with the
  // today button — and at 320 px (a 184 px header) it broke into four lines,
  // one control each. The columns are `auto 1fr auto`, so the nav buttons keep
  // their width and the title column takes the rest: the chevrons flank the
  // title at every narrow width instead of only where the arithmetic works out.
  //
  // Only with a switcher. Without one (DatePicker, DateRangePicker) the four
  // remaining controls wrap on their own, and the grid would raise the header's
  // min-content — which is exactly what the popover's shrink-to-fit width
  // measures itself against.
  //
  // The axis in calendar.variants.ts carries only what the flex path cannot
  // survive: the grid itself, and the actions wrapper's `contents`, which would
  // dissolve the cluster wherever the grid is off. Every placement is constant
  // and sits in its slot base, inert in the flex path where `grid-column` /
  // `grid-row` on a flex item does nothing. Both are config, so `unstyled`
  // drops the whole layout together — the flag only selects the axis value.
  const stacksOnNarrow = $derived(showViewSwitcher);

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
  // bare number and never moved. The agenda left this set on 2026-08-12: its
  // title is a date range now (or a day title at `agendaDays={1}`), so it varies
  // with its own content exactly like the week and day titles do — and those
  // have never been reserved for. It is a real trade: adjacent agenda windows
  // differ by up to 14 characters (a same-month window collapses its month, a
  // year-crossing one spells out both years), so the header resizes as the list
  // pages. Reserving the widest form would mean laying out a hidden
  // year-crossing variant on every render to buy stability for one of five
  // views; the family's own rule — month titles are reserved, date ranges are
  // not — wins over that.
  const reservesMonthWidth = $derived(ctx.view === 'month');
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
  <div class={slot('header', className, { stacksOnNarrow })} {...restProps}>
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

    <div class={slot('titleGroup', undefined, { stacksOnNarrow })}>
      <Popover {unstyled} bind:open={monthPickerOpen} placement="bottom">
        {#snippet trigger()}
          <button
            type="button"
            class={[
              slot('title'),
              'hover:text-primary-text inline-flex cursor-pointer items-center gap-1 transition-colors',
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

                Dropped inside the narrow grid, where it has no job left: the
                title sits in a `1fr` column whose width comes from the header,
                not from the title, so paging cannot move anything. Holding 148
                px open there only costs the visible title room — at 320 px the
                column is 104 px wide and "March 2026" wrapped to two lines
                against a reservation nothing was measuring.
              -->
              <span class="grid">
                {#each monthTitleVariants as variant (variant.month)}
                  <span
                    class={[
                      'invisible col-start-1 row-start-1 flex items-center gap-1',
                      stacksOnNarrow && 'max-sm:hidden'
                    ]}
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
                  ? 'bg-primary-subtle ring-primary text-primary-text font-semibold ring-1'
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

    <!--
      Switcher and actions are SEPARATE header children, not one cluster: each
      is then its own wrap unit, so a header too narrow for
      `switcher + today + next` on one line drops the actions to a line of
      their own instead of squeezing the switcher into its collapsed (vertical)
      fallback. That is the path a narrow container takes from `sm` up — below
      `sm` the grid above places both explicitly. On a wide header they still
      sit flush: the header's `gap-x-2` is exactly the 4 px gap + 4 px margin
      that used to separate them.

      In the grid the switcher takes the second line from the left edge across
      the title column, up to the today button — or across all three columns
      when there is no today button to leave room for.
    -->
    {#if showViewSwitcher}
      <SegmentGroup
        {unstyled}
        value={ctx.view}
        size={viewSwitcherSize}
        disabled={ctx.disabled}
        onValueChange={(v) => ctx.setView(v as CalendarViewMode)}
        ariaLabel={bt('calendar.viewSwitcher')}
        class={slot('switcher', undefined, { stacksOnNarrow, showToday })}
      >
        {#each viewButtons as vb (vb.view)}
          <!--
            Below `sm` the five labels condense to their short form — without
            it the switcher alone wants 308 px on a 254 px phone header, which
            is the one case `flex-wrap` cannot solve (a lone item on its own
            line has nothing left to wrap) and SegmentGroup would degrade to
            its vertical stack. `aria-label` pins the accessible name to the
            full label, so the visual short form never reaches a screen reader.
            The swap is pure CSS — no JS, no resize observer.

            A VIEWPORT breakpoint, deliberately not a container query, even
            though the calendar's own width is the more precise signal:
            `container-type: inline-size` also drops the element's intrinsic
            width contribution, and this calendar's width comes from exactly
            this header — the DatePicker's shrink-to-fit popover collapsed
            from 310 px to 192 px (day cells 39 → 22 px, under the 24 px touch
            minimum) when the root became a container. A narrow calendar on a
            wide screen keeps the full labels and re-flows instead.
          -->
          <SegmentItem {unstyled} value={vb.view} aria-label={vb.label()} class="max-sm:px-2">
            {#if ctx.size === 'sm'}
              {vb.shortLabel()}
            {:else}
              <span class="max-sm:hidden">{vb.label()}</span>
              <span class="hidden max-sm:inline" aria-hidden="true">{vb.shortLabel()}</span>
            {/if}
          </SegmentItem>
        {/each}
      </SegmentGroup>
    {/if}

    <div class={slot('actions', undefined, { stacksOnNarrow })}>
      {#if showToday}
        <!--
          No explicit cell for this one: the grid item is Tooltip's own trigger
          wrapper, not the button inside it, and Tooltip's `class` prop styles
          the panel. Auto-placement gets it right without help — the four
          explicit items fill (1,1) (1,2) (1,3) and (2,1–2), so the only free
          cell left for it is (2,3), beside the switcher. The switcher spans all
          three columns only when there is no today button to place.
        -->
        <Tooltip {unstyled} label={bt('calendar.today')}>
          <CoreIconButton
            class={slot('navButton')}
            onclick={() => ctx.goToToday()}
            disabled={!ctx.canGoToToday || ctx.disabled}
            aria-label={bt('calendar.today')}
          >
            <CalendarIcon size={navIconSize} />
          </CoreIconButton>
        </Tooltip>
      {/if}

      <CoreIconButton
        class={slot('navButton', undefined, { navPlacement: 'next' })}
        onclick={() => ctx.navigate(1)}
        disabled={!ctx.canGoForward || ctx.disabled}
        aria-label={nextLabel}
      >
        <ChevronRightIcon size={navIconSize} />
      </CoreIconButton>
    </div>
  </div>
{/if}
