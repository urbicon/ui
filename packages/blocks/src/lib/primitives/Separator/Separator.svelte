<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { separatorVariants } from './separator.variants';
  import type { SeparatorProps } from './index';

  let {
    orientation = 'horizontal',
    size = 'md',
    decorative = true,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SeparatorProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Separator?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Separator', preset),
      slotClassesProp
    )
  );

  const classes = $derived(
    [unstyled ? '' : separatorVariants({ orientation, size }), slotClasses?.base, className]
      .filter(Boolean)
      .join(' ')
  );
</script>

<div
  class={classes}
  role={decorative ? 'none' : 'separator'}
  aria-orientation={decorative ? undefined : orientation}
  {...restProps}
></div>
