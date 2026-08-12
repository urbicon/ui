<!--
  CoreDateGridHeader — behaviour-only internal core for the small date-surface
  toolbar: `‹ · title · today ›`, one line, four controls.

  Planner and ResourceTimeline both showed this bar and both wrote it out in
  full — 35 lines of identical markup in each (of 83- and 68-line files), wired
  to the same three icons and the same Tooltip, differing only in which i18n keys
  they read and which variants slots they styled with. Their four toolbar slots
  were byte-identical too, base and all three sizes; that copy is now
  `date-grid-header-slots.ts` next door (#191).

  CalendarHeader is NOT a caller: it carries a month picker, a view switcher and
  a narrow-viewport grid, names its title slot `title` rather than `headerTitle`,
  and resolves slots with a second `extra` argument — genuinely more than a
  shared core should know.

  The split, as everywhere in internal/core: BEHAVIOUR here (layout, buttons,
  the today tooltip, aria wiring, the bound gating), LOOK at the call site. The
  caller passes a `slotClass` resolver over its own tv() slots, so the classes
  stay part of each surface's public `slotClasses` surface and a preset or a
  provider override still reaches them — even though the two surfaces currently
  resolve to the same shared table. Labels are the caller's outright:
  `planner.previousWeek` and `resourceTimeline.previousRange` are different keys
  with different words.

  INTERNAL — never exported from the package barrel, no docs/MCP entry.
-->
<script lang="ts">
  import { resolveIcon } from '$lib/icons';
  import CalendarDaysIconDefault from '$lib/icons/CalendarDaysIcon.svelte';
  import ChevronLeftIconDefault from '$lib/icons/ChevronLeftIcon.svelte';
  import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
  import { Tooltip } from '$lib/primitives/Tooltip';
  import CoreIconButton from './CoreIconButton.svelte';

  /** The four slots this bar styles. Both callers name them identically, so the
   * resolver below is assignable from either context's `slot()`. */
  type CoreDateGridHeaderSlot = 'header' | 'nav' | 'navButton' | 'headerTitle';

  let {
    title,
    labels,
    canGoBack,
    canGoForward,
    canGoToToday,
    disabled = false,
    navigate,
    goToToday,
    slotClass
  }: {
    /** Localized title of the current window. */
    title: string;
    /** Accessible names, in the caller's own words (its i18n keys). */
    labels: { previous: string; next: string; today: string };
    canGoBack: boolean;
    canGoForward: boolean;
    canGoToToday: boolean;
    disabled?: boolean;
    /** Step the window by `delta` (− back, + forward). */
    navigate: (delta: number) => void;
    goToToday: () => void;
    /** Resolve one of the four slots against the caller's variants + slotClasses. */
    slotClass: (slot: CoreDateGridHeaderSlot) => string;
  } = $props();

  const ChevronLeftIcon = resolveIcon('chevronLeft', ChevronLeftIconDefault);
  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);
  const CalendarDaysIcon = resolveIcon('calendarDays', CalendarDaysIconDefault);
</script>

<div class={slotClass('header')}>
  <div class={slotClass('nav')}>
    <CoreIconButton
      class={slotClass('navButton')}
      onclick={() => navigate(-1)}
      disabled={!canGoBack || disabled}
      aria-label={labels.previous}
    >
      <ChevronLeftIcon size={16} />
    </CoreIconButton>
  </div>

  <span class={slotClass('headerTitle')}>{title}</span>

  <div class={slotClass('nav')}>
    <Tooltip label={labels.today}>
      <CoreIconButton
        class={slotClass('navButton')}
        onclick={() => goToToday()}
        disabled={!canGoToToday || disabled}
        aria-label={labels.today}
      >
        <CalendarDaysIcon size={16} />
      </CoreIconButton>
    </Tooltip>
    <CoreIconButton
      class={slotClass('navButton')}
      onclick={() => navigate(1)}
      disabled={!canGoForward || disabled}
      aria-label={labels.next}
    >
      <ChevronRightIcon size={16} />
    </CoreIconButton>
  </div>
</div>
