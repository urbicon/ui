<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { TabPanelProps } from './index';
  import { getTabContext } from './tab.context';
  import { tabVariants, type TabVariants } from './tab.variants';
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

  // Claim the value while the panel's element is actually in the DOM — keyed
  // on shouldRender, not on mount, so a lazy panel that has never been active
  // (its id does not exist yet) draws no aria-controls on its TabItem (#109).
  //
  // Effects do not run during SSR, so server-rendered tabs carry no
  // `aria-controls` and gain it on hydration. That is the safe direction: the
  // attribute is optional on `role="tab"`, while pointing it at an id that is
  // not in the document is an axe violation — which is what the unconditional
  // version did for lazy and consumer-rendered panels.
  $effect(() => {
    if (shouldRender) {
      return tabContext.registerPanel(value);
    }
  });

  const variantProps: TabVariants = $derived({
    size: tabContext.size,
    orientation: tabContext.orientation
  });

  const styles = $derived(tabVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'TabPanel', preset, variantProps, slotClassesProp)
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
