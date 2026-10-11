/**
 * The modal lifecycle and dismiss policy of a native-`<dialog>` surface —
 * Dialog and Drawer. `utils/overlay.ts` holds the mechanics (top-layer
 * promotion, focus trap, scroll lock); this module holds the decisions on top
 * of them: when to promote, which close requests to honour, who owns an
 * Escape, and when the close is finished.
 *
 * Call {@link createModalSurface} during component initialisation: it creates
 * the opener and overlay-stack effects and registers an `onDestroy`.
 *
 * Every input that can change after mount arrives as a getter. The options
 * object is built once, so a plain value would answer with its mount-time
 * setting for the life of the component — and the `closeOn*` props do change
 * after mount (ConfirmDialog switches both off while it is busy). `open` is the
 * component's `$bindable` prop, which only the component can assign, hence
 * `setOpen`.
 *
 * The component keeps the markup wiring: which handler sits on which element,
 * the `<svelte:window onkeydown>` and the panel's `onoutroend`. Lives under
 * `internal/`, so it is never exported.
 */

import { onDestroy, tick } from 'svelte';
import { closeDialogModal, showDialogModal, trapFocus } from '#lib/utils/overlay.js';
import { overlayStack } from '#lib/utils/overlay-stack.svelte.js';

export interface ModalSurfaceOptions {
  /** Component name: prefixes DEV warnings and, lower-cased, the overlay-stack id. */
  name: string;
  /** The component's `$props.id()`, which is only valid as a component top-level initializer. */
  uid: string;
  open: () => boolean;
  setOpen: (open: boolean) => void;
  onClose: () => (() => void) | undefined;
  closeOnEscape: () => boolean;
  closeOnBackdropClick: () => boolean;
  /** Read once, for the init-time warning only. */
  hideCloseButton: () => boolean;
  dialog: () => HTMLDialogElement | undefined;
  panel: () => HTMLElement | undefined;
  /** Runs after each open's deferred promotion, whether or not a `<dialog>` was bound to promote. */
  afterShow?: () => void;
}

export interface ModalSurface {
  /** True from the moment `open` turns true until the panel's outro has ended. */
  readonly visible: boolean;
  /** The one close path every dismissal goes through: sets `open` false, then calls `onClose`. */
  requestClose: () => void;
  /** For the `<dialog>`'s `onkeydown`: Escape and the Tab trap. */
  handleKeydown: (event: KeyboardEvent) => void;
  /** For `<svelte:window onkeydown>`. */
  handleWindowKeydown: (event: KeyboardEvent) => void;
  /** For the `<dialog>`'s `oncancel`. */
  handleNativeCancel: (event: Event) => void;
  /** For the `<dialog>`'s `onclose`. */
  handleNativeClose: () => void;
  /** For a click handler on the `<dialog>` element itself. */
  handleBackdropClick: (event: MouseEvent) => void;
  /** For the backdrop layer's `onclick`. */
  handleBackdropDirectClick: () => void;
  /** For the panel's `onoutroend`. */
  handleOutroEnd: () => void;
}

export function createModalSurface(options: ModalSurfaceOptions): ModalSurface {
  const { name } = options;
  const overlayId = `${name.toLowerCase()}-${options.uid}`;

  // One-shot DEV sanity check on the initial close-path configuration.
  if (
    import.meta.env?.DEV &&
    options.hideCloseButton() &&
    options.closeOnEscape() === false &&
    options.closeOnBackdropClick() === false
  ) {
    console.warn(
      `[${name}] All close paths are disabled (hideCloseButton + closeOnEscape=false + closeOnBackdropClick=false). The ${name.toLowerCase()} is only closable programmatically — make sure your UI exposes an action that calls onClose or sets open=false.`
    );
  }

  let visible = $state(false);
  let previouslyFocused: HTMLElement | null = null;
  // Release for the body-scroll lock this instance holds while modal — set by
  // showDialogModal, idempotent, so both teardown paths below may call it.
  let releaseScrollLock: (() => void) | undefined;

  function requestClose() {
    if (!visible || !options.open()) return;
    options.setOpen(false);
    options.onClose()?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Honour an inner widget that already consumed this Escape — the same
      // rule `handleWindowKeydown` below applies, and it has to hold here too
      // or the two paths disagree about who owns the key. Select, Combobox and
      // Popover all `preventDefault()` when Escape dismisses THEM; without this
      // guard the event goes on to close the whole surface, so dismissing an
      // open dropdown tears down the surface it is sitting on.
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (options.closeOnEscape()) requestClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(event, options.panel());
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
    if (!options.open() || event.defaultPrevented) return;
    if (!overlayStack.isTop(overlayId)) return;
    event.preventDefault();
    if (options.closeOnEscape()) requestClose();
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
    if (!options.closeOnEscape()) event.preventDefault();
  }

  // Native `close` event (ESC handled by the UA, form[method=dialog], .close()).
  function handleNativeClose() {
    if (options.open()) requestClose();
  }

  // A click that bubbled up from panel content has another target and is
  // ignored; only one on the `<dialog>` element itself dismisses.
  function handleBackdropClick(event: MouseEvent) {
    if (options.closeOnBackdropClick() && event.target === event.currentTarget) requestClose();
  }

  function handleBackdropDirectClick() {
    if (options.closeOnBackdropClick()) requestClose();
  }

  // The end of a close: the `<dialog>` leaves the top layer, the lock is
  // released and focus goes back to where it was before the open. A destroy
  // while open plays no outro and never gets here — onDestroy below covers it.
  function handleOutroEnd() {
    closeDialogModal(options.dialog(), previouslyFocused, releaseScrollLock);
    releaseScrollLock = undefined;
    visible = false;
    previouslyFocused = null;
  }

  $effect(() => {
    if (options.open() && !visible) {
      visible = true;
      previouslyFocused = document.activeElement as HTMLElement;
      // Defer until the block gated on `visible` has rendered so `bind:this` has
      // assigned the dialog and panel refs — showDialogModal captures the refs
      // by value, so promoting before the bind would silently no-op (never
      // actually modal). The guard covers same-flush teardown: if the component
      // unmounts before the tick resolves, bind:this has nulled the dialog ref
      // and onDestroy has already run — a lock taken now could never be
      // released.
      tick().then(() => {
        const dialog = options.dialog();
        if (dialog) releaseScrollLock = showDialogModal(dialog, options.panel());
        options.afterShow?.();
      });
    }
  });

  $effect(() => {
    if (!options.open()) return;
    return overlayStack.register(overlayId, requestClose);
  });

  onDestroy(() => {
    // Safety net for destroy-while-open, where no outro runs. Releasing is
    // idempotent and scoped to this instance's own lock, so a regular close
    // (already released in handleOutroEnd) or a never-opened instance make
    // this a no-op — it can never free another overlay's lock.
    releaseScrollLock?.();
  });

  return {
    get visible() {
      return visible;
    },
    requestClose,
    handleKeydown,
    handleWindowKeydown,
    handleNativeCancel,
    handleNativeClose,
    handleBackdropClick,
    handleBackdropDirectClick,
    handleOutroEnd
  };
}
