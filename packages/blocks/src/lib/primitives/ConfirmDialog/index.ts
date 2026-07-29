import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
import type { DialogIntent } from '../Dialog';
import type { DialogSlots } from '../Dialog/dialog.variants';

/**
 * Intent applied to the confirm button. Reuses the standard intent palette
 * via {@link DialogIntent} (with `neutral` mapped to `primary` for visual
 * affordance).
 */
export type ConfirmIntent = Exclude<DialogIntent, 'neutral'>;

/**
 * @summary The "are you sure" that replaces the browser's own — styleable, focused, dismissible.
 * @description Pre-configured Dialog for confirming a single, often
 * destructive action. Replaces the native `window.confirm()` with a
 * styleable, focus-trapped, keyboard-accessible modal that matches the
 * design system's intent palette.
 *
 * `onConfirm` may be `async`; while the returned promise is pending the
 * dialog locks itself (no backdrop dismiss, no escape, confirm button
 * shows a spinner). Auto-closes on resolve; on reject it stays open and
 * re-enables, handing the error to `onError`.
 *
 * @tag overlay
 * @related Dialog
 *
 * @example
 * ```svelte
 * <script>
 *   let confirmOpen = $state(false);
 * </script>
 * <Button intent="danger" onclick={() => (confirmOpen = true)}>Delete</Button>
 * <ConfirmDialog
 *   bind:open={confirmOpen}
 *   title="Delete project?"
 *   description="This cannot be undone."
 *   intent="danger"
 *   confirmLabel="Delete"
 *   onConfirm={async () => { await deleteProject(id); }}
 * />
 * ```
 */
export interface ConfirmDialogProps
  extends Omit<HTMLDialogAttributes, 'children' | 'open' | 'title' | 'draggable'> {
  /** Controls visibility. Supports bind:open. */
  open?: boolean;

  /** Heading shown in the dialog header. */
  title: string;

  /** Description rendered above the footer. Use `children` for richer markup. */
  description?: string;

  /**
   * Accent on the dialog header strip. Drives the default `confirmIntent`.
   * @default 'danger'
   */
  intent?: DialogIntent;

  /**
   * Override for the confirm button intent. Defaults to {@link ConfirmDialogProps.intent},
   * with `neutral` upgraded to `primary` for visual affordance.
   */
  confirmIntent?: ConfirmIntent;

  /** Label of the confirm button. Defaults to the localized `button.confirm`. */
  confirmLabel?: string;

  /** Label of the cancel button. Defaults to the localized `button.cancel`. */
  cancelLabel?: string;

  /**
   * Confirm handler. May return a promise — the dialog stays open and shows
   * a loading state while it resolves, then auto-closes on success. If the
   * promise rejects the dialog stays open and re-enables; the rejection is
   * reported via {@link ConfirmDialogProps.onError}.
   */
  onConfirm?: () => void | Promise<void>;

  /**
   * Fired when an async `onConfirm` rejects (or a sync one throws). The
   * dialog stays open and re-enables so the user can retry or cancel — use
   * this to surface the failure (toast, inline message). Without a handler
   * the rejection is logged DEV-only (`console.error`) and swallowed in
   * production; it never escapes as an unhandled promise rejection.
   */
  onError?: (error: unknown) => void;

  /** Fired when the user cancels (button, backdrop, or Escape). */
  onCancel?: () => void;

  /**
   * Externally controlled loading flag. Combined with the internal `busy`
   * flag from an async `onConfirm`. While truthy, both buttons are
   * disabled and dismissal is blocked.
   * @default false
   */
  loading?: boolean;

  /** Whether the backdrop click cancels. @default true */
  closeOnBackdropClick?: boolean;

  /** Whether Escape cancels. @default true */
  closeOnEscape?: boolean;

  /**
   * Override the enter/exit animation duration in milliseconds, forwarded to
   * the underlying {@link Dialog}. Defaults to the overlay token
   * `--blocks-overlay-enter-duration` / `--blocks-overlay-exit-duration`
   * (200ms / 180ms). Respects `prefers-reduced-motion`.
   */
  transitionDuration?: number;

  /**
   * Override the enter/exit easing function, forwarded to the underlying
   * {@link Dialog}. Defaults to the overlay token easing (`quintOut`).
   */
  transitionEasing?: (t: number) => number;

  /** Optional richer markup rendered below `description`. */
  children?: Snippet;

  // ── Styling & attribute contract (forwarded verbatim to the underlying Dialog) ──
  // ConfirmDialog is a pre-configured Dialog, so it does not own a tv()
  // config — the standard unstyled/slotClasses/preset trio resolves
  // against the inner Dialog (presets registered under the `Dialog` key).
  // Extending `HTMLDialogAttributes` (mirroring Dialog/Drawer) additionally
  // lets consumers attach arbitrary `data-*` / `aria-*` / native `<dialog>`
  // attributes: they are gathered as rest props and spread onto the inner
  // Dialog, landing on the same `<dialog>` element Dialog itself uses (e.g.
  // `data-testid` for an e2e hook). Rest props are spread first, so they can
  // never clobber ConfirmDialog's own computed props/handlers.

  /** Extra classes merged onto the dialog element. Forwarded to {@link DialogProps.class}. */
  class?: string;

  /**
   * Strip the underlying Dialog's default styles. Combine with `slotClasses`
   * for a fully custom appearance. @default false
   */
  unstyled?: boolean;

  /**
   * Per-slot class overrides, forwarded to the underlying Dialog.
   * Slots: dialog | backdrop | panel | content | header | title | body | footer.
   */
  slotClasses?: Partial<Record<DialogSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Dialog: {...} }}>`.
   * Resolved against the `Dialog` component key — ConfirmDialog shares the
   * Dialog preset space instead of introducing a parallel one.
   */
  preset?: string;
}

export { default as ConfirmDialog } from './ConfirmDialog.svelte';
