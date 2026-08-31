<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { quintOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import type { SidebarProps } from './index';
  import { sidebarVariants, type SidebarVariants } from './sidebar.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { lockBodyScroll } from '$lib/utils/overlay';
  import { overlayStack } from '$lib/utils';
  import { resolveClassChain } from '$lib/utils/variants';

  let {
    open = $bindable(false),
    mode = 'responsive',
    side = 'left',
    width = '16rem',
    closeOnEscape = true,
    closeOnBackdropClick = true,
    onOpenChange,
    header,
    footer,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SidebarProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: SidebarVariants = $derived({ side, mode });
  const styles = $derived(sidebarVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Sidebar', preset, variantProps, slotClassesProp)
  );

  const panelTransform = $derived(
    open ? 'translateX(0)' : side === 'left' ? 'translateX(-100%)' : 'translateX(100%)'
  );

  const mobileQuery = new MediaQuery('(max-width: 1023px)');
  const isMobile = $derived(mobileQuery.current);
  let previouslyFocused: HTMLElement | null = null;
  const propsId = $props.id();
  const overlayId = `sidebar-${propsId}`;

  // In collapsible mode on desktop, width drives visibility (0 when closed).
  // On mobile (both modes), width stays full — transform drives visibility.
  const panelWidth = $derived(mode === 'collapsible' && !isMobile ? (open ? width : '0px') : width);

  // Public CSS variable for consumers to offset their main content area.
  const effectiveWidth = $derived(open || (mode === 'responsive' && !isMobile) ? width : '0px');

  // Auto-close responsive sidebars when the viewport *transitions* from mobile
  // to desktop. Tracking `prevIsMobile` is required so the effect doesn't fire
  // on the initial run when isMobile starts as `false` and `open=true` was
  // passed in by the consumer — that would close the sidebar immediately on
  // mount. Only a true mobile→desktop transition should trigger the close.
  let prevIsMobile: boolean | undefined;
  $effect(() => {
    const wasMobile = prevIsMobile;
    prevIsMobile = isMobile;
    if (wasMobile === true && !isMobile && open && mode === 'responsive') {
      open = false;
      onOpenChange?.(false);
    }
  });

  function requestClose() {
    open = false;
    onOpenChange?.(false);
    previouslyFocused?.focus();
    previouslyFocused = null;
  }

  // Lock body scroll only while acting as a modal overlay (mobile + open). The
  // acquired lock's release doubles as the effect cleanup, so it runs on both
  // re-run and destroy — and only when this run actually locked. No onDestroy
  // needed: a spurious extra release used to be able to free *another*
  // overlay's lock via the shared refcount.
  $effect(() => {
    if (!open || !isMobile) return;
    if (!previouslyFocused) {
      previouslyFocused = document.activeElement as HTMLElement;
    }
    return lockBodyScroll();
  });

  // Register only when behaving as a modal overlay (mobile + open).
  // Desktop sidebars are persistent layout — overlayStack.closeAll() must skip them.
  $effect(() => {
    if (!open || !isMobile) return;
    return overlayStack.register(overlayId, requestClose);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && closeOnEscape && open && isMobile && !e.defaultPrevented) {
      e.preventDefault();
      requestClose();
    }
  }

  // The panel is out of sight in exactly two situations, and they use different
  // mechanisms: a closed `collapsible` panel on desktop is 0px wide with its
  // overflow hidden, and any closed panel on mobile is pushed off-screen by the
  // transform. Both leave the children mounted.
  //
  // `aria-hidden` and `inert` therefore have to agree, and deriving BOTH from
  // this one expression is what keeps them from drifting apart. Only half of the
  // pair used to be implemented, which is the `aria-hidden-focus` violation axe
  // rates serious: a keyboard user tabbed into a zero-width region their screen
  // reader had been told to ignore, landing on links that were neither
  // announced nor visible (#138).
  //
  // Applied the moment `open` flips, not at the end of the width/transform
  // transition (--blocks-duration-normal, 250ms with the library stylesheet
  // loaded, 200ms from the in-component fallback, 1ms under reduced motion). A
  // panel on its way out has nothing left worth clicking, and the keyboard must
  // not be able to walk into it meanwhile; the opening direction costs nothing
  // either way, since lifting `inert` immediately makes the panel usable while
  // it is still animating in.
  //
  // Two places where this props-derived condition and the rendered reality can
  // part company, both known and neither closable here:
  //  - `unstyled` drops the tv() classes, and `overflow-hidden` lives there —
  //    so a 0px-wide panel paints its overflow and is now unreachable as well as
  //    misrendered. The unstyled contract is that the consumer supplies the
  //    clipping.
  //  - Server-side `MediaQuery` reports its fallback, so SSR always renders the
  //    desktop reading. A closed mobile panel arrives with neither attribute
  //    until hydration corrects it.
  const hidden = $derived(!open && (mode === 'collapsible' || isMobile));

  // Making the panel inert while focus is INSIDE it makes the browser drop that
  // focus to <body> — measured on this component's own docs demo, whose nav
  // buttons close the panel from within. The keyboard user this fix exists for
  // would land nowhere, announced by nothing.
  //
  // The mobile path already restored focus through `requestClose`, but its
  // capture is gated on `open && isMobile`, so on the desktop-collapsible path —
  // the one #138 is actually about — nothing was ever captured. Capturing runs
  // for every mode that can hide, and the handover happens in `$effect.pre`,
  // before the DOM update writes `inert`: afterwards the browser has already
  // evicted focus and `document.activeElement` no longer says where it was.
  let panel: HTMLElement | null = $state(null);
  let wasHidden = false;

  $effect.pre(() => {
    const nowHidden = hidden;
    const previous = wasHidden;
    wasHidden = nowHidden;
    if (!nowHidden || previous || !panel) return;
    if (!panel.contains(document.activeElement)) return;
    // Prefer the control that opened the panel; falling back to blur() at least
    // makes the loss deliberate instead of leaving focus on a dead node.
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
    previouslyFocused = null;
  });

  // Capture on the way IN, for every mode that can later hide the panel — the
  // scroll-lock effect below captures too, but only for the mobile overlay.
  $effect(() => {
    if (!open || !(mode === 'collapsible' || isMobile)) return;
    if (!previouslyFocused) previouslyFocused = document.activeElement as HTMLElement;
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open && isMobile}
  <div
    role="presentation"
    class={unstyled
      ? (slotClasses?.backdrop ?? '')
      : styles.backdrop({ class: slotClasses?.backdrop })}
    onclick={() => closeOnBackdropClick && requestClose()}
    aria-hidden="true"
    transition:fade={{ duration: 200, easing: quintOut }}
  ></div>
{/if}

<aside
  bind:this={panel}
  class={unstyled
    ? resolveClassChain(slotClasses?.panel, className)
    : styles.panel({ class: [slotClasses?.panel, className] })}
  style:width={panelWidth}
  style:--sidebar-width={width}
  style:--sidebar-effective-width={effectiveWidth}
  style:--_sidebar-transform={panelTransform}
  data-state={open ? 'open' : 'closed'}
  data-side={side}
  data-mode={mode}
  aria-hidden={hidden ? true : undefined}
  inert={hidden ? true : undefined}
  {...restProps}
>
  {#if header}
    <div
      class={unstyled ? (slotClasses?.header ?? '') : styles.header({ class: slotClasses?.header })}
    >
      {@render header()}
    </div>
  {/if}

  <div
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
  >
    {@render children?.()}
  </div>

  {#if footer}
    <div
      class={unstyled ? (slotClasses?.footer ?? '') : styles.footer({ class: slotClasses?.footer })}
    >
      {@render footer()}
    </div>
  {/if}
</aside>

<style>
  aside {
    transform: var(--_sidebar-transform);
    transition:
      transform var(--blocks-duration-normal, 200ms)
        var(--blocks-ease-confident, cubic-bezier(0.2, 0, 0, 1)),
      width var(--blocks-duration-normal, 200ms)
        var(--blocks-ease-confident, cubic-bezier(0.2, 0, 0, 1));
  }

  @media (min-width: 1024px) {
    aside {
      transform: translateX(0);
    }
  }
</style>
