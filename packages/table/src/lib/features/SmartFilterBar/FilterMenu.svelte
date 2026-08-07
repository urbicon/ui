<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { filterMenuVariants, smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Badge,
    Button,
    Popover,
    resolveIcon,
    FunnelIcon as FunnelIconDefault,
    CloseIcon as CloseIconDefault
  } from '@urbicon-ui/blocks';
  import FilterPanel from './FilterPanel.svelte';
  import MenuTrigger from './MenuTrigger.svelte';

  /**
   * The wide bar's filter tool: a popover holding {@link FilterPanel}.
   *
   * Shell only — trigger, panel frame, heading, dismiss. The form and the
   * actions that commit it belong to the panel, which is what lets the narrow
   * bar render the same form as a sheet section with no popover in sight.
   */
  const tt = useTableI18n();

  const FunnelIcon = resolveIcon('funnel', FunnelIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, view: tableView } = tableContext;

  let isOpen = $state(false);

  const activeFilters = $derived(tableView.filters);
  const isActive = $derived(activeFilters.length > 0);
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'filter' }) : undefined
  );

  const menuStyles = $derived(filterMenuVariants({ size: 'md' }));
</script>

{#snippet triggerIcon()}
  <FunnelIcon class="h-4 w-4" />
{/snippet}

{#snippet triggerCounter()}
  {#if isActive}
    <!-- `soft` for the same reason as SummaryMenu: `filled` leaks
         `border-primary` past the class override, and `text-on-primary` on
         the solid feature colour is under AA. The ground is the neutral
         surface rather than `filter-subtle`, which is what the lit trigger
         behind it now wears — same-on-same would have erased the counter. -->
    <Badge variant="soft" size="xs" counter class="bg-surface-base text-filter-emphasis ml-1">
      {activeFilters.length}
    </Badge>
  {/if}
{/snippet}

{#snippet triggerContent()}
  <MenuTrigger
    label={tt('filter.button.add')}
    active={isActive}
    {triggerClass}
    expanded={isOpen}
    haspopup="true"
    icon={triggerIcon}
    counter={triggerCounter}
  />
{/snippet}

<!--
  No inline `max-height` here. The panel used to carry
  `style="max-height: calc(100vh - 100px); overflow-y: auto"`, and an inline
  declaration beats a class selector — so it silently overrode the cap
  popoverVariants applies, which is the one that tracks the VISUAL viewport
  (`--blocks-overlay-available-height`, fed by useFloatingPanel) and therefore
  shrinks when the iOS keyboard opens. This form is the only tool with a text
  field, i.e. the only one that opens that keyboard. `100vh` was the second half
  of it: on iOS that is the LARGE viewport height, taller than what is on screen.
-->
<Popover
  bind:open={isOpen}
  placement="bottom-start"
  offsetDistance={8}
  onClickOutside={() => (isOpen = false)}
  trigger={triggerContent}
  role="dialog"
  class={menuStyles.base()}
>
  <div class={menuStyles.header()}>
    <h3 class={menuStyles.title()}>
      {tt('filter.menu.addFilter')}
    </h3>
    <Button
      variant="ghost"
      size="xs"
      onclick={() => (isOpen = false)}
      aria-label={tt('button.close')}
    >
      <CloseIcon class="h-4 w-4" />
    </Button>
  </div>

  <FilterPanel surface="popover" onApplied={() => (isOpen = false)} />
</Popover>
