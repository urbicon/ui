<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses, useThemeProps } from '#lib/provider/index.js';
  import { headingTag } from '#lib/utils/heading.js';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import { type EmptyStateVariants, emptyStateVariants } from './emptyState.variants';
  import type { EmptyStateProps } from './index';

  const theme = useThemeProps('EmptyState', () => preset);

  let {
    preset,
    icon: IconComponent,
    title,
    headingLevel = 3,
    description,
    cta,
    children,
    density = theme.density ?? 'default',
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    ...rest
  }: EmptyStateProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: EmptyStateVariants = $derived({ density });

  const styles = $derived(unstyled ? undefined : emptyStateVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'EmptyState',
      preset,
      variantProps,
      slotClassesProp,
      emptyStateVariants.config
    )
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

  <svelte:element this={headingTag(headingLevel)} class={slot('title')}>
    {title}
  </svelte:element>

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
