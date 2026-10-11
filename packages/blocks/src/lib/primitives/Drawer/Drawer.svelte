<script lang="ts">
  import { useBlocksI18n } from '#lib';
  import { getBlocksConfig, resolveSlotClasses } from '#lib/provider/index.js';
  import { resolveIcon } from '#lib/icons/index.js';
  import CloseIconDefault from '#lib/icons/CloseIcon.svelte';
  import { fade, fly } from 'svelte/transition';
  import { composeHandlers } from '#lib/utils/compose-handlers.js';
  import { getOverlayMotion } from '#lib/utils/index.js';
  import { createModalSurface } from '#lib/internal/modal-surface.svelte.js';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '#lib/internal/core/CoreIconButton.svelte';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import type { DrawerProps } from './index';
  import { drawerVariants, type DrawerVariants } from './drawer.variants';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    open = $bindable(false),
    children,
    footer,
    title,
    placement = 'right',
    size = 'md',
    intent = 'neutral',
    accentEdge = false,
    onClose,
    hideCloseButton = false,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    transitionDuration,
    transitionEasing,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    // Pulled out of restProps so the `{...restProps}`-first spread (internal
    // attributes win — see docs/COMPONENT-API-CONVENTIONS.md) can't clobber
    // them, and so neither side loses: the behavioural handlers below are
    // composed (internal first, consumer second) and the two ARIA attributes
    // are merged, rather than one silently replacing the other. Mirrors Dialog.
    onkeydown: onkeydownProp,
    onclose: oncloseProp,
    oncancel: oncancelProp,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: DrawerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let dialogElement = $state<HTMLDialogElement>();
  let panelElement = $state<HTMLElement>();

  const uid = $props.id();
  const titleId = $derived(title ? `drawer-title-${uid}` : undefined);
  const bodyId = `drawer-body-${uid}`;

  // A rendered `title` owns the labelling; without one, a consumer-supplied
  // `aria-labelledby` (e.g. a heading inside `children`) is the fallback, so
  // external labelling survives the restProps-first spread.
  const labelledBy = $derived(titleId ?? ariaLabelledby);
  // Merged, not replaced: a consumer's description is supplemental to the
  // drawer's own body — internal id first, consumer id last (mirrors Input).
  const describedBy = $derived([bodyId, ariaDescribedby].filter(Boolean).join(' ') || undefined);

  const variantProps: DrawerVariants = $derived({ placement, size, intent, accentEdge });
  const styles = $derived(drawerVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Drawer',
      preset,
      variantProps,
      slotClassesProp,
      drawerVariants.config
    )
  );

  const motion = $derived(
    getOverlayMotion({
      enterDuration: transitionDuration,
      exitDuration: transitionDuration,
      easing: transitionEasing
    })
  );

  const flyParams = $derived.by(() => {
    const duration = motion.enterDuration;
    const easing = motion.easing;
    const d = motion.panelFlyDistance;
    switch (placement) {
      case 'left':
        return { x: -d, y: 0, duration, easing };
      case 'right':
        return { x: d, y: 0, duration, easing };
      case 'top':
        return { x: 0, y: -d, duration, easing };
      case 'bottom':
        return { x: 0, y: d, duration, easing };
      default:
        return { x: d, y: 0, duration, easing };
    }
  });

  const modal = createModalSurface({
    name: 'Drawer',
    uid,
    open: () => open,
    setOpen: (value) => (open = value),
    onClose: () => onClose,
    closeOnEscape: () => closeOnEscape,
    closeOnBackdropClick: () => closeOnBackdropClick,
    hideCloseButton: () => hideCloseButton,
    dialog: () => dialogElement,
    panel: () => panelElement
  });
</script>

<svelte:window onkeydown={modal.handleWindowKeydown} />

{#if modal.visible}
  <dialog
    {...restProps}
    bind:this={dialogElement}
    class={unstyled ? (slotClasses?.dialog ?? '') : styles.dialog({ class: slotClasses?.dialog })}
    onkeydown={composeHandlers(modal.handleKeydown, onkeydownProp)}
    onclose={composeHandlers(modal.handleNativeClose, oncloseProp)}
    oncancel={composeHandlers(modal.handleNativeCancel, oncancelProp)}
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    aria-modal="true"
    data-state={open ? 'open' : 'closed'}
  >
    {#if open}
      <div
        class={unstyled
          ? (slotClasses?.backdrop ?? '')
          : styles.backdrop({ class: slotClasses?.backdrop })}
        onclick={modal.handleBackdropDirectClick}
        aria-hidden="true"
        role="presentation"
        transition:fade={{
          duration: motion.backdropEnterDuration,
          easing: motion.easing
        }}
      ></div>
      <!-- tabindex=-1: focus target of last resort — focusFirstElement falls back
           to the panel when children contain nothing focusable (untitled drawer
           with hideCloseButton), keeping the element-level ESC handler + Tab trap
           live. Negative, so it never joins the Tab cycle. -->
      <div
        bind:this={panelElement}
        class={unstyled
          ? resolveClassChain(slotClasses?.panel, className)
          : styles.panel({ class: [slotClasses?.panel, className] })}
        data-intent={intent}
        role="document"
        tabindex="-1"
        transition:fly={flyParams}
        onoutroend={modal.handleOutroEnd}
      >
        {#if title || !hideCloseButton}
          <header
            class={unstyled
              ? (slotClasses?.header ?? '')
              : styles.header({ class: slotClasses?.header })}
          >
            {#if title}
              <h2
                class={unstyled
                  ? (slotClasses?.title ?? '')
                  : styles.title({ class: slotClasses?.title })}
                id={titleId}
              >
                {title}
              </h2>
            {:else}
              <span></span>
            {/if}
            {#if !hideCloseButton}
              <CoreIconButton
                class={unstyled
                  ? (slotClasses?.closeButton ?? '')
                  : styles.closeButton({ class: slotClasses?.closeButton })}
                onclick={modal.requestClose}
                aria-label={bt('accessibility.closeDrawer')}
              >
                <CloseIcon class="h-4 w-4" />
              </CoreIconButton>
            {/if}
          </header>
        {/if}

        <main
          class={unstyled ? (slotClasses?.body ?? '') : styles.body({ class: slotClasses?.body })}
          id={bodyId}
        >
          {@render children()}
        </main>

        {#if footer}
          <footer
            class={unstyled
              ? (slotClasses?.footer ?? '')
              : styles.footer({ class: slotClasses?.footer })}
          >
            {@render footer()}
          </footer>
        {/if}
      </div>
    {/if}
  </dialog>
{/if}

<style>
  dialog {
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    color: inherit;
  }

  dialog::backdrop {
    display: none;
  }
</style>
