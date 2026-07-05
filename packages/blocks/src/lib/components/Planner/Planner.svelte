<script lang="ts" generics="T = unknown">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { stripTime } from '$lib/date';
  import {
    DateGridController,
    DateGridScaffold,
    setDateGridContext,
    type DateGridRange,
    type DateGridSelection,
    type DateGridView,
    type DayCellInfo,
    type DayHeaderInfo
  } from '$lib/internal/date-grid';
  import { bucketItemsByDate } from './planner.bucket';
  import { setPlannerContext } from './planner.context';
  import { plannerVariants, type PlannerVariants } from './planner.variants';
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
    locale = 'de-DE',
    showWeekNumber = false,
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

  const bt = useBlocksI18n();

  // --- BlocksConfig integration ---
  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // --- Styling: one tv() instance, resolved per slot ---
  const variantProps: PlannerVariants = $derived({ view, variant, size });
  const styles = $derived(plannerVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Planner', preset, variantProps, slotClassesProp)
  );
  function slot(name: PlannerSlotName, extra?: string): string {
    const overrides = [slotClasses?.[name], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
    const fn = styles[name] as ((args: { class: string }) => string) | undefined;
    return fn?.({ class: overrides }) ?? overrides;
  }

  // --- Reference date: controlled by `value`, else internal state seeded once ---
  let internalRef = $state(stripTime(value ?? selectedDate ?? new Date()));
  const referenceDate = $derived(value !== undefined ? stripTime(value) : internalRef);
  function setReference(next: Date) {
    const d = stripTime(next);
    internalRef = d;
    if (value !== undefined) value = d;
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
    get locale() {
      return locale;
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
      return undefined;
    },
    get maxDate() {
      return undefined;
    },
    get disabled() {
      return disabled;
    },
    onNavigate: handleNavigate,
    onSelect: handleSelect
  });

  function handleNavigate(next: Date, range: DateGridRange) {
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
  const weekdayFormatter = $derived(new Intl.DateTimeFormat(locale, { weekday: 'short' }));
  function weekdayName(date: Date): string {
    return weekdayFormatter.format(date);
  }

  // --- Per-cell state classes (dynamic; not part of the static variant matrix) ---
  const todayDateMark = 'bg-primary text-text-on-primary rounded-full';
  function cellStateClasses(p: PlannerCellContext<T>): Array<string | false> {
    return [
      p.isSelected && 'ring-2 ring-primary ring-inset relative z-10',
      highlightWeekend && p.isWeekend && 'bg-surface-subtle',
      p.isOutsideRange && 'opacity-40'
    ];
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
    canGoForward: controller.canGoForward
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
    get locale() {
      return locale;
    },
    get disabled() {
      return disabled;
    },
    navigate: (delta) => controller.navigate(delta),
    goToToday: () => controller.goToToday(),
    goTo: (date) => controller.goTo(date),
    slot
  };
  setPlannerContext(plannerCtx);
</script>

<div class={slot('base', className)} {...restProps}>
  <div class="sr-only" aria-live="polite" role="status">{controller.title}</div>

  {#if header}
    {@render header(headerContext)}
  {:else}
    <PlannerHeader />
  {/if}

  <DateGridScaffold
    class={slot('grid', !isWeek ? 'border-r border-b border-border-subtle' : '')}
    {showWeekNumber}
    swipeable={swipeableProp && !disabled}
    {animated}
    ariaLabel={bt('planner.grid')}
    headerRowClass={slot('weekdayHeader', isWeek ? 'gap-2 max-md:hidden' : '')}
    headerClass={slot('weekday')}
    rowClass={slot('week', isWeek ? 'gap-2 max-md:grid-cols-1' : '')}
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
        {@const isToday = controller.isToday(info.date)}
        <span class={['tabular-nums', isToday && 'text-primary font-bold']}>
          {info.date.getDate()}
        </span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet gridCell(info: DayCellInfo)}
  {@const p = plannerCellContext(info)}
  <div class={[slot('cell'), ...cellStateClasses(p)]}>
    <!-- Date header: week shows weekday+date only when stacked (mobile); month/range always. -->
    <div class={[slot('cellHeader'), isWeek && 'md:hidden']}>
      {#if isWeek}
        <span class={slot('cellWeekday')}>{p.weekday}</span>
      {/if}
      <span
        class={[
          slot('cellDate'),
          highlightToday && p.isToday ? todayDateMark : 'text-text-secondary'
        ]}
      >
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
        class="bg-primary-subtle text-primary inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums"
        aria-label={bt('planner.itemCount', { count: p.items.length })}
      >
        {p.items.length}
      </span>
    {/if}
  </div>
{/snippet}
