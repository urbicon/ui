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
  onClosed: () => (() => void) | undefined;
  closeOnEscape: () => boolean;
  closeOnBackdropClick: () => boolean;
  /** Read once, for the init-time warning only. */
  hideCloseButton: () => boolean;
  dialog: () => HTMLDialogElement | undefined;
  panel: () => HTMLElement | undefined;
  /**
   * Runs after each open's deferred promotion, whether or not a `<dialog>` was
   * bound to promote.
   */
  afterShow?: () => void;
}

export interface ModalSurface {
  /** True from the moment `open` turns true until the panel's outro has ended. */
  readonly visible: boolean;
  /**
   * The one close path every dismissal goes through: sets `open` false, then
   * calls `onClose`. A write of `open = true` from inside `onClose` keeps the
   * surface open — except on the native-close path, see `handleNativeClose`.
   */
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
  /** For the panel's `onoutroend`: finishes the close, then calls `onClosed`. */
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
      // Menu `preventDefault()` when Escape dismisses them, and so does Popover
      // with focus on its trigger or in its panel; without this guard the event
      // goes on to close the whole surface, so dismissing an open dropdown
      // tears down the surface it is sitting on.
      if (event.defaultPrevented) return;
      // An open surface below the top of the overlay stack leaves the key to
      // the layer above it. A Popover open inside this surface is such a layer
      // (it registers while anchored in a modal dialog) and takes Escape in a
      // document listener, which runs after this handler — so with focus on
      // another control of the surface, claiming here would close the surface
      // in the Popover's place. A closing surface is already unregistered and
      // still claims below, so an Escape during its outro reaches nothing else.
      // A layer that leaves the key unclaimed hands it back: see
      // `armEscapeFallback`.
      if (options.open() && !overlayStack.isTop(overlayId)) {
        armEscapeFallback(event);
        return;
      }
      // Claimed whether or not it closes: a surface rendered inside another
      // one's content has the outer `<dialog>` as an ancestor, which must not
      // act on the same Escape.
      event.preventDefault();
      if (options.closeOnEscape()) requestClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(event, options.panel());
  }

  // The other half of the yield in `handleKeydown`. Not every layer above the
  // surface takes Escape: a GuideController without its UI, a Sidebar with
  // `closeOnEscape={false}`, an entry of your own. An Escape nobody claims
  // reaches the browser's close watcher, which closes this `<dialog>` past
  // `closeOnEscape` and past an `onClose` veto. A `window` listener added
  // while the event is still on its way there runs in the same dispatch,
  // after the window listeners that were already registered, so it sees
  // whether any layer claimed the key; if none did, the surface applies its
  // own Escape policy, as if it had never yielded. A `stopPropagation()` on
  // the way keeps it from running at all: the timer removes it once that
  // dispatch is over, a destroy before then, and it acts only on the event it
  // was armed for in case another keydown reaches it first.
  let disarmEscapeFallback: (() => void) | undefined;

  function armEscapeFallback(armedFor: KeyboardEvent) {
    disarmEscapeFallback?.();
    const fallback = (event: KeyboardEvent) => {
      disarm();
      if (event !== armedFor || event.defaultPrevented) return;
      event.preventDefault();
      if (options.closeOnEscape()) requestClose();
    };
    const timer = setTimeout(disarm);
    function disarm() {
      clearTimeout(timer);
      window.removeEventListener('keydown', fallback);
      if (disarmEscapeFallback === disarm) disarmEscapeFallback = undefined;
    }
    window.addEventListener('keydown', fallback);
    disarmEscapeFallback = disarm;
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
  // `onClose` like any other. A keyboard Escape gets here only when no keydown
  // listener claimed it.
  function handleNativeCancel(event: Event) {
    if (!options.closeOnEscape()) event.preventDefault();
  }

  // Native `close` event: the browser has closed the `<dialog>` already —
  // form[method=dialog], `.close()`, or a close request that no keydown
  // listener claimed and `handleNativeCancel` did not, or could not, refuse. It is
  // routed through `onClose` like any other dismissal, but `onClose` cannot
  // veto it: keeping it open would take a second `showModal()`, against a
  // close the anti-abuse rule may just have forced through — trapping a user
  // who is trying to leave. A write-back is undone instead, so `open` never
  // reports a closed `<dialog>` as open.
  function handleNativeClose() {
    // A `close` while the `<dialog>` this surface renders is open is not about
    // it: the `.close()` at outro end fires one a task later, by when
    // `onClosed` may have reopened the surface — on a new element, or on the
    // same one after a zero-duration outro (measured, Chromium and WebKit;
    // without this check the reopened surface closes again).
    if (options.dialog()?.open) return;
    if (!options.open()) return;
    requestClose();
    if (!options.open()) return;
    options.setOpen(false);
    if (import.meta.env?.DEV) {
      console.warn(
        `[${name}] onClose wrote open back to true, but the browser had already closed the ${name.toLowerCase()} (a form with method="dialog", dialog.close(), or a close request it did not intercept, such as a back gesture), so it stays closed. closeOnEscape={false} holds such close requests off for as long as the browser lets a page refuse them.`
      );
    }
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
  // released and focus goes back to where it was before the open — and only
  // then `onClosed`, so a focus move inside it is the last one. An outro that a
  // reopen interrupts never ends (Svelte deactivates it), so neither runs for
  // it. A destroy while open, or during the outro, never gets here either:
  // onDestroy below releases the lock, focus is not returned and `onClosed`
  // does not fire.
  function handleOutroEnd() {
    closeDialogModal(options.dialog(), previouslyFocused, releaseScrollLock);
    releaseScrollLock = undefined;
    visible = false;
    previouslyFocused = null;
    options.onClosed()?.();
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

  // Through a derived: a close that `onClose` vetoes writes `open` false and
  // back to true before any flush, the derived settles on the value it had,
  // and the effect does not re-run — so a veto never moves the entry to the
  // top of the stack. `.pre`: in the flush that closes, its cleanup runs ahead
  // of the template's effects, so the entry is gone before the outro starts,
  // and a zero-duration outro ends — `onClosed` included — inside that flush.
  const registered = $derived(options.open());
  $effect.pre(() => {
    if (!registered) return;
    return overlayStack.register(overlayId, requestClose);
  });

  onDestroy(() => {
    // Safety net for destroy-while-open, where no outro runs. Releasing is
    // idempotent and scoped to this instance's own lock, so a regular close
    // (already released in handleOutroEnd) or a never-opened instance make
    // this a no-op — it can never free another overlay's lock.
    releaseScrollLock?.();
    disarmEscapeFallback?.();
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
