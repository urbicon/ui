<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
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
    resolveSlotClasses(blocksConfig, 'Separator', preset, { orientation, size }, slotClassesProp)
  );

  const classes = $derived(
    unstyled
      ? resolveClassChain(slotClasses?.base, className)
      : separatorVariants({ orientation, size, class: [slotClasses?.base, className] })
  );
</script>

<div
  class={classes}
  role={decorative ? 'none' : 'separator'}
  aria-orientation={decorative ? undefined : orientation}
  {...restProps}
></div>
