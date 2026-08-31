<!--
  ResourceTimelineHeader — the default ResourceTimeline toolbar.

  prev / title / today / next. The bar itself is the shared
  `CoreDateGridHeader` (behaviour only, see internal/core/) — the same one
  PlannerHeader renders; what stays here is which i18n keys name the arrows and
  which variants slots paint them. The whole bar is replaceable via the `header`
  snippet; this is the fallback.
-->
<script lang="ts">
  import { useBlocksI18n } from '$lib';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreDateGridHeader from '$lib/internal/core/CoreDateGridHeader.svelte';
  import { getResourceTimelineContext } from './resource-timeline.context';

  const bt = useBlocksI18n();
  const ctx = getResourceTimelineContext();

  const labels = $derived({
    previous:
      ctx.view === 'week'
        ? bt('resourceTimeline.previousWeek')
        : bt('resourceTimeline.previousRange'),
    next: ctx.view === 'week' ? bt('resourceTimeline.nextWeek') : bt('resourceTimeline.nextRange'),
    today: bt('resourceTimeline.today')
  });
</script>

<CoreDateGridHeader
  unstyled={ctx.unstyled}
  {labels}
  title={ctx.title}
  canGoBack={ctx.canGoBack}
  canGoForward={ctx.canGoForward}
  canGoToToday={ctx.canGoToToday}
  disabled={ctx.disabled}
  navigate={(delta) => ctx.navigate(delta)}
  goToToday={() => ctx.goToToday()}
  slotClass={(slot) => ctx.slot(slot)}
/>
