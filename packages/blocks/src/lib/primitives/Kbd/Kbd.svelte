<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { kbdVariants } from './kbd.variants';
  import type { KbdProps } from './index';

  let {
    keys,
    separator = '+',
    size = 'md',
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: KbdProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Kbd', preset, { size }, slotClassesProp)
  );

  const styles = $derived(unstyled ? null : kbdVariants({ size }));

  const keyList = $derived(keys === undefined ? [] : Array.isArray(keys) ? keys : [keys]);

  const baseClass = $derived(
    styles
      ? styles.base({ class: [slotClasses?.base, className] })
      : resolveClassChain(slotClasses?.base, className)
  );
  const separatorClass = $derived(
    styles ? styles.separator({ class: slotClasses?.separator }) : (slotClasses?.separator ?? '')
  );
</script>

<kbd class={baseClass} {...restProps}>
  {#if children}
    {@render children()}
  {:else}
    {#each keyList as key, i (`${i}-${key}`)}
      {#if i > 0}<span class={separatorClass}>{separator}</span>{/if}<span>{key}</span>
    {/each}
  {/if}
</kbd>
