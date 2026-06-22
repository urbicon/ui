<script lang="ts">
  import { onMount } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { mintRegistry } from '$lib';
  import type { TabItemProps } from './index';
  import { getTabContext } from './tab.context';
  import { tabVariants, type TabVariants } from './tab.variants';

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

  let tabItemElement = $state<HTMLButtonElement>();
  const tabContext = getTabContext();

  if (!tabContext) {
    throw new Error('TabItem must be used within a Tab component');
  }

  const isActive = $derived(tabContext.isActive(value));
  const isDisabled = $derived(disabled || tabContext.disabled);

  const variantProps: TabVariants = $derived({
    variant: tabContext.variant,
    orientation: tabContext.orientation,
    size: tabContext.size,
    tier: tabContext.tier
  });

  const styles = $derived(tabVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'TabItem', preset, variantProps, slotClassesProp)
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
    <span class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}>
      {@render icon()}
    </span>
  {/if}

  <span class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}>
    {@render children()}
  </span>

  {#if badge}
    <span
      class={unstyled ? (slotClasses?.badge ?? '') : styles.badge({ class: slotClasses?.badge })}
    >
      {@render badge()}
    </span>
  {/if}
</button>
