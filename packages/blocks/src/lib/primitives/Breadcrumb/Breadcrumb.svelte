<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { breadcrumbVariants, type BreadcrumbVariants } from './breadcrumb.variants';
  import type { BreadcrumbProps } from './index';

  let {
    items,
    size = 'md',
    separator,
    'aria-label': ariaLabel = 'Breadcrumb',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: BreadcrumbProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: BreadcrumbVariants = $derived({ size });

  const styles = $derived(breadcrumbVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Breadcrumb', preset, variantProps, slotClassesProp)
  );
</script>

<nav
  class={unstyled
    ? [slotClasses?.nav, className].filter(Boolean).join(' ')
    : styles.nav({ class: [slotClasses?.nav, className] })}
  aria-label={ariaLabel}
  {...restProps}
>
  <ol class={unstyled ? (slotClasses?.list ?? '') : styles.list({ class: slotClasses?.list })}>
    {#each items as item, i (`${item.label}-${i}`)}
      <li class={unstyled ? (slotClasses?.item ?? '') : styles.item({ class: slotClasses?.item })}>
        {#if i === items.length - 1}
          <span
            class={unstyled
              ? (slotClasses?.currentPage ?? '')
              : styles.currentPage({ class: slotClasses?.currentPage })}
            aria-current="page">{item.label}</span
          >
        {:else}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- BreadcrumbItem.href is opaque to the library -->
          <a
            href={item.href}
            class={unstyled ? (slotClasses?.link ?? '') : styles.link({ class: slotClasses?.link })}
            aria-label={item['aria-label']}
            onclick={item.onclick}
          >
            {item.label}
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
          <span
            class={unstyled
              ? (slotClasses?.separator ?? '')
              : styles.separator({ class: slotClasses?.separator })}
            aria-hidden="true"
          >
            {#if separator}
              {@render separator()}
            {:else}
              /
            {/if}
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
