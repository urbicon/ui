<script lang="ts" generics="T = unknown">
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { stripTime, toIso } from '$lib/date';
  import {
    DateGridController,
    DateGridScaffold,
    setDateGridContext,
    type DateRange,
    type DateGridSelection,
    type DateGridView,
    type DayCellInfo,
    type DayHeaderInfo
  } from '$lib/internal/date-grid';
  import { resolveClassChain } from '$lib/utils/variants';
  import { bucketItemsByDate } from './planner.bucket';
  import { setPlannerContext } from './planner.context';
  import {
    type PlannerCellState,
    plannerVariants,
    type PlannerVariants,
    plannerWeekStacking
  } from './planner.variants';
  import type {
    PlannerCellContext,
    PlannerContext,
    PlannerDayContext,
    PlannerHeaderContext,
    PlannerSlotName
  } from './planner.types';
  import PlannerHeader from './PlannerHeader.svelte';
  import type { PlannerProps } from './index';

  let {
    // Content / data
    items = [],
    getDate,
    sort,
    // View
    view = 'week',
    rangeStart = $bindable(undefined),
    rangeEnd = $bindable(undefined),
    weekStartsOn = 1,
    locale = 'auto',
    // No default here on purpose — `undefined` is the sentinel that lets the
    // resolution below tell "not passed" from an explicit `false`.
    showWeekNumbers,
    showWeekNumber: showWeekNumberDeprecated,
    // Constraints
    minDate,
    maxDate,
    disabledDates = [],
    isDateDisabled: isDateDisabledProp,
    fixedWeeks = false,
    // State
    value = $bindable(undefined),
    selectedDate = $bindable(undefined),
    // Variants
    variant = 'default',
    size = 'md',
    // Behavior
    highlightToday = true,
    highlightWeekend = false,
    swipeable: swipeableProp = true,
    animated = true,
    disabled = false,
    // Callbacks
    onNavigate,
    onDateSelect,
    // Snippets
    header,
    dayHeader,
    cell,
    empty,
    // Styling
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: PlannerProps<T> = $props();

  // --- Locale resolution ---
  // `'auto'` follows the active `<I18nProvider>`, matching CurrencyInput. Reading
  // the locale from context (not `Intl` with `undefined`) keeps SSR and hydration
  // on the same tag; without a provider it is the base locale (`en`). The helper
  // verifies the context value before it reaches `Intl` — see
  // @urbicon-ui/i18n's resolve-date-locale.ts for why the prop is trusted and the context is not.
  const i18nLocale = useI18n();
  const resolvedLocale = $derived(resolveDateLocale(locale, i18nLocale.locale));

  const bt = useBlocksI18n();

  // --- Deprecated `showWeekNumber` (singular) ---
  // Renamed to the plural for parity with Calendar. Honoured rather than
  // silently dropped, and loud in DEV — the failure mode of a silent rename is a
  // week-number column that just stops appearing, with nothing to grep for.
  // Same `import.meta.env?.DEV && console.warn` idiom as DateGridController's
  // inverted-bounds warning.
  // `??`, not `||`: the new name wins whenever it was passed at all, so
  // `showWeekNumbers={false} showWeekNumber={true}` resolves to `false`. With
  // `||` the deprecated name would have overridden an explicit new-name `false`
  // — the one combination where a consumer is mid-migration and most deserves
  // the new name to be authoritative.
  const effectiveShowWeekNumbers = $derived(showWeekNumbers ?? showWeekNumberDeprecated ?? false);
  // Checked once at setup rather than in an $effect: the realistic mistake is a
  // statically-passed prop, and setup also runs during SSR, where an $effect
  // would stay silent.
  // svelte-ignore state_referenced_locally
  if (import.meta.env?.DEV && showWeekNumberDeprecated !== undefined) {
    console.warn(
      '[Planner] `showWeekNumber` is deprecated — rename it to `showWeekNumbers` ' +
        '(plural), matching Calendar. The old name still works but will be removed.'
    );
  }

  // --- BlocksConfig integration ---
  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // --- Styling: one tv() instance, resolved per slot ---
  const variantProps: PlannerVariants = $derived({ view, variant, size });
  const styles = $derived(plannerVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Planner',
      preset,
      variantProps,
      slotClassesProp,
      plannerVariants.config
    )
  );
  // `unstyled` drops the look, not the layout: below `md` the week view moves
  // the weekday and the date out of the header row and into every cell, and
  // without the breakpoint classes that do it both copies print at once, at
  // every width. The widening is only to make the index below legal — it
  // accepts a stale key, measured; the keys are checked where the `view: 'week'`
  // axis is assembled from the same map.
  const structuralClasses: Partial<Record<PlannerSlotName, string>> = plannerWeekStacking;

  /**
   * One slot, resolved. `state` names the per-cell axes for this call; `class`
   * is the consumer's own `class` prop and nothing else. A library class
   * belongs in `planner.variants.ts`, never in either argument — handed in
   * here it would be the LAST source of the chain and would strip the
   * consumer's own `slotClasses` entry (#349).
   *
   * The two consumer rungs are two sources, so `class` wins a shared Tailwind
   * bucket against `slotClasses`. The structural half is NOT one of them: it is
   * prepended, because it is the layout `unstyled` may not take away and a
   * consumer class in the same bucket would otherwise strip it — the mistake
   * `resolveSlotClass` in the table package paid for.
   */
  function slot(
    name: PlannerSlotName,
    { class: consumerClass, ...state }: PlannerCellState & { class?: string } = {}
  ): string {
    if (unstyled) {
      const structural = view === 'week' ? structuralClasses[name] : undefined;
      return [structural, resolveClassChain(slotClasses?.[name], consumerClass)]
        .filter(Boolean)
        .join(' ');
    }
    const fn = styles[name] as
      ((args: PlannerCellState & { class: (string | undefined)[] }) => string) | undefined;
    return (
      fn?.({ ...state, class: [slotClasses?.[name], consumerClass] }) ??
      resolveClassChain(slotClasses?.[name], consumerClass)
    );
  }

  // --- Reference date: controlled by `value`, else internal state seeded once ---
  let internalRef = $state(stripTime(value ?? selectedDate ?? new Date()));
  const referenceDate = $derived(value !== undefined ? stripTime(value) : internalRef);
  function setReference(next: Date) {
    const d = stripTime(next);
    internalRef = d;
    if (value !== undefined) value = d;
  }

  // --- Extra disable predicate (min/max are the controller's) ---
  // Mirrors Calendar: the explicit date list is pre-hashed on the ISO key so a
  // long `disabledDates` costs one lookup per cell instead of a linear scan.
  const disabledDatesSet = $derived(new Set(disabledDates.map((d) => toIso(d))));
  function checkExtraDisabled(date: Date): boolean {
    if (isDateDisabledProp?.(date)) return true;
    return disabledDatesSet.has(toIso(date));
  }

  // --- Headless mechanics: Planner owns the source of truth, the controller
  // computes geometry/queries and reports navigation/selection back. Single
  // selection only (D5); range/multiple stay Calendar's. ---
  const controller = new DateGridController({
    get referenceDate() {
      return referenceDate;
    },
    get view() {
      return view as DateGridView;
    },
    get weekStartsOn() {
      return weekStartsOn;
    },
    get fixedWeeks() {
      return fixedWeeks;
    },
    get locale() {
      return resolvedLocale;
    },
    get selectionMode() {
      return 'single' as const;
    },
    get selection() {
      return selectedDate as DateGridSelection | undefined;
    },
    get rangeStart() {
      return rangeStart;
    },
    get rangeEnd() {
      return rangeEnd;
    },
    get minDate() {
      return minDate;
    },
    get maxDate() {
      return maxDate;
    },
    get disabled() {
      return disabled;
    },
    isDateDisabled: checkExtraDisabled,
    onNavigate: handleNavigate,
    onSelect: handleSelect
  });

  function handleNavigate(next: Date, range: DateRange) {
    setReference(next);
    if (view === 'range') {
      // The range window follows rangeStart/rangeEnd, so navigation rebinds them
      // from the shifted window the controller computed.
      rangeStart = range.start;
      rangeEnd = range.end;
    }
    onNavigate?.(next, { start: range.start, end: range.end });
  }

  function handleSelect(_selection: DateGridSelection, date: Date) {
    selectedDate = date; // single mode — the selection is the clicked date
    onDateSelect?.(date);
  }

  // Midnight refresh for `today` — re-arms after each update via the reactive read.
  $effect(() => {
    const _today = controller.today;
    if (typeof window === 'undefined') return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeout = setTimeout(() => controller.refreshToday(), midnight.getTime() - now.getTime());
    return () => clearTimeout(timeout);
  });

  // --- Bucket items by local day; the cell snippet receives the typed slice ---
  const buckets = $derived(bucketItemsByDate(items, getDate, sort));

  function plannerCellContext(info: DayCellInfo): PlannerCellContext<T> {
    return {
      date: info.date,
      isoDate: info.isoDate,
      items: buckets.get(info.isoDate) ?? [],
      isToday: info.isToday,
      isSelected: controller.isSelected(info.date),
      isWeekend: info.isWeekend,
      isOutsideRange: info.isOutside,
      isDisabled: info.isDisabled,
      weekNumber: info.weekNumber,
      weekday: weekdayName(info.date),
      selectDate: () => controller.selectDate(info.date)
    };
  }

  function plannerDayContext(info: DayHeaderInfo): PlannerDayContext {
    const date = info.date;
    return {
      date,
      isoDate: date ? controller.dayCellInfo(date).isoDate : undefined,
      weekday: info.weekday,
      isToday: date ? controller.isToday(date) : false,
      isWeekend: info.isWeekend,
      weekNumber: date ? controller.weekNumberFor(date) : undefined
    };
  }

  // Short weekday name for a date (for stacked week cells), via the locale.
  const weekdayFormatter = $derived(new Intl.DateTimeFormat(resolvedLocale, { weekday: 'short' }));
  function weekdayName(date: Date): string {
    return weekdayFormatter.format(date);
  }

  // --- Per-cell state, as variant axes rather than appended classes ---
  // The date number lives in Planner's own cell header, NOT in the consumer's
  // `cell` snippet, so `PlannerCellContext.isDisabled` cannot reach it — which
  // is why the ladder is drawn here and not left to the consumer.
  function cellState(p: PlannerCellContext<T>): PlannerCellState {
    return {
      dayState: p.isDisabled ? 'disabled' : highlightToday && p.isToday ? 'today' : 'default',
      selected: p.isSelected,
      weekend: highlightWeekend && p.isWeekend,
      outside: p.isOutsideRange
    };
  }

  const isWeek = $derived(view === 'week');

  // --- Header context (for the `header` snippet) ---
  const headerContext = $derived<PlannerHeaderContext>({
    title: controller.title,
    rangeStart: controller.rangeStart,
    rangeEnd: controller.rangeEnd,
    weekNumber: controller.weekNumberFor(referenceDate),
    view,
    navigate: (delta) => controller.navigate(delta),
    goToToday: () => controller.goToToday(),
    goTo: (date) => controller.goTo(date),
    canGoBack: controller.canGoBack,
    canGoForward: controller.canGoForward,
    canGoToToday: controller.canGoToToday
  });

  // --- Contexts: the controller IS the date-grid context the Scaffold reads;
  // PlannerHeader reads the lighter Planner context. ---
  setDateGridContext(controller);

  const plannerCtx: PlannerContext = {
    get view() {
      return view;
    },
    get title() {
      return controller.title;
    },
    get rangeStart() {
      return controller.rangeStart;
    },
    get rangeEnd() {
      return controller.rangeEnd;
    },
    get weekNumber() {
      return controller.weekNumberFor(referenceDate);
    },
    get canGoBack() {
      return controller.canGoBack;
    },
    get canGoForward() {
      return controller.canGoForward;
    },
    get canGoToToday() {
      return controller.canGoToToday;
    },
    get locale() {
      return resolvedLocale;
    },
    get disabled() {
      return disabled;
    },
    navigate: (delta) => controller.navigate(delta),
    goToToday: () => controller.goToToday(),
    goTo: (date) => controller.goTo(date),
    get unstyled() {
      return unstyled;
    },
    slot
  };
  setPlannerContext(plannerCtx);
</script>

<div class={slot('base', { class: className })} {...restProps}>
  <div class="sr-only" aria-live="polite" role="status">{controller.title}</div>

  {#if header}
    {@render header(headerContext)}
  {:else}
    <PlannerHeader />
  {/if}

  <DateGridScaffold
    class={slot('grid')}
    showWeekNumber={effectiveShowWeekNumbers}
    swipeable={swipeableProp && !disabled}
    {animated}
    ariaLabel={bt('planner.grid')}
    headerRowClass={slot('weekdayHeader')}
    headerClass={slot('weekday')}
    rowClass={slot('week')}
    cellClass="h-auto"
    weekNumberClass={slot('weekNumber')}
    cell={gridCell}
    dayHeader={gridDayHeader}
  />
</div>

{#snippet gridDayHeader(info: DayHeaderInfo)}
  {#if dayHeader}
    {@render dayHeader(plannerDayContext(info))}
  {:else}
    <span class="inline-flex items-center justify-center gap-1">
      {info.weekday}
      {#if isWeek && info.date}
        <!-- `highlightToday` used to gate only the cell date below, never this
             header number — so switching the marker off still left today bold
             and primary-coloured at the top of the week column. -->
        {@const markToday = highlightToday && controller.isToday(info.date)}
        <span class={['tabular-nums', markToday && 'text-primary-text font-bold']}>
          {info.date.getDate()}
        </span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet gridCell(info: DayCellInfo)}
  {@const p = plannerCellContext(info)}
  {@const state = cellState(p)}
  <div class={slot('cell', state)}>
    <!-- Weekday + date. Month and range show it always; the week view only
         while its rows are stacked, which `view.week.cellHeader` decides. -->
    <div class={slot('cellHeader')}>
      {#if isWeek}
        <span class={slot('cellWeekday')}>{p.weekday}</span>
      {/if}
      <span class={slot('cellDate', state)}>
        {info.date.getDate()}
      </span>
    </div>

    {#if p.items.length === 0 && empty}
      <!-- Empty day, and the consumer supplied a dedicated placeholder, which
           takes precedence over `cell` for empty days. -->
      <div class={slot('empty')}>{@render empty(p)}</div>
    {:else if cell}
      <!-- `cell` drives content. With no `empty` snippet it is called for empty
           days too (`items` is `[]`), so an "add" affordance can live here. -->
      <div class={slot('cellItems')}>{@render cell(p)}</div>
    {:else if p.items.length > 0}
      <!-- No cell snippet: a language-neutral count so bucketing is visible. -->
      <span
        class="bg-primary-subtle text-primary-text inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums"
        aria-label={bt('planner.itemCount', { count: p.items.length })}
      >
        {p.items.length}
      </span>
    {/if}
  </div>
{/snippet}
