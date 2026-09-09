<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Sidebar, type SidebarProps, sidebarVariants } from '$lib/primitives/Sidebar';
  import type { SidebarSlots } from '$lib/primitives/Sidebar/sidebar.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useDisclosure } from '$lib/utils/use-disclosure.svelte';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { SidebarForwardKey, SidebarLayoutProps } from './index';
  import {
    SIDEBAR_TOGGLE_GUTTER,
    sidebarLayoutVariants,
    type SidebarLayoutVariants
  } from './sidebar-layout.variants';

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
    toggle,
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

  // The rail grip only exists where `open` actually moves the panel: a
  // `responsive` sidebar is permanent on desktop, so a toggle there would
  // change nothing the user can see. On mobile the header carries the snippet
  // instead.
  const railGrip = $derived(!!toggle && mode === 'collapsible');
  // Widens `main`'s offset by the strip the grip floats in. Placed BEFORE
  // `slotClasses.main` in the fold, so a consumer override of that padding
  // still wins.
  const railGutter = $derived(railGrip ? SIDEBAR_TOGGLE_GUTTER[side] : undefined);

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
  // asserts the reach rather than the spelling: which slot a key lands on, not
  // merely that it landed, since a crossed pair leaves every marker on a
  // distinct element and passes the weaker question.
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

  const propsId = $props.id();
  const panelId = `sidebar-layout-${propsId}-panel`;

  // One disclosure per render site of the `toggle` snippet. Both are
  // controlled by the same `open`, so they carry no state of their own and
  // cannot disagree; what differs is only the trigger id, which is what keeps
  // the rail and header copies of the snippet from writing the same DOM id
  // (both are in the document at once — only CSS hides one).
  const railToggle = useDisclosure(() => ({
    open,
    triggerId: `sidebar-layout-${propsId}-rail-toggle`,
    contentId: panelId,
    onOpenChange: handleSidebarOpenChange
  }));
  const headerToggle = useDisclosure(() => ({
    open,
    triggerId: `sidebar-layout-${propsId}-header-toggle`,
    contentId: panelId,
    onOpenChange: handleSidebarOpenChange
  }));
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
    id={toggle ? panelId : undefined}
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

  {#if toggle && railGrip}
    <div
      class={unstyled
        ? (slotClasses?.toggleRail ?? '')
        : styles.toggleRail({ class: slotClasses?.toggleRail })}
    >
      {@render toggle({
        open,
        toggle: railToggle.toggle,
        triggerId: railToggle.triggerProps.id,
        contentId: panelId,
        triggerProps: railToggle.triggerProps
      })}
    </div>
  {/if}

  {#if mobileHeader || toggle}
    <header
      class={unstyled
        ? (slotClasses?.mobileHeader ?? '')
        : styles.mobileHeader({ class: slotClasses?.mobileHeader })}
    >
      {#if toggle}
        {@render toggle({
          open,
          toggle: headerToggle.toggle,
          triggerId: headerToggle.triggerProps.id,
          contentId: panelId,
          triggerProps: headerToggle.triggerProps
        })}
      {/if}
      {#if mobileHeader}
        {@render mobileHeader({ openSidebar, toggle: headerToggle.toggle, sidebarOpen: open })}
      {/if}
    </header>
  {/if}

  <main
    id="main-content"
    class={unstyled
      ? (slotClasses?.main ?? '')
      : styles.main({ class: [railGutter, slotClasses?.main] })}
  >
    <div
      class={unstyled ? (slotClasses?.inner ?? '') : styles.inner({ class: slotClasses?.inner })}
    >
      {@render children?.()}
    </div>
  </main>
</div>
