<!--
  PlannerHeader — the default Planner toolbar.

  prev / title / today / next, reading mechanics from the Planner context. The
  whole bar is replaceable via Planner's `header` snippet; this is the fallback.
-->
<script lang="ts">
  import { useBlocksI18n } from '$lib';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import { Tooltip } from '$lib/primitives/Tooltip';
  import { resolveIcon } from '$lib/icons';
  import ChevronLeftIconDefault from '$lib/icons/ChevronLeftIcon.svelte';
  import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
  import CalendarDaysIconDefault from '$lib/icons/CalendarDaysIcon.svelte';
  import { getPlannerContext } from './planner.context';

  const bt = useBlocksI18n();
  const ctx = getPlannerContext();

  const ChevronLeftIcon = resolveIcon('chevronLeft', ChevronLeftIconDefault);
  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);
  const CalendarDaysIcon = resolveIcon('calendarDays', CalendarDaysIconDefault);

  const prevLabel = $derived(
    ctx.view === 'month'
      ? bt('planner.previousMonth')
      : ctx.view === 'range'
        ? bt('planner.previousRange')
        : bt('planner.previousWeek')
  );
  const nextLabel = $derived(
    ctx.view === 'month'
      ? bt('planner.nextMonth')
      : ctx.view === 'range'
        ? bt('planner.nextRange')
        : bt('planner.nextWeek')
  );
</script>

<!--
  Nav buttons render on the internal CoreIconButton (was `<Button unstyled
  mint="none">`, which emitted only the call-site classes). The core's plumbing
  overlaps the navButton slot's old baseline (inline-flex centring, focus-visible
  reset, disabled opacity/cursor — now supplied by the core, stripped from the
  slot); the deliberate deltas it introduces are documented on the slot in
  planner.variants.ts.
-->
<div class={ctx.slot('header')}>
  <div class={ctx.slot('nav')}>
    <CoreIconButton
      class={ctx.slot('navButton')}
      onclick={() => ctx.navigate(-1)}
      disabled={!ctx.canGoBack || ctx.disabled}
      aria-label={prevLabel}
    >
      <ChevronLeftIcon size={16} />
    </CoreIconButton>
  </div>

  <span class={ctx.slot('headerTitle')}>{ctx.title}</span>

  <div class={ctx.slot('nav')}>
    <Tooltip label={bt('planner.today')}>
      <CoreIconButton
        class={ctx.slot('navButton')}
        onclick={() => ctx.goToToday()}
        disabled={!ctx.canGoToToday || ctx.disabled}
        aria-label={bt('planner.today')}
      >
        <CalendarDaysIcon size={16} />
      </CoreIconButton>
    </Tooltip>
    <CoreIconButton
      class={ctx.slot('navButton')}
      onclick={() => ctx.navigate(1)}
      disabled={!ctx.canGoForward || ctx.disabled}
      aria-label={nextLabel}
    >
      <ChevronRightIcon size={16} />
    </CoreIconButton>
  </div>
</div>
