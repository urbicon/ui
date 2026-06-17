<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { breadcrumbVariants } from './breadcrumb.variants';
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
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Breadcrumb?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Breadcrumb', preset),
      slotClassesProp
    )
  );

  const styles = $derived(
    unstyled
      ? {
          nav: () => '',
          list: () => '',
          item: () => '',
          link: () => '',
          currentPage: () => '',
          separator: () => ''
        }
      : breadcrumbVariants({ size })
  );

  function slot(key: keyof typeof styles, extra?: string) {
    const overrides = [slotClasses?.[key], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
    return styles[key]({ class: overrides });
  }
</script>

<nav class={slot('nav', className)} aria-label={ariaLabel} {...restProps}>
  <ol class={slot('list')}>
    {#each items as item, i (`${item.label}-${i}`)}
      <li class={slot('item')}>
        {#if i === items.length - 1}
          <span class={slot('currentPage')} aria-current="page">{item.label}</span>
        {:else}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- BreadcrumbItem.href is opaque to the library -->
          <a
            href={item.href}
            class={slot('link')}
            aria-label={item['aria-label']}
            onclick={item.onclick}
          >
            {item.label}
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
          <span class={slot('separator')} aria-hidden="true">
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
