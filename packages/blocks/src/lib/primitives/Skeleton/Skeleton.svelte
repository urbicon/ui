<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { skeletonVariants, type SkeletonVariants } from './skeleton.variants';
  import type { SkeletonProps } from './index';

  const bt = useBlocksI18n();

  let {
    variant = 'text',
    size = 'md',
    animation = 'pulse',
    width,
    height,
    count = 1,
    gap = 'gap-2',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SkeletonProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: SkeletonVariants = $derived({ variant, size, animation });
  const styles = $derived(skeletonVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Skeleton', preset, variantProps, slotClassesProp)
  );

  const inlineStyle = $derived(
    [width ? `width:${width}` : '', height ? `height:${height}` : ''].filter(Boolean).join(';') ||
      undefined
  );
</script>

{#if count > 1}
  <div
    class={unstyled
      ? [slotClasses?.wrapper, gap, className].filter(Boolean).join(' ')
      : styles.wrapper({ class: [slotClasses?.wrapper, gap, className] })}
    role="status"
    aria-label={bt('accessibility.loading')}
    {...restProps}
  >
    {#each Array(count) as _, i (i)}
      <div
        class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}
        style={inlineStyle}
        aria-hidden="true"
      ></div>
    {/each}
    <span class="sr-only">{bt('accessibility.loading')}…</span>
  </div>
{:else}
  <div
    class={unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })}
    style={inlineStyle}
    role="status"
    aria-label={bt('accessibility.loading')}
    {...restProps}
  >
    <span class="sr-only">{bt('accessibility.loading')}…</span>
  </div>
{/if}

<style>
  @keyframes blocks-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
