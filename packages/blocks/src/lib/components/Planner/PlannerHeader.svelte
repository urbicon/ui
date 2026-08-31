<!--
  PlannerHeader — the default Planner toolbar.

  prev / title / today / next. The bar itself is the shared
  `CoreDateGridHeader` (behaviour only, see internal/core/); what stays here is
  what is Planner's: which i18n keys name the arrows, and which variants slots
  paint them. The whole bar is replaceable via Planner's `header` snippet; this
  is the fallback.

  Nav buttons render on the internal CoreIconButton (was `<Button unstyled
  mint="none">`, which emitted only the call-site classes). The core's plumbing
  overlaps the navButton slot's old baseline (inline-flex centring, focus-visible
  reset, disabled opacity/cursor — now supplied by the core, stripped from the
  slot); the deliberate deltas it introduces are documented on the slot in
  planner.variants.ts.
-->
<script lang="ts">
  import { useBlocksI18n } from '$lib';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreDateGridHeader from '$lib/internal/core/CoreDateGridHeader.svelte';
  import { getPlannerContext } from './planner.context';

  const bt = useBlocksI18n();
  const ctx = getPlannerContext();

  const labels = $derived({
    previous:
      ctx.view === 'month'
        ? bt('planner.previousMonth')
        : ctx.view === 'range'
          ? bt('planner.previousRange')
          : bt('planner.previousWeek'),
    next:
      ctx.view === 'month'
        ? bt('planner.nextMonth')
        : ctx.view === 'range'
          ? bt('planner.nextRange')
          : bt('planner.nextWeek'),
    today: bt('planner.today')
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
