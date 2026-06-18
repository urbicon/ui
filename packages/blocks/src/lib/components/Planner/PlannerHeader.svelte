<!--
  PlannerHeader — the default Planner toolbar.

  prev / title / today / next, reading mechanics from the Planner context. The
  whole bar is replaceable via Planner's `header` snippet; this is the fallback.
-->
<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Button } from '$lib/primitives/Button';
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

<div class={ctx.slot('header')}>
  <div class={ctx.slot('nav')}>
    <Button
      unstyled
      mint="none"
      class={ctx.slot('navButton')}
      onclick={() => ctx.navigate(-1)}
      disabled={!ctx.canGoBack || ctx.disabled}
      aria-label={prevLabel}
    >
      <ChevronLeftIcon size={16} />
    </Button>
  </div>

  <span class={ctx.slot('headerTitle')}>{ctx.title}</span>

  <div class={ctx.slot('nav')}>
    <Tooltip label={bt('planner.today')}>
      <Button
        unstyled
        mint="none"
        class={ctx.slot('navButton')}
        onclick={() => ctx.goToToday()}
        disabled={ctx.disabled}
        aria-label={bt('planner.today')}
      >
        <CalendarDaysIcon size={16} />
      </Button>
    </Tooltip>
    <Button
      unstyled
      mint="none"
      class={ctx.slot('navButton')}
      onclick={() => ctx.navigate(1)}
      disabled={!ctx.canGoForward || ctx.disabled}
      aria-label={nextLabel}
    >
      <ChevronRightIcon size={16} />
    </Button>
  </div>
</div>
