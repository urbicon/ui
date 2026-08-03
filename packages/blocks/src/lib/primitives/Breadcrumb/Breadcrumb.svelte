<script lang="ts">
  import { tick } from 'svelte';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { breadcrumbVariants, type BreadcrumbVariants } from './breadcrumb.variants';
  import type { BreadcrumbProps, BreadcrumbItem } from './index';

  const bt = useBlocksI18n();

  let {
    items,
    size = 'md',
    wrap = true,
    separator,
    maxItems,
    itemsBeforeCollapse = 1,
    itemsAfterCollapse = 1,
    // A11y labels default to the localized `accessibility.*` strings in the
    // markup below (resolved per render, so a locale switch updates them) —
    // Breadcrumb was the last primitive with built-in English-only strings.
    expandLabel,
    'aria-label': ariaLabel,
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

  // A per-item icon is sized absolutely, never off its wrapper. An <svg> with a
  // viewBox and no width/height is a replaced box with a ratio but no intrinsic
  // size, so a percentage size resolves against its containing block — in an
  // `unstyled` trail, where the `icon` slot is only what the consumer passed
  // and may be empty, that is the crumb link itself: a `size-full` glyph took
  // the link's whole width instead of 16px, so the damage grew with the trail
  // (96×96 measured in the docs app, 338×338 in a wider repro). Hardcoding it
  // here is what every other
  // embedded icon in the library does (MenuItem, Dialog, Alert, Drawer,
  // GuidePanel); the map exists because Breadcrumb has a size axis they lack.
  const GLYPH_SIZE = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const;
  const glyphSize = $derived(GLYPH_SIZE[size]);

  type BreadcrumbEntry =
    { kind: 'item'; item: BreadcrumbItem; current: boolean } | { kind: 'ellipsis' };

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

<!--
  Per-item leading icon. Decorative by contract: the wrapper is `aria-hidden`,
  so the crumb's accessible name stays its `label` and a screen reader does not
  announce the glyph twice. Menu/Tab lean on the `aria-hidden` that
  `IconWrapper` puts on its own `<svg>`, which only holds for icons built on it
  — spelling it out here also covers a consumer-supplied icon component.
  Ellipsis entries carry no item and are therefore untouched by this.
-->
{#snippet crumbIcon(item: BreadcrumbItem)}
  {#if item.icon}
    {@const ItemIcon = item.icon}
    <span
      class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}
      aria-hidden="true"><ItemIcon class={glyphSize} /></span
    >
  {/if}
{/snippet}

<nav
  bind:this={navEl}
  class={unstyled
    ? [slotClasses?.nav, className].filter(Boolean).join(' ')
    : styles.nav({ class: [slotClasses?.nav, className] })}
  aria-label={ariaLabel ?? bt('accessibility.breadcrumb')}
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
            aria-label={expandLabel ?? bt('accessibility.breadcrumbExpand')}
            onclick={expand}
          >
            …
          </button>
        {:else if entry.current}
          <!--
            `aria-label` reaches the current page too, not just the links. It
            used to be read only in the <a> branch, which made an icon-led last
            crumb (short or empty `label` + an aria-hidden icon) announce as an
            empty list item. Chrome does expose an author name on this span
            despite its generic role — checked in the a11y tree, where it reads
            back as the element's name.
          -->
          <span
            class={unstyled
              ? (slotClasses?.currentPage ?? '')
              : styles.currentPage({ class: slotClasses?.currentPage })}
            aria-label={entry.item['aria-label']}
            aria-current="page">{@render crumbIcon(entry.item)}{entry.item.label}</span
          >
        {:else}
          <!-- BreadcrumbItem.href is opaque to the library; resolve() is the consumer's responsibility. -->
          <a
            href={entry.item.href}
            class={unstyled ? (slotClasses?.link ?? '') : styles.link({ class: slotClasses?.link })}
            aria-label={entry.item['aria-label']}
            onclick={entry.item.onclick}>{@render crumbIcon(entry.item)}{entry.item.label}</a
          >
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
