<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Tooltip } from '$lib/primitives/Tooltip';
  import { Popover } from '$lib/primitives/Popover';
  import { SegmentGroup, SegmentItem } from '$lib/primitives/SegmentGroup';
  import { Button } from '$lib/primitives/Button';
  import ChevronLeftIcon from '$lib/icons/ChevronLeftIcon.svelte';
  import ChevronRightIcon from '$lib/icons/ChevronRightIcon.svelte';
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte';
  import CalendarIcon from '$lib/icons/CalendarIcon.svelte';
  import { getCalendarContext } from './calendar.context';
  import { formatMonthShort } from './calendar.engine';
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
  // eslint-disable-next-line svelte/prefer-writable-derived -- needs both external sync and local mutation
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
</script>

{#if children}
  <div class={slot('header', className)} {...restProps}>
    {@render children()}
  </div>
{:else}
  <div class={slot('header', className)} {...restProps}>
    <div class={slot('nav')}>
      <Button
        unstyled
        mint="none"
        class={slot('navButton')}
        onclick={() => ctx.navigate(-1)}
        disabled={!ctx.canGoBack || ctx.disabled}
        aria-label={prevLabel}
      >
        <ChevronLeftIcon size={navIconSize} />
      </Button>
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
            {ctx.headerTitle}
            <ChevronDownIcon
              size={pickerIconSize}
              class="transition-transform {monthPickerOpen ? 'rotate-180' : ''}"
            />
          </button>
        {/snippet}
        <div class="min-w-48 p-3">
          <div class="mb-2 flex items-center justify-between">
            <Button
              unstyled
              mint="none"
              class={slot('navButton')}
              onclick={() => pickerYear--}
              aria-label={bt('calendar.previousYear')}
            >
              <ChevronLeftIcon size={pickerIconSize} />
            </Button>
            <span class="text-text-primary font-semibold tabular-nums">{pickerYear}</span>
            <Button
              unstyled
              mint="none"
              class={slot('navButton')}
              onclick={() => pickerYear++}
              aria-label={bt('calendar.nextYear')}
            >
              <ChevronRightIcon size={pickerIconSize} />
            </Button>
          </div>
          <div class="grid grid-cols-3 gap-1">
            {#each months as m (m.index)}
              <Button
                unstyled
                mint="none"
                class="text-text-primary rounded-md px-2 py-1.5 text-sm transition-colors
                  {m.isCurrent
                  ? 'bg-primary-subtle ring-primary text-primary font-semibold ring-1'
                  : 'hover:bg-surface-hover'}
                  focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none"
                onclick={() => selectMonth(m.index)}
              >
                {m.label}
              </Button>
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
          <Button
            unstyled
            mint="none"
            class="{slot('navButton')} ml-1"
            onclick={() => ctx.goToToday()}
            disabled={ctx.disabled}
            aria-label={bt('calendar.today')}
          >
            <CalendarIcon size={navIconSize} />
          </Button>
        </Tooltip>
      {/if}

      <Button
        unstyled
        mint="none"
        class={slot('navButton')}
        onclick={() => ctx.navigate(1)}
        disabled={!ctx.canGoForward || ctx.disabled}
        aria-label={nextLabel}
      >
        <ChevronRightIcon size={navIconSize} />
      </Button>
    </div>
  </div>
{/if}
