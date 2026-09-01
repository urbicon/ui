<script lang="ts">
  import { onMount } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { mintAttachment } from '$lib';
  import { resolveClassChain } from '$lib/utils/variants';
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
  // Tab stop ≠ active: with nothing selected the group falls back to its first
  // enabled segment so it stays reachable with Tab (see isTabStop in
  // SegmentGroup.svelte).
  const isTabStop = $derived(ctx.isTabStop(value));
  const isDisabled = $derived(disabled || ctx.disabled);

  const variantProps: SegmentGroupVariants = $derived({
    size: ctx.size,
    variant: ctx.variant,
    tier: ctx.tier
  });

  const styles = $derived(segmentGroupVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'SegmentItem',
      preset,
      variantProps,
      slotClassesProp,
      segmentGroupVariants.config
    )
  );

  onMount(() => {
    if (itemElement) {
      // The getter, not `isDisabled` itself: the group has to see the state
      // this segment is in *now*, and registration happens once. Passing the
      // value would freeze it at mount time — see RegisteredSegment.
      return ctx.registerItem(value, itemElement, () => isDisabled);
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
  {@attach mintAttachment(ctx.mint, { enabled: !isDisabled })}
  type="button"
  role="radio"
  class={unstyled
    ? resolveClassChain(slotClasses?.item, className)
    : styles.item({ class: [slotClasses?.item, className] })}
  aria-checked={isActive}
  tabindex={isTabStop ? 0 : -1}
  data-state={isActive ? 'active' : 'inactive'}
  disabled={isDisabled}
  onclick={handleClick}
  {...restProps}
>
  {@render children?.()}
</button>
