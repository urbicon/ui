<!--
  ResourceTimelineHeader — the default ResourceTimeline toolbar.

  prev / title / today / next, reading mechanics from the ResourceTimeline
  context. The whole bar is replaceable via the `header` snippet; this is the
  fallback. Same shape as PlannerHeader, deliberately.
-->
<script lang="ts">
  import { useBlocksI18n } from '$lib';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import { resolveIcon } from '$lib/icons';
  import CalendarDaysIconDefault from '$lib/icons/CalendarDaysIcon.svelte';
  import ChevronLeftIconDefault from '$lib/icons/ChevronLeftIcon.svelte';
  import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
  import { Tooltip } from '$lib/primitives/Tooltip';
  import { getResourceTimelineContext } from './resource-timeline.context';

  const bt = useBlocksI18n();
  const ctx = getResourceTimelineContext();

  const ChevronLeftIcon = resolveIcon('chevronLeft', ChevronLeftIconDefault);
  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);
  const CalendarDaysIcon = resolveIcon('calendarDays', CalendarDaysIconDefault);

  const prevLabel = $derived(
    ctx.view === 'week' ? bt('resourceTimeline.previousWeek') : bt('resourceTimeline.previousRange')
  );
  const nextLabel = $derived(
    ctx.view === 'week' ? bt('resourceTimeline.nextWeek') : bt('resourceTimeline.nextRange')
  );
</script>

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
    <Tooltip label={bt('resourceTimeline.today')}>
      <CoreIconButton
        class={ctx.slot('navButton')}
        onclick={() => ctx.goToToday()}
        disabled={!ctx.canGoToToday || ctx.disabled}
        aria-label={bt('resourceTimeline.today')}
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
