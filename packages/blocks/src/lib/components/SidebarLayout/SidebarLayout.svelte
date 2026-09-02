<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Sidebar, type SidebarProps, sidebarVariants } from '$lib/primitives/Sidebar';
  import type { SidebarSlots } from '$lib/primitives/Sidebar/sidebar.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { SidebarForwardKey, SidebarLayoutProps } from './index';
  import { sidebarLayoutVariants, type SidebarLayoutVariants } from './sidebar-layout.variants';

  let {
    open = $bindable(false),
    mode = 'responsive',
    side = 'left',
    sidebarWidth = '16rem',
    closeOnEscape = true,
    closeOnBackdropClick = true,
    contentMaxWidth = 'xl',
    onOpenChange,
    sidebarHeader,
    sidebar,
    sidebarFooter,
    mobileHeader,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SidebarLayoutProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Mirror the Sidebar's effective-width logic so the layout root can expose
  // the value to the main content (the Sidebar's own --sidebar-effective-width
  // only inherits within the <aside> subtree, not to its siblings).
  const mobileQuery = new MediaQuery('(max-width: 1023px)');
  const isMobile = $derived(mobileQuery.current);
  const effectiveWidth = $derived(
    open || (mode === 'responsive' && !isMobile) ? sidebarWidth : '0px'
  );

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the layout's active variants. Annotated so
  // the string-literal `side`/`contentMaxWidth` props stay narrowed.
  const variantProps: SidebarLayoutVariants = $derived({ side, contentMaxWidth });

  const styles = $derived(sidebarLayoutVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'SidebarLayout',
      preset,
      variantProps,
      slotClassesProp,
      sidebarLayoutVariants.config
    )
  );

  // `Capitalize` has no runtime counterpart, so this is the one expression the
  // compiler cannot narrow on its own; annotating the key it builds is what
  // makes the prefix agree with the union that admits it.
  const capitalize = <S extends string>(value: S) =>
    (value.charAt(0).toUpperCase() + value.slice(1)) as Capitalize<S>;

  // Forward sidebar-related slotClasses to the embedded Sidebar, by walking
  // Sidebar's own slot names rather than pairing them off by hand. Three edits
  // to the five hand-written pairs this replaces compiled while reaching no
  // element: a mistyped source key, a swapped pair, and a deleted line (#346).
  // Only the first is unrepresentable here — there is no per-slot key left to
  // mistype, and the prefix is checked against the union it must match. The
  // other two stay writable and are caught by the sibling test instead, which
  // asserts that each key reaches its slot rather than how the map is spelt.
  const sidebarSlotClasses = $derived.by(() => {
    const forwarded: NonNullable<SidebarProps['slotClasses']> = {};
    for (const slot of Object.keys(sidebarVariants.config.slots ?? {}) as SidebarSlots[]) {
      const key: SidebarForwardKey = `sidebar${capitalize(slot)}`;
      const value = slotClasses?.[key];
      if (value) forwarded[slot] = value;
    }
    return forwarded;
  });

  function openSidebar() {
    open = true;
    onOpenChange?.(true);
  }

  function handleSidebarOpenChange(next: boolean) {
    open = next;
    onOpenChange?.(next);
  }
</script>

<div
  {...restProps}
  class={unstyled
    ? resolveClassChain(slotClasses?.root, className)
    : styles.root({ class: [slotClasses?.root, className] })}
  style:--sidebar-width={sidebarWidth}
  style:--sidebar-effective-width={effectiveWidth}
  data-side={side}
  data-mode={mode}
>
  <Sidebar
    bind:open
    {mode}
    {side}
    width={sidebarWidth}
    {closeOnEscape}
    {closeOnBackdropClick}
    onOpenChange={handleSidebarOpenChange}
    {unstyled}
    slotClasses={sidebarSlotClasses}
    header={sidebarHeader}
    footer={sidebarFooter}
  >
    {#if sidebar}
      {@render sidebar()}
    {/if}
  </Sidebar>

  {#if mobileHeader}
    <header
      class={unstyled
        ? (slotClasses?.mobileHeader ?? '')
        : styles.mobileHeader({ class: slotClasses?.mobileHeader })}
    >
      {@render mobileHeader({ openSidebar, sidebarOpen: open })}
    </header>
  {/if}

  <main
    id="main-content"
    class={unstyled ? (slotClasses?.main ?? '') : styles.main({ class: slotClasses?.main })}
  >
    <div
      class={unstyled ? (slotClasses?.inner ?? '') : styles.inner({ class: slotClasses?.inner })}
    >
      {@render children?.()}
    </div>
  </main>
</div>
