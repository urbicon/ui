<script lang="ts">
  import { useBlocksI18n } from '#lib';
  import { getBlocksConfig, resolveSlotClasses, useThemeProps } from '#lib/provider/index.js';
  import { consumeWrapperCascade } from '#lib/provider/wrapper-cascade.js';
  import { resolveIcon } from '#lib/icons/index.js';
  import CloseIconDefault from '#lib/icons/CloseIcon.svelte';
  import { fade, scale } from 'svelte/transition';
  import { composeHandlers } from '#lib/utils/compose-handlers.js';
  import { getOverlayMotion } from '#lib/utils/index.js';
  import { createModalSurface } from '#lib/internal/modal-surface.svelte.js';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '#lib/internal/core/CoreIconButton.svelte';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import type { DialogProps } from './index';
  import { dialogVariants, type DialogVariants } from './dialog.variants';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  const theme = useThemeProps('Dialog', () => preset);

  let {
    preset,
    open = $bindable(false),
    children,
    footer,
    title,
    icon,
    size = theme.size ?? 'sm',
    placement = 'center',
    intent = theme.intent ?? 'neutral',
    closeOnBackdropClick = true,
    closeOnEscape = true,
    hideCloseButton = false,
    draggable = false,
    transitionDuration,
    transitionEasing,
    onClose,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    // Pulled out of restProps so the `{...restProps}`-first spread (internal
    // attributes win — see docs/COMPONENT-API-CONVENTIONS.md) can't clobber
    // them, and so neither side loses: the behavioural handlers below are
    // composed (internal first, consumer second) and the two ARIA attributes
    // are merged, rather than one silently replacing the other.
    onclick: onclickProp,
    onkeydown: onkeydownProp,
    onclose: oncloseProp,
    oncancel: oncancelProp,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: DialogProps = $props();

  /** Warned once per instance: a dead end is a mistake, not a stream of them. */
  let warnedDeadEnd = false;

  /**
   * The second half of the all-close-paths warning `createModalSurface` raises
   * at init, and the one that can actually tell a deliberate forced choice from
   * a trap: with every close path disabled, the only way out is something the
   * consumer put *inside* the dialog. Whether they did is not knowable from the
   * props — `footer` and `children` are snippets — so this looks at the
   * rendered panel once it exists.
   *
   * A dialog with no interactive element and no way out leaves the reader stuck
   * with a page they cannot use; that is worth a loud line in the console, in
   * the same spirit as the `toaster.add()`-without-`<Toaster />` warning.
   */
  function warnOnDeadEnd(): void {
    if (!import.meta.env?.DEV || warnedDeadEnd) return;
    if (!hideCloseButton || closeOnEscape !== false || closeOnBackdropClick !== false) return;
    if (!panelEl) return;
    const action = panelEl.querySelector(
      'button, [role="button"], a[href], input[type="submit"], input[type="button"], [tabindex]:not([tabindex="-1"])'
    );
    if (action) return;
    warnedDeadEnd = true;
    console.warn(
      '[Dialog] Dead end: every close path is disabled and the dialog renders no action ' +
        'the reader could take. Give it a button (in `footer` or `children`) that closes it, ' +
        'or leave one of `closeOnEscape` / `closeOnBackdropClick` / the close button in place.'
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

  let dialogEl = $state<HTMLDialogElement>();
  let panelEl = $state<HTMLElement>();

  const structured = $derived(!!title);

  // svelte-ignore state_referenced_locally
  if (import.meta.env?.DEV && draggable && !title) {
    console.warn(
      '[Dialog] `draggable` needs a `title` — the header is the drag handle. Without a title no header renders, so dragging is a no-op.'
    );
  }

  // svelte-ignore state_referenced_locally
  if (import.meta.env?.DEV && icon && !title) {
    console.warn(
      '[Dialog] `icon` needs a `title` — the icon sits in the structured header. Without a title no header renders, so the icon is dropped.'
    );
  }

  // Drag offset from the centred position (px). Only ever non-zero while
  // `draggable` and the user has grabbed the header. Reset on each open so a
  // reopened dialog always starts centred.
  let dragX = $state(0);
  let dragY = $state(0);

  // Attachment wiring the header as a drag handle. Kept off the markup as an
  // `{@attach}` (not inline `onpointer*`) so the static `<header>` doesn't trip
  // the a11y "non-interactive element with handlers needs a role" rule, and so
  // the listeners tear down cleanly when `draggable` flips off. Pointer capture
  // keeps the drag alive when the cursor outruns the header; header buttons
  // (close) are exempted so they still click.
  function draggableHandle(node: HTMLElement) {
    node.style.touchAction = 'none';
    node.style.userSelect = 'none';
    node.style.cursor = 'move';
    let dragging = false;
    let startX = 0;
    let startY = 0;
    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest('button')) return;
      dragging = true;
      startX = event.clientX - dragX;
      startY = event.clientY - dragY;
      node.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      dragX = event.clientX - startX;
      dragY = event.clientY - startY;
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      node.releasePointerCapture(event.pointerId);
    };
    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      // Undo the inline styles too, so toggling `draggable` off at runtime
      // doesn't leave the header stuck with `cursor: move` / unselectable text.
      node.style.touchAction = '';
      node.style.userSelect = '';
      node.style.cursor = '';
    };
  }

  const uid = $props.id();
  const titleId = $derived(title ? `dialog-title-${uid}` : undefined);
  const bodyId = `dialog-body-${uid}`;

  // A rendered `title` owns the labelling; without one, a consumer-supplied
  // `aria-labelledby` (e.g. a heading inside `children`) is the fallback, so
  // external labelling survives the restProps-first spread.
  const labelledBy = $derived(titleId ?? ariaLabelledby);
  // Merged, not replaced: a consumer's description is supplemental to the
  // dialog's own body — internal id first, consumer id last (mirrors Input).
  const describedBy = $derived([bodyId, ariaDescribedby].filter(Boolean).join(' ') || undefined);

  const variantProps: DialogVariants = $derived({ size, placement, intent });
  const styles = $derived(dialogVariants(variantProps));
  // A wrapper (ConfirmDialog) hands its name down instead of resolving a
  // cascade of its own, so its `overrides` rules are matched against the object
  // above rather than against a stand-in built from what its caller wrote.
  const wrapperCascade = consumeWrapperCascade(() => wrapperSlotClasses ?? {});
  const wrapperSlotClasses = $derived(
    wrapperCascade &&
      resolveSlotClasses(
        blocksConfig,
        wrapperCascade.component,
        wrapperCascade.preset,
        variantProps,
        wrapperCascade.slotClasses,
        dialogVariants.config
      )
  );

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Dialog',
      preset,
      variantProps,
      wrapperSlotClasses ?? slotClassesProp,
      dialogVariants.config
    )
  );

  const modal = createModalSurface({
    name: 'Dialog',
    uid,
    open: () => open,
    setOpen: (value) => (open = value),
    onClose: () => onClose,
    closeOnEscape: () => closeOnEscape,
    closeOnBackdropClick: () => closeOnBackdropClick,
    hideCloseButton: () => hideCloseButton,
    dialog: () => dialogEl,
    panel: () => panelEl,
    afterShow: warnOnDeadEnd
  });

  // Reset the drag offset whenever the dialog opens so a reopened dialog always
  // starts centred — keyed on `open`, not on the `open && !modal.visible`
  // transition: reopening *during* the close outro (`modal.visible` still true)
  // must recentre too, and a reset guarded on that transition would skip it and
  // restore the stale drag position. `open` is constant during a drag, so this
  // never fights the pointer handlers.
  $effect(() => {
    if (open) {
      dragX = 0;
      dragY = 0;
    }
  });
</script>

<svelte:window onkeydown={modal.handleWindowKeydown} />

{#if modal.visible}
  <dialog
    {...restProps}
    bind:this={dialogEl}
    class={unstyled ? (slotClasses?.dialog ?? '') : styles.dialog({ class: slotClasses?.dialog })}
    onclick={composeHandlers(modal.handleBackdropClick, onclickProp)}
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
           to the panel when children contain nothing focusable (untitled dialog),
           keeping the element-level ESC handler + Tab trap live. Negative, so it
           never joins the Tab cycle. -->
      <div
        bind:this={panelEl}
        class={unstyled
          ? resolveClassChain(slotClasses?.panel, className)
          : styles.panel({ class: [slotClasses?.panel, className] })}
        data-intent={intent}
        role="document"
        tabindex="-1"
        style:translate={dragX !== 0 || dragY !== 0 ? `${dragX}px ${dragY}px` : undefined}
        transition:scale={{
          duration: motion.enterDuration,
          easing: motion.easing,
          start: motion.panelScaleStart,
          opacity: 0
        }}
        onoutroend={modal.handleOutroEnd}
      >
        {#if structured}
          <header
            class={unstyled
              ? (slotClasses?.header ?? '')
              : styles.header({ class: slotClasses?.header })}
            {@attach draggable ? draggableHandle : undefined}
          >
            <div
              class={unstyled
                ? (slotClasses?.titleGroup ?? '')
                : styles.titleGroup({ class: slotClasses?.titleGroup })}
            >
              {#if icon}
                <span
                  class={unstyled
                    ? (slotClasses?.icon ?? '')
                    : styles.icon({ class: slotClasses?.icon })}
                  aria-hidden="true"
                >
                  {@render icon()}
                </span>
              {/if}
              <h2
                class={unstyled
                  ? (slotClasses?.title ?? '')
                  : styles.title({ class: slotClasses?.title })}
                id={titleId}
              >
                {title}
              </h2>
            </div>
            {#if !hideCloseButton}
              <CoreIconButton
                class={unstyled
                  ? (slotClasses?.closeButton ?? '')
                  : styles.closeButton({ class: slotClasses?.closeButton })}
                onclick={modal.requestClose}
                aria-label={bt('accessibility.closeDialog')}
              >
                <CloseIcon class="h-4 w-4" />
              </CoreIconButton>
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
