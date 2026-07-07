<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { quintOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import type { SidebarProps } from './index';
  import { sidebarVariants, type SidebarVariants } from './sidebar.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { lockBodyScroll } from '$lib/utils/overlay';
  import { overlayStack } from '$lib/utils';

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

  const ariaHidden = $derived(!open && (mode === 'collapsible' || isMobile) ? true : undefined);
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
  class={unstyled
    ? [slotClasses?.panel, className].filter(Boolean).join(' ')
    : styles.panel({ class: [slotClasses?.panel, className] })}
  style:width={panelWidth}
  style:--sidebar-width={width}
  style:--sidebar-effective-width={effectiveWidth}
  style:--_sidebar-transform={panelTransform}
  data-state={open ? 'open' : 'closed'}
  data-side={side}
  data-mode={mode}
  aria-hidden={ariaHidden}
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
