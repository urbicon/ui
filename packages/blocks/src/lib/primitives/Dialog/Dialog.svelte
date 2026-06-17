<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import {
    trapFocus,
    showDialogModal,
    closeDialogModal,
    unlockBodyScroll
  } from '$lib/utils/overlay';
  import { overlayStack, getOverlayMotion } from '$lib/utils';
  import Button from '../Button/Button.svelte';
  import type { DialogProps } from './index';
  import { dialogVariants } from './dialog.variants';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    open = $bindable(false),
    children,
    footer,
    title,
    size = 'sm',
    placement = 'center',
    intent = 'neutral',
    closeOnBackdropClick = true,
    closeOnEscape = true,
    hideCloseButton = false,
    transitionDuration,
    transitionEasing,
    onClose,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: DialogProps = $props();

  if (
    import.meta.env.DEV &&
    hideCloseButton &&
    closeOnEscape === false &&
    closeOnBackdropClick === false
  ) {
    console.warn(
      '[Dialog] All close paths are disabled (hideCloseButton + closeOnEscape=false + closeOnBackdropClick=false). The dialog is only closable programmatically — make sure your UI exposes an action that calls onClose or sets open=false.'
    );
  }

  const motion = $derived(
    getOverlayMotion({
      enterDuration: transitionDuration,
      exitDuration: transitionDuration,
      easing: transitionEasing
    })
  );

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Dialog?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Dialog', preset),
      slotClassesProp
    )
  );

  let dialogEl = $state<HTMLDialogElement>();
  let panelEl = $state<HTMLElement>();
  let isVisible = $state(false);
  let previouslyFocused: HTMLElement | null = null;

  const structured = $derived(!!title);

  const uid = $props.id();
  const titleId = $derived(title ? `dialog-title-${uid}` : undefined);
  const bodyId = `dialog-body-${uid}`;
  const overlayId = `dialog-${uid}`;

  const styles = $derived(dialogVariants({ size, placement, intent }));

  function requestClose() {
    if (!isVisible || !open) return;
    open = false;
    onClose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (closeOnEscape) requestClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(event, panelEl);
  }

  // Native <dialog> only routes ESC to its `onkeydown` when focus is inside
  // the dialog. If the user opens the dialog and never clicks into it, focus
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

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdropClick && event.target === event.currentTarget) requestClose();
  }

  function handleBackdropDirectClick() {
    if (closeOnBackdropClick) requestClose();
  }

  function handleOutroEnd() {
    closeDialogModal(dialogEl, previouslyFocused);
    isVisible = false;
    previouslyFocused = null;
  }

  $effect(() => {
    if (open && !isVisible) {
      isVisible = true;
      previouslyFocused = document.activeElement as HTMLElement;
      showDialogModal(dialogEl, panelEl);
    }
  });

  $effect(() => {
    if (!open) return;
    return overlayStack.register(overlayId, requestClose);
  });

  onDestroy(() => {
    unlockBodyScroll();
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isVisible}
  <dialog
    bind:this={dialogEl}
    class={unstyled ? (slotClasses?.dialog ?? '') : styles.dialog({ class: slotClasses?.dialog })}
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    onclose={() => {
      if (open) requestClose();
    }}
    aria-labelledby={titleId}
    aria-describedby={bodyId}
    aria-modal="true"
    data-state={open ? 'open' : 'closed'}
    {...restProps}
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
      <div
        bind:this={panelEl}
        class={unstyled
          ? [slotClasses?.panel, className].filter(Boolean).join(' ')
          : styles.panel({ class: [slotClasses?.panel, className] })}
        data-intent={intent}
        role="document"
        transition:scale={{
          duration: motion.enterDuration,
          easing: motion.easing,
          start: motion.panelScaleStart,
          opacity: 0
        }}
        onoutroend={handleOutroEnd}
      >
        {#if structured}
          <header
            class={unstyled
              ? (slotClasses?.header ?? '')
              : styles.header({ class: slotClasses?.header })}
          >
            <h2
              class={unstyled
                ? (slotClasses?.title ?? '')
                : styles.title({ class: slotClasses?.title })}
              id={titleId}
            >
              {title}
            </h2>
            {#if !hideCloseButton}
              <Button
                variant="ghost"
                size="sm"
                onclick={requestClose}
                aria-label={bt('accessibility.closeDialog')}
              >
                <CloseIcon class="h-4 w-4" />
              </Button>
            {/if}
          </header>

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
        {:else}
          <div
            class={unstyled
              ? (slotClasses?.content ?? '')
              : styles.content({ class: slotClasses?.content })}
            id={bodyId}
          >
            {@render children()}
          </div>
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
