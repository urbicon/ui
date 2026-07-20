import { tick } from 'svelte';

const isBrowser = typeof document !== 'undefined';

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ');

export function getFocusableElements(container: HTMLElement | undefined): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]')
  );
}

export function trapFocus(event: KeyboardEvent, container: HTMLElement | undefined): void {
  if (!isBrowser) return;
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    // Nothing tabbable inside the overlay (untitled Dialog with static
    // children, Drawer with hideCloseButton): park focus on the container —
    // the panel that focusFirstElement's fallback focused via tabindex="-1" —
    // instead of letting Tab walk out of the modal. Browsers with a real top
    // layer get this from `showModal()` inertness; the guard keeps the trap's
    // contract honest everywhere else. `contains` includes the container
    // itself, so focus already parked there stays put.
    if (container?.contains(document.activeElement)) event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === first || !container?.contains(document.activeElement)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last || !container?.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }
}

let bodyScrollLockCount = 0;
let savedBodyOverflow: string | undefined;

/**
 * Acquire a shared body-scroll lock; returns the matching release function.
 *
 * The count is module-global — the body stays `overflow: hidden` while at
 * least one overlay (Dialog, Drawer, mobile Sidebar) holds a lock. Ownership
 * is per-acquisition: only the returned release can decrement this holder's
 * share, and it is idempotent, so calling it from multiple teardown paths
 * (outro end + onDestroy safety net) releases exactly once and can never free
 * a lock held by another overlay instance. There is deliberately no standalone
 * `unlock` export — an unpaired decrement is exactly the bug this design
 * removes.
 */
export function lockBodyScroll(): () => void {
  if (!isBrowser) return () => {};
  if (bodyScrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    bodyScrollLockCount -= 1;
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = savedBodyOverflow ?? '';
      savedBodyOverflow = undefined;
    }
  };
}

export function focusFirstElement(container: HTMLElement | undefined): void {
  if (!isBrowser) return;
  tick().then(() => {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
      return;
    }
    // No focusable descendant — e.g. an untitled Dialog whose children are
    // static text (no header, so no close button), or a Drawer with
    // hideCloseButton. Fall back to the container itself, which the overlay
    // panels make programmatically focusable via tabindex="-1" (excluded from
    // getFocusableElements, so it never joins the Tab cycle). Without this,
    // focus stays on <body>: the overlay's element-level keydown never fires,
    // leaving ESC to the window fallback and the Tab trap inert until the
    // user clicks in — a WCAG 2.1.2 problem. Mirrors the native <dialog>
    // focusing steps, which likewise fall back to the dialog element.
    container?.focus();
  });
}

/**
 * Promote a `<dialog>` to the top layer and move focus into its panel.
 *
 * **Precondition: `dialogEl` must already be bound.** Call this only once the
 * `bind:this` target exists — e.g. from `tick().then(...)` in the opener effect,
 * after the `{#if isVisible}` block has rendered. An earlier version deferred the
 * `showModal()` call with its own `tick()` in the hope of waiting for the bind,
 * but the ref is captured by value: if the caller passes an as-yet-unbound
 * `dialogEl`, the `tick()` still runs `undefined?.showModal()` — a silent no-op
 * that left Dialog/Drawer never actually modal. Sequencing is the caller's job;
 * the top-layer promotion here is synchronous (only the focus move inside
 * `focusFirstElement` defers by a tick).
 *
 * Acquires a body-scroll lock and returns its release function — the caller
 * owns the lock and must call the release on every teardown path (outro end
 * and destroy; it is idempotent, so overlapping paths are safe). Pass it back
 * through {@link closeDialogModal} on the regular close path.
 */
export function showDialogModal(
  dialogEl: HTMLDialogElement | undefined,
  panelEl: HTMLElement | undefined
): () => void {
  if (!isBrowser) return () => {};
  if (!dialogEl) {
    // Precondition violation: nothing to promote, so also take no lock — a
    // lock acquired here would scroll-freeze the page under a non-modal
    // overlay even if the caller dutifully releases the returned handle.
    if (import.meta.env?.DEV) {
      console.warn(
        '[blocks] showDialogModal called before the <dialog> ref was bound — ' +
          'the overlay will not enter the top layer (no :modal, no initial focus, ' +
          'no scroll lock). Defer the call until after the render that binds it ' +
          '(e.g. tick().then(...)).'
      );
    }
    return () => {};
  }
  const releaseScrollLock = lockBodyScroll();
  dialogEl.showModal();
  focusFirstElement(panelEl);
  return releaseScrollLock;
}

export function closeDialogModal(
  dialogEl: HTMLDialogElement | undefined,
  previouslyFocused: HTMLElement | null,
  releaseScrollLock?: () => void
): void {
  if (!isBrowser) return;
  if (dialogEl?.open) dialogEl.close();
  releaseScrollLock?.();
  previouslyFocused?.focus();
}

/**
 * True when `el` is a descendant of an OPEN *modal* `<dialog>` — one opened via
 * `showModal()`, which matches `:modal` and occupies the browser top layer.
 *
 * A popover shown via `showPopover()` from inside such a dialog forms a *second*
 * top-layer element, which WebKit/iOS fails to render above the dialog (Codeberg
 * #23 — the documented "top layer: popover vs. dialog" conflict; Chromium
 * tolerates it). Anchored overlays use this to skip top-layer promotion when
 * nested in a modal dialog and render inside the dialog's own subtree instead.
 *
 * DOM-based on purpose: it transparently covers `Drawer` (also `showModal()`)
 * and even consumer-authored `<dialog>` wrappers, and distinguishes modal from
 * non-modal (`show()`) dialogs — neither of which a context/registry would catch.
 *
 * Null-safe so it can be called during SSR, before `bind:this` resolves, or
 * while an anchor is mid-teardown.
 */
export function isAnchoredInModalDialog(el: HTMLElement | null | undefined): boolean {
  if (!isBrowser || !el) return false;
  const dialog = el.closest('dialog');
  if (!dialog) return false;
  try {
    return dialog.matches(':modal');
  } catch {
    // `:modal` predates the Popover API in every engine, so an engine that
    // throws on the selector cannot exhibit the top-layer conflict anyway.
    return false;
  }
}
