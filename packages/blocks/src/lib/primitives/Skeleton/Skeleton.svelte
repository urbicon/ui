<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
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
    gap,
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
    resolveSlotClasses(
      blocksConfig,
      'Skeleton',
      preset,
      variantProps,
      slotClassesProp,
      skeletonVariants.config
    )
  );

  const inlineStyle = $derived(
    [width ? `width:${width}` : '', height ? `height:${height}` : ''].filter(Boolean).join(';') ||
      undefined
  );

  // `width={200}` is the most natural thing to write and the one thing that
  // cannot work: `width:200` is invalid CSS, so the browser drops the whole
  // declaration without a word and the skeleton keeps its default size. Say so
  // rather than quietly coercing to px — a silent unit guess would be wrong the
  // first time someone means `200%`.
  if (import.meta.env?.DEV) {
    $effect(() => {
      for (const [prop, value] of [
        ['width', width],
        ['height', height]
      ] as const) {
        if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)))
          console.warn(
            `[Skeleton] ${prop}="${value}" has no CSS unit, so the browser discards it and the ` +
              `skeleton keeps its default ${prop}. Write "${value}px", "${value}%" or "${value}rem".`
          );
      }
    });
  }
</script>

{#if count > 1}
  <div
    class={unstyled
      ? resolveClassChain(slotClasses?.wrapper, gap, className)
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
      ? resolveClassChain(slotClasses?.base, className)
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
