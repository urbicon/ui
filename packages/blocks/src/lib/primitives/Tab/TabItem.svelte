<script lang="ts">
  import { onMount } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { mintAttachment } from '$lib';
  import { resolveClassChain } from '$lib/utils/variants';
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
  // Tab stop ≠ active: a disabled active tab cannot hold focus, so the stop
  // moves rather than stranding there (see isTabStop in Tab.svelte).
  const isTabStop = $derived(tabContext.isTabStop(value));

  const variantProps: TabVariants = $derived({
    variant: tabContext.variant,
    orientation: tabContext.orientation,
    size: tabContext.size,
    tier: tabContext.tier,
    fullWidth: tabContext.fullWidth
  });

  const styles = $derived(tabVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'TabItem', preset, variantProps, slotClassesProp)
  );

  onMount(() => {
    if (tabItemElement) {
      // The getter, not `isDisabled` itself: the tablist has to see the state
      // this tab is in *now*, and registration happens once. Passing the value
      // would freeze it at mount time — see RegisteredTab.
      return tabContext.registerTab(value, tabItemElement, () => isDisabled);
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
  {@attach mintAttachment(tabContext.mint, { enabled: !isDisabled })}
  type="button"
  role="tab"
  class={unstyled
    ? resolveClassChain(slotClasses?.trigger, className)
    : styles.trigger({ class: [slotClasses?.trigger, className] })}
  aria-selected={isActive}
  aria-controls={tabContext.hasPanel(value) ? `tabpanel-${value}` : undefined}
  id={`tab-${value}`}
  tabindex={isTabStop ? 0 : -1}
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
