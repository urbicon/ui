<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { onDestroy, tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { trapFocus, showDialogModal, closeDialogModal } from '$lib/utils/overlay';
  import { composeHandlers } from '$lib/utils/compose-handlers';
  import { overlayStack, getOverlayMotion } from '$lib/utils';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import type { DialogProps } from './index';
  import { dialogVariants, type DialogVariants } from './dialog.variants';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    open = $bindable(false),
    children,
    footer,
    title,
    icon,
    size = 'sm',
    placement = 'center',
    intent = 'neutral',
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
    preset,
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

  // One-shot DEV sanity check on the initial close-path configuration.
  // svelte-ignore state_referenced_locally
  if (
    import.meta.env?.DEV &&
    hideCloseButton &&
    closeOnEscape === false &&
    closeOnBackdropClick === false
  ) {
    console.warn(
      '[Dialog] All close paths are disabled (hideCloseButton + closeOnEscape=false + closeOnBackdropClick=false). The dialog is only closable programmatically — make sure your UI exposes an action that calls onClose or sets open=false.'
    );
  }

  /** Warned once per instance: a dead end is a mistake, not a stream of them. */
  let warnedDeadEnd = false;

  /**
   * The second half of the check above, and the one that can actually tell a
   * deliberate forced choice from a trap: with every close path disabled, the
   * only way out is something the consumer put *inside* the dialog. Whether
   * they did is not knowable from the props — `footer` and `children` are
   * snippets — so this looks at the rendered panel once it exists.
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
  let isVisible = $state(false);
  let previouslyFocused: HTMLElement | null = null;
  // Release for the body-scroll lock this instance holds while modal — set by
  // showDialogModal, idempotent, so both teardown paths below may call it.
  let releaseScrollLock: (() => void) | undefined;

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
  const overlayId = `dialog-${uid}`;

  // A rendered `title` owns the labelling; without one, a consumer-supplied
  // `aria-labelledby` (e.g. a heading inside `children`) is the fallback, so
  // external labelling survives the restProps-first spread.
  const labelledBy = $derived(titleId ?? ariaLabelledby);
  // Merged, not replaced: a consumer's description is supplemental to the
  // dialog's own body — internal id first, consumer id last (mirrors Input).
  const describedBy = $derived([bodyId, ariaDescribedby].filter(Boolean).join(' ') || undefined);

  const variantProps: DialogVariants = $derived({ size, placement, intent });
  const styles = $derived(dialogVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Dialog', preset, variantProps, slotClassesProp)
  );

  function requestClose() {
    if (!isVisible || !open) return;
    open = false;
    onClose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Honour an inner widget that already consumed this Escape — the same
      // rule `handleWindowKeydown` below applies, and it has to hold here too
      // or the two paths disagree about who owns the key. Select, Combobox and
      // Popover all `preventDefault()` when Escape dismisses THEM; without this
      // guard the event went on to close the whole dialog, so dismissing an
      // open dropdown tore down the surface it was sitting on — and a Select
      // inside a modal dialog is the case Codeberg #23 was all about.
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (closeOnEscape) requestClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(event, panelEl);
  }

  // Native <dialog> only routes ESC to its `onkeydown` when focus is inside
  // the dialog. With focus outside — never clicked in, or dropped to <body>
  // when the focused button became disabled — ESC misses that handler, and an
  // unclaimed ESC reaches the UA's close watcher, which closes a modal dialog
  // regardless of `closeOnEscape`. So the window listener claims ESC whenever
  // this dialog is the top overlay and only then decides whether to close —
  // the same rule as `handleKeydown`, or the two paths disagree about who
  // owns the key. The `preventDefault()` is what holds the dialog: it stops
  // the close watcher before it runs (measured, Chromium 151 / WebKit 26.5:
  // five consecutive ESC, dialog stays open). The `isTop` guard makes sure
  // stacked overlays close one-at-a-time.
  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (!open || event.defaultPrevented) return;
    if (!overlayStack.isTop(overlayId)) return;
    event.preventDefault();
    if (closeOnEscape) requestClose();
  }

  // Second line, for close requests that are not a keydown (back gesture,
  // assistive tech): the UA fires a cancelable `cancel` first, and vetoing it
  // keeps the dialog open — but only while the window holds user activation.
  // The close watcher's anti-abuse rule makes the third request without an
  // intervening activation uncancelable and closes anyway (measured, both
  // engines); that close then arrives as `close` and is routed through
  // `onClose` like any other. Keyboard ESC never gets here: the keydown above
  // is claimed first.
  function handleNativeCancel(event: Event) {
    if (!closeOnEscape) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdropClick && event.target === event.currentTarget) requestClose();
  }

  function handleBackdropDirectClick() {
    if (closeOnBackdropClick) requestClose();
  }

  // Native `close` event (ESC handled by the UA, form[method=dialog], .close()).
  // Named rather than inline so it can be composed with a consumer `onclose`.
  function handleNativeClose() {
    if (open) requestClose();
  }

  function handleOutroEnd() {
    closeDialogModal(dialogEl, previouslyFocused, releaseScrollLock);
    releaseScrollLock = undefined;
    isVisible = false;
    previouslyFocused = null;
  }

  // Reset the drag offset whenever the dialog opens so a reopened dialog always
  // starts centred — keyed on `open`, not the `open && !isVisible` transition.
  // Reopening *during* the close outro (isVisible still true) must still recentre;
  // the old transition-guarded reset silently skipped that case, restoring the
  // stale drag position. `open` is constant during a drag, so this never fights
  // the pointer handlers.
  $effect(() => {
    if (open) {
      dragX = 0;
      dragY = 0;
    }
  });

  $effect(() => {
    if (open && !isVisible) {
      isVisible = true;
      previouslyFocused = document.activeElement as HTMLElement;
      // Defer until the `{#if isVisible}` block has rendered so `bind:this` has
      // assigned dialogEl/panelEl — showDialogModal captures the refs by value,
      // so promoting before the bind would silently no-op (never actually modal).
      // The guard covers same-flush teardown: if the component unmounts before
      // the tick resolves, bind:this has nulled dialogEl and onDestroy has
      // already run — a lock taken now could never be released.
      tick().then(() => {
        if (dialogEl) releaseScrollLock = showDialogModal(dialogEl, panelEl);
        warnOnDeadEnd();
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
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isVisible}
  <dialog
    {...restProps}
    bind:this={dialogEl}
    class={unstyled ? (slotClasses?.dialog ?? '') : styles.dialog({ class: slotClasses?.dialog })}
    onclick={composeHandlers(handleBackdropClick, onclickProp)}
    onkeydown={composeHandlers(handleKeydown, onkeydownProp)}
    onclose={composeHandlers(handleNativeClose, oncloseProp)}
    oncancel={composeHandlers(handleNativeCancel, oncancelProp)}
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
           to the panel when children contain nothing focusable (untitled dialog),
           keeping the element-level ESC handler + Tab trap live. Negative, so it
           never joins the Tab cycle. -->
      <div
        bind:this={panelEl}
        class={unstyled
          ? [slotClasses?.panel, className].filter(Boolean).join(' ')
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
        onoutroend={handleOutroEnd}
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
                onclick={requestClose}
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
