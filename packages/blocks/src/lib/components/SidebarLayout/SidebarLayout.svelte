<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Sidebar } from '$lib/primitives/Sidebar';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { SidebarLayoutProps } from './index';
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

  // Forward sidebar-related slotClasses to the embedded Sidebar.
  const sidebarSlotClasses = $derived({
    panel: slotClasses?.sidebar,
    backdrop: slotClasses?.sidebarBackdrop,
    header: slotClasses?.sidebarHeader,
    content: slotClasses?.sidebarContent,
    footer: slotClasses?.sidebarFooter
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
