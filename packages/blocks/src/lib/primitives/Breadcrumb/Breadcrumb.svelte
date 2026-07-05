<script lang="ts">
  import { tick } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { breadcrumbVariants, type BreadcrumbVariants } from './breadcrumb.variants';
  import type { BreadcrumbProps, BreadcrumbItem } from './index';

  let {
    items,
    size = 'md',
    wrap = true,
    separator,
    maxItems,
    itemsBeforeCollapse = 1,
    itemsAfterCollapse = 1,
    expandLabel = 'Show all breadcrumb items',
    'aria-label': ariaLabel = 'Breadcrumb',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: BreadcrumbProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: BreadcrumbVariants = $derived({ size, wrap });

  const styles = $derived(breadcrumbVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Breadcrumb', preset, variantProps, slotClassesProp)
  );

  // Long trails collapse their middle into a single "…" affordance. Clicking
  // it expands the full trail for the rest of the component's life — the
  // established expandable-breadcrumb pattern. `before`/`after` clamp to sane
  // bounds and the current page (last item) is always kept visible.
  let expanded = $state(false);
  let navEl = $state<HTMLElement>();

  const before = $derived(Math.max(0, itemsBeforeCollapse));
  const after = $derived(Math.max(1, itemsAfterCollapse));

  type BreadcrumbEntry =
    | { kind: 'item'; item: BreadcrumbItem; current: boolean }
    | { kind: 'ellipsis' };

  const entries = $derived.by((): BreadcrumbEntry[] => {
    const last = items.length - 1;
    const collapse =
      maxItems != null &&
      maxItems > 0 &&
      !expanded &&
      items.length > maxItems &&
      // Only worth it when "…" actually replaces ≥2 items — folding a single
      // hidden item saves no space and just adds an interaction.
      items.length - before - after >= 2;

    if (!collapse) {
      return items.map((item, i) => ({ kind: 'item' as const, item, current: i === last }));
    }

    const result: BreadcrumbEntry[] = [];
    for (let i = 0; i < before; i++) {
      result.push({ kind: 'item', item: items[i], current: false });
    }
    result.push({ kind: 'ellipsis' });
    for (let i = items.length - after; i < items.length; i++) {
      result.push({ kind: 'item', item: items[i], current: i === last });
    }
    return result;
  });

  function expand() {
    expanded = true;
    // Keep keyboard focus inside the trail: land on the first item that was
    // hidden (now revealed) rather than dropping to the top of the page when
    // the "…" button unmounts. Head items are links 0…before-1, so the first
    // revealed item is link index `before`.
    const target = before;
    tick().then(() => {
      navEl?.querySelectorAll<HTMLAnchorElement>('a')[target]?.focus();
    });
  }
</script>

<nav
  bind:this={navEl}
  class={unstyled
    ? [slotClasses?.nav, className].filter(Boolean).join(' ')
    : styles.nav({ class: [slotClasses?.nav, className] })}
  aria-label={ariaLabel}
  {...restProps}
>
  <ol class={unstyled ? (slotClasses?.list ?? '') : styles.list({ class: slotClasses?.list })}>
    {#each entries as entry, i (entry.kind === 'ellipsis' ? 'ellipsis' : `${entry.item.label}-${i}`)}
      <li class={unstyled ? (slotClasses?.item ?? '') : styles.item({ class: slotClasses?.item })}>
        {#if entry.kind === 'ellipsis'}
          <button
            type="button"
            class={unstyled
              ? (slotClasses?.ellipsis ?? '')
              : styles.ellipsis({ class: slotClasses?.ellipsis })}
            aria-label={expandLabel}
            onclick={expand}
          >
            …
          </button>
        {:else if entry.current}
          <span
            class={unstyled
              ? (slotClasses?.currentPage ?? '')
              : styles.currentPage({ class: slotClasses?.currentPage })}
            aria-current="page">{entry.item.label}</span
          >
        {:else}
          <!-- BreadcrumbItem.href is opaque to the library; resolve() is the consumer's responsibility. -->
          <a
            href={entry.item.href}
            class={unstyled ? (slotClasses?.link ?? '') : styles.link({ class: slotClasses?.link })}
            aria-label={entry.item['aria-label']}
            onclick={entry.item.onclick}
          >
            {entry.item.label}
          </a>
        {/if}
        {#if i < entries.length - 1}
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
