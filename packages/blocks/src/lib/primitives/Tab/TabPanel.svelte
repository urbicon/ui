<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { TabPanelProps } from './index';
  import { getTabContext } from './tab.context';
  import { tabVariants } from './tab.variants';
  import { fade } from 'svelte/transition';

  let {
    value,
    children,
    lazy = false,
    keepMounted = false,
    transition = true,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: TabPanelProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.TabPanel?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'TabPanel', preset),
      slotClassesProp
    )
  );

  const tabContext = getTabContext();

  if (!tabContext) {
    throw new Error('TabPanel must be used within a Tab component');
  }

  const isActive = $derived(tabContext.isActive(value));
  let hasBeenActive = $state(false);

  $effect(() => {
    if (isActive) hasBeenActive = true;
  });

  const shouldRender = $derived.by(() => {
    if (isActive) return true;
    if (keepMounted) return true;
    if (!lazy || hasBeenActive) return true;
    return false;
  });

  const styles = $derived(
    tabVariants({
      size: tabContext.size
    })
  );
</script>

{#if shouldRender}
  <div
    role="tabpanel"
    id={`tabpanel-${value}`}
    aria-labelledby={`tab-${value}`}
    class={unstyled
      ? [slotClasses?.panel, className].filter(Boolean).join(' ')
      : styles.panel({ class: [slotClasses?.panel, className] })}
    hidden={!isActive}
    tabindex={isActive ? 0 : -1}
    data-state={isActive ? 'active' : 'inactive'}
    {...restProps}
  >
    {#if transition && isActive}
      <div transition:fade={{ duration: 150 }}>
        {@render children()}
      </div>
    {:else if isActive || keepMounted}
      {@render children()}
    {/if}
  </div>
{/if}

<style>
  [hidden] {
    display: none !important;
  }

  [role='tabpanel']:focus-visible {
    outline-offset: 4px;
  }
</style>
