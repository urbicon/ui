<script lang="ts">
  import { onMount } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { mintRegistry } from '$lib';
  import { segmentGroupVariants, type SegmentGroupVariants } from './segmentgroup.variants';
  import { getSegmentGroupContext } from './segmentGroup.context';
  import type { SegmentItemProps } from './index';

  let {
    value,
    children,
    disabled = false,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SegmentItemProps = $props();

  const ctx = getSegmentGroupContext();
  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || ctx.unstyled || blocksConfig?.unstyled || false);

  let itemElement = $state<HTMLButtonElement>();

  const isActive = $derived(ctx.isActive(value));
  const isDisabled = $derived(disabled || ctx.disabled);

  const variantProps: SegmentGroupVariants = $derived({
    size: ctx.size,
    appearance: ctx.appearance,
    tier: ctx.tier
  });

  const styles = $derived(segmentGroupVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'SegmentItem', preset, variantProps, slotClassesProp)
  );

  onMount(() => {
    if (itemElement) {
      return ctx.registerItem(value, itemElement);
    }
  });

  $effect(() => {
    const mint = ctx.mint;
    if (itemElement && mint && mint !== 'none' && !isDisabled) {
      return mintRegistry.apply(itemElement, mint);
    }
  });

  function handleClick() {
    if (!isDisabled) {
      ctx.selectItem(value);
    }
  }
</script>

<button
  bind:this={itemElement}
  type="button"
  role="radio"
  class={unstyled
    ? [slotClasses?.item, className].filter(Boolean).join(' ')
    : styles.item({ class: [slotClasses?.item, className] })}
  aria-checked={isActive}
  tabindex={isActive ? 0 : -1}
  data-state={isActive ? 'active' : 'inactive'}
  disabled={isDisabled}
  onclick={handleClick}
  {...restProps}
>
  {@render children?.()}
</button>
