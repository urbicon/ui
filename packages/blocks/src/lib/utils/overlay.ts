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
  if (focusable.length === 0) return;

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

export function lockBodyScroll(): void {
  if (!isBrowser) return;
  if (bodyScrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
}

export function unlockBodyScroll(): void {
  if (!isBrowser) return;
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow ?? '';
    savedBodyOverflow = undefined;
  }
}

export function focusFirstElement(container: HTMLElement | undefined): void {
  if (!isBrowser) return;
  tick().then(() => {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) focusable[0].focus();
  });
}

export function showDialogModal(
  dialogEl: HTMLDialogElement | undefined,
  panelEl: HTMLElement | undefined
): void {
  if (!isBrowser) return;
  lockBodyScroll();
  tick().then(() => {
    dialogEl?.showModal();
    focusFirstElement(panelEl);
  });
}

export function closeDialogModal(
  dialogEl: HTMLDialogElement | undefined,
  previouslyFocused: HTMLElement | null
): void {
  if (!isBrowser) return;
  if (dialogEl?.open) dialogEl.close();
  unlockBodyScroll();
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
