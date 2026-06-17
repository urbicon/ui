<script lang="ts">
  import { onMount } from 'svelte';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { mintRegistry } from '$lib';
  import type { TabItemProps } from './index';
  import { getTabContext } from './tab.context';
  import { tabVariants } from './tab.variants';

  let {
    value,
    children,
    disabled = false,
    icon,
    badge,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: TabItemProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.TabItem?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'TabItem', preset),
      slotClassesProp
    )
  );

  let tabItemElement = $state<HTMLButtonElement>();
  const tabContext = getTabContext();

  if (!tabContext) {
    throw new Error('TabItem must be used within a Tab component');
  }

  const isActive = $derived(tabContext.isActive(value));
  const isDisabled = $derived(disabled || tabContext.disabled);

  const styles = $derived(
    tabVariants({
      variant: tabContext.variant,
      orientation: tabContext.orientation,
      size: tabContext.size,
      tier: tabContext.tier
    })
  );

  onMount(() => {
    if (tabItemElement) {
      return tabContext.registerTab(value, tabItemElement);
    }
  });

  $effect(() => {
    const mint = tabContext.mint;
    if (tabItemElement && mint && mint !== 'none' && !isDisabled) {
      return mintRegistry.apply(tabItemElement, mint);
    }
  });

  function handleClick() {
    if (!isDisabled) {
      tabContext.selectTab(value);
    }
  }
</script>

<button
  bind:this={tabItemElement}
  type="button"
  role="tab"
  class={unstyled
    ? [slotClasses?.trigger, className].filter(Boolean).join(' ')
    : styles.trigger({ class: [slotClasses?.trigger, className] })}
  aria-selected={isActive}
  aria-controls={`tabpanel-${value}`}
  id={`tab-${value}`}
  tabindex={isActive ? 0 : -1}
  data-state={isActive ? 'active' : 'inactive'}
  disabled={isDisabled}
  onclick={handleClick}
  {...restProps}
>
  {#if icon}
    <span class={unstyled ? '' : styles.icon()}>
      {@render icon()}
    </span>
  {/if}

  <span class={unstyled ? '' : styles.label()}>
    {@render children()}
  </span>

  {#if badge}
    <span class={unstyled ? '' : styles.badge()}>
      {@render badge()}
    </span>
  {/if}
</button>
