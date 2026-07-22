<script lang="ts">
  import { toolbarVariants, type ToolbarVariants } from './toolbar.variants';
  import type { ToolbarProps } from './index';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
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

  const variantProps: ToolbarVariants = $derived({ variant, orientation, gap, padding });
  const styles = $derived(toolbarVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Toolbar', preset, variantProps, slotClassesProp)
  );
</script>

<!--
  restProps spreads FIRST so component-owned state wins (COMPONENT-API-CONVENTIONS
  §restProps ordering) — a consumer role through restProps must not defeat the
  toolbar semantics. No conditional merges are needed here (unlike
  Button/ButtonGroup), because every attribute after the spread is always
  defined: role is static, `orientation` has a default, and `aria-label` is a
  required prop destructured out of restProps. `aria-orientation` is valid on
  role=toolbar on both arms, so there is no removal case; `aria-labelledby`
  and other native/data-* attributes pass through the spread untouched.
-->
<div
  {...restProps}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  role="toolbar"
  aria-orientation={orientation}
  aria-label={ariaLabel}
>
  {@render children()}
</div>
