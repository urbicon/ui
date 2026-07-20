<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { onDestroy, tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { trapFocus, showDialogModal, closeDialogModal } from '$lib/utils/overlay';
  import { composeHandlers } from '$lib/utils/compose-handlers';
  import { overlayStack, getOverlayMotion } from '$lib/utils';
  import Button from '../Button/Button.svelte';
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
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: DrawerProps = $props();

  // One-shot DEV sanity check on the initial close-path configuration.
  // svelte-ignore state_referenced_locally
  if (
    import.meta.env?.DEV &&
    hideCloseButton &&
    closeOnEscape === false &&
    closeOnBackdropClick === false
  ) {
    console.warn(
      '[Drawer] All close paths are disabled (hideCloseButton + closeOnEscape=false + closeOnBackdropClick=false). The drawer is only closable programmatically — make sure your UI exposes an action that calls onClose or sets open=false.'
    );
  }

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let dialogElement = $state<HTMLDialogElement>();
  let panelElement = $state<HTMLElement>();
  let isVisible = $state(false);
  let previouslyFocused: HTMLElement | null = null;
  // Release for the body-scroll lock this instance holds while modal — set by
  // showDialogModal, idempotent, so both teardown paths below may call it.
  let releaseScrollLock: (() => void) | undefined;

  const uid = $props.id();
  const titleId = $derived(title ? `drawer-title-${uid}` : undefined);
  const bodyId = `drawer-body-${uid}`;
  const overlayId = `drawer-${uid}`;

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
    resolveSlotClasses(blocksConfig, 'Drawer', preset, variantProps, slotClassesProp)
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

  function requestClose() {
    if (!isVisible || !open) return;
    open = false;
    onClose?.();
  }

  // Native <dialog> only routes ESC to its `onkeydown` when focus is inside
  // the dialog. If the user opens the drawer and never clicks into it, focus
  // can stay on the trigger or body, and ESC silently misses our handler.
  // The window-level listener catches that case; the `isTop` guard makes
  // sure stacked overlays close one-at-a-time.
  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (!open || !closeOnEscape || event.defaultPrevented) return;
    if (!overlayStack.isTop(overlayId)) return;
    event.preventDefault();
    requestClose();
  }

  $effect(() => {
    if (open && !isVisible) {
      isVisible = true;
      previouslyFocused = document.activeElement as HTMLElement;
      // Defer until the `{#if isVisible}` block has rendered so `bind:this` has
      // assigned dialogElement/panelElement — showDialogModal captures the refs
      // by value, so promoting before the bind would silently no-op (never modal).
      // The guard covers same-flush teardown: if the component unmounts before
      // the tick resolves, bind:this has nulled dialogElement and onDestroy has
      // already run — a lock taken now could never be released.
      tick().then(() => {
        if (dialogElement) releaseScrollLock = showDialogModal(dialogElement, panelElement);
      });
    }
  });

  $effect(() => {
    if (!open) return;
    return overlayStack.register(overlayId, requestClose);
  });

  onDestroy(() => {
    // Safety net for destroy-while-open, where no outro runs. Releasing is
    // idempotent and scoped to this instance's own lock, so a regular close
    // (already released in handleOutroEnd) or a never-opened instance make
    // this a no-op — it can never free another overlay's lock.
    releaseScrollLock?.();
  });

  function handleBackdropDirectClick() {
    if (closeOnBackdropClick) requestClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (closeOnEscape) requestClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(event, panelElement);
  }

  // Native `close` event (ESC handled by the UA, form[method=dialog], .close()).
  // Named rather than inline so it can be composed with a consumer `onclose`.
  function handleNativeClose() {
    if (open) requestClose();
  }

  function handleOutroEnd() {
    closeDialogModal(dialogElement, previouslyFocused, releaseScrollLock);
    releaseScrollLock = undefined;
    isVisible = false;
    previouslyFocused = null;
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isVisible}
  <dialog
    {...restProps}
    bind:this={dialogElement}
    class={unstyled ? (slotClasses?.dialog ?? '') : styles.dialog({ class: slotClasses?.dialog })}
    onkeydown={composeHandlers(handleKeydown, onkeydownProp)}
    onclose={composeHandlers(handleNativeClose, oncloseProp)}
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
        onclick={handleBackdropDirectClick}
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
          ? [slotClasses?.panel, className].filter(Boolean).join(' ')
          : styles.panel({ class: [slotClasses?.panel, className] })}
        data-intent={intent}
        role="document"
        tabindex="-1"
        transition:fly={flyParams}
        onoutroend={handleOutroEnd}
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
              <Button
                variant="ghost"
                size="sm"
                onclick={requestClose}
                aria-label={bt('accessibility.closeDrawer')}
              >
                <CloseIcon class="h-4 w-4" />
              </Button>
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
