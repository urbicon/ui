<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
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
