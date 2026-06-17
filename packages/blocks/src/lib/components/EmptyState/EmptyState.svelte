<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { EmptyStateProps } from './index';
  import { emptyStateVariants } from './emptyState.variants';

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
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.EmptyState?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'EmptyState', preset),
      slotClassesProp
    )
  );

  const styles = $derived(unstyled ? undefined : emptyStateVariants({ density }));

  const iconSize = $derived(density === 'compact' ? 32 : 40);

  function slot(name: 'base' | 'iconWrapper' | 'title' | 'description' | 'children' | 'cta') {
    const base = styles?.[name]?.() ?? '';
    const override = slotClasses?.[name] ?? '';
    return [base, override].filter(Boolean).join(' ');
  }
</script>

<div {...rest} class={[slot('base'), className].filter(Boolean).join(' ')}>
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
