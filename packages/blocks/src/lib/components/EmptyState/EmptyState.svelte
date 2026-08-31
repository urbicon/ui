<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { EmptyStateProps } from './index';
  import { emptyStateVariants, type EmptyStateVariants } from './emptyState.variants';

  let {
    icon: IconComponent,
    title,
    description,
    cta,
    children,
    density = 'default',
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...rest
  }: EmptyStateProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: EmptyStateVariants = $derived({ density });

  const styles = $derived(unstyled ? undefined : emptyStateVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'EmptyState', preset, variantProps, slotClassesProp)
  );

  const iconSize = $derived(density === 'compact' ? 32 : 40);

  function slot(
    name: 'base' | 'iconWrapper' | 'title' | 'description' | 'children' | 'cta',
    extra?: string
  ) {
    const overrides = resolveClassChain(slotClasses?.[name], extra);
    return styles?.[name]?.({ class: overrides }) ?? overrides;
  }
</script>

<div {...rest} class={slot('base', className)}>
  {#if IconComponent}
    <div class={slot('iconWrapper')}>
      <IconComponent size={iconSize} />
    </div>
  {/if}

  <h3 class={slot('title')}>
    {title}
  </h3>

  {#if description}
    <p class={slot('description')}>
      {description}
    </p>
  {/if}

  {#if children}
    <div class={slot('children')}>
      {@render children()}
    </div>
  {/if}

  {#if cta}
    <div class={slot('cta')}>
      {@render cta()}
    </div>
  {/if}
</div>
