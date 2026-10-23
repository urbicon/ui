<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses, useThemeProps } from '#lib/provider/index.js';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import type { SeparatorProps } from './index';
  import { separatorVariants } from './separator.variants';

  const theme = useThemeProps('Separator', () => preset);

  let {
    preset,
    orientation = 'horizontal',
    size = theme.size ?? 'md',
    decorative = true,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    ...restProps
  }: SeparatorProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Separator',
      preset,
      { orientation, size },
      slotClassesProp,
      separatorVariants.config
    )
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
