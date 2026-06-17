<script lang="ts">
  import { toolbarVariants } from './toolbar.variants';
  import type { ToolbarProps } from './index';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { setTierContext } from '$lib/utils/tier-context';

  let {
    children,
    variant = 'quiet',
    orientation = 'horizontal',
    gap = 'sm',
    padding = 'sm',
    tier = 'modify',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    'aria-label': ariaLabel,
    ...restProps
  }: ToolbarProps = $props();

  // Propagate tier to tier-aware descendants (Button, Badge, Input, …).
  // The Toolbar's own surface is `r-structure` (set by toolbarVariants) —
  // the propagated tier only affects interactive children.
  setTierContext({
    get tier() {
      return tier;
    }
  });

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Toolbar?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Toolbar', preset),
      slotClassesProp
    )
  );

  const styles = $derived(toolbarVariants({ variant, orientation, gap, padding }));
</script>

<div
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  role="toolbar"
  aria-orientation={orientation}
  aria-label={ariaLabel}
  {...restProps}
>
  {@render children()}
</div>
