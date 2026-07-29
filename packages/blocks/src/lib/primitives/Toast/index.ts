import type { HTMLAttributes } from 'svelte/elements';
import type { ToasterSlots, ToastPlacement } from './toast.variants';

/**
 * Canonical intents accepted by the toaster. Use as a runtime list when
 * building dispatchers (e.g. `toaster[intent]?.(title, opts)`); use
 * {@link ToastIntent} for the matching type.
 */
export const TOAST_INTENTS = [
  'primary',
  'info',
  'success',
  'warning',
  'danger',
  'neutral'
] as const;

/**
 * Semantic intent accepted by every toast. Mirrors the design system's
 * standard intent palette.
 */
export type ToastIntent = (typeof TOAST_INTENTS)[number];

/**
 * An action or cancel button rendered inside a toast (Sonner-style).
 */
export interface ToastAction {
  /** Button label. */
  label: string;
  /** Click handler. Receives the toast id so the handler can dismiss/update it. */
  onClick?: (id: string) => void;
  /** Dismiss the toast after the click. @default true */
  dismissOnClick?: boolean;
}

/**
 * Internal data shape for a rendered toast. Created by `toaster.add()`.
 */
export interface ToastData {
  /** Unique identifier assigned automatically. Used for programmatic dismissal via `toaster.dismiss(id)`. */
  id: string;
  /** Semantic color of the toast. Affects border, icon, and progress bar color. @default 'neutral' */
  intent: ToastIntent;
  /** Bold heading line. Omit for a minimal notification. */
  title?: string;
  /** Secondary text below the title. */
  description?: string;
  /** Auto-dismiss delay in milliseconds. Set to `0` for persistent toasts that require manual dismissal. @default 5000 */
  duration: number;
  /** Show a close button so the user can dismiss manually. @default true */
  dismissible: boolean;
  /** Show an animated progress bar that counts down the remaining `duration`. @default true */
  showProgress: boolean;
  /** Primary action button (prominent). */
  action?: ToastAction;
  /** Secondary/cancel button (quiet). */
  cancel?: ToastAction;
  /** Render a spinner instead of the intent icon (used by `toaster.promise` while pending). @default false */
  loading?: boolean;
}

/**
 * Per-state config for `toaster.promise`. Each state is either a plain title
 * string or a full {@link ToastInput}; `success`/`error` may also be a function
 * of the resolved value / rejection reason.
 */
export interface ToastPromiseOptions<T> {
  /** Shown while the promise is pending (spinner, persistent, not dismissible). */
  loading: string | ToastInput;
  /** Shown when the promise resolves. */
  success: string | ToastInput | ((value: T) => string | ToastInput);
  /** Shown when the promise rejects. */
  error: string | ToastInput | ((reason: unknown) => string | ToastInput);
}

/**
 * Options accepted by `toaster.add()` and the shorthand methods (`info`, `success`, `warning`, `danger`).
 * All fields are optional; sensible defaults are applied internally.
 *
 * @example
 * ```typescript
 * toaster.add({
 *   intent: 'success',
 *   title: 'Saved',
 *   description: 'Your changes have been applied.',
 *   duration: 3000,
 *   dismissible: true,
 *   showProgress: true
 * });
 * ```
 */
export type ToastInput = Partial<Omit<ToastData, 'id'>>;

/** Shorthand options for `toaster.info()`, `toaster.success()`, etc. Title and intent are provided as direct arguments. */
export type ToastShorthandOpts = Omit<ToastInput, 'intent' | 'title'>;

/**
 * @summary Brief messages that appear, say their piece and leave.
 * @description Container that renders and manages toast notifications.
 * Place once in your root layout. Use the toaster store to trigger toasts from anywhere.
 *
 * @tag feedback
 * @related Alert
 *
 * @example
 * ```svelte
 * <!-- +layout.svelte -->
 * <Toaster placement="bottom-right" />
 * ```
 *
 * @example
 * ```svelte
 * <script>
 *   import { toaster } from '@urbicon-ui/blocks';
 *
 *   toaster.success('Saved!', { description: 'Changes applied.' });
 *   toaster.danger('Error', { description: 'Something went wrong.', duration: 8000 });
 * </script>
 * ```
 */
export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Screen corner where toasts stack. @default 'bottom-right' */
  placement?: ToastPlacement;
  /** Maximum number of toasts visible at once. Oldest are hidden first. @default 5 */
  max?: number;
  /**
   * Override the enter/exit fly animation duration in milliseconds for every
   * toast in this toaster. Defaults to the overlay token
   * `--blocks-overlay-enter-duration` (200ms). Set globally via the CSS custom
   * property or per-instance via this prop. Respects `prefers-reduced-motion`.
   */
  transitionDuration?: number;
  /** Override the enter/exit fly easing. Defaults to the overlay token easing (`quintOut`). */
  transitionEasing?: (t: number) => number;
  /** Extra classes merged onto the container element. */
  class?: string;
  /** Strip all default tv classes. Use with `slotClasses` for a fully custom look. */
  unstyled?: boolean;
  /** Per-slot class overrides merged with (or replacing, when `unstyled`) the default styles. */
  slotClasses?: Partial<Record<ToasterSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Toaster: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Toaster } from './Toaster.svelte';
export { toaster } from './toast.store.svelte';
export { type ToastPlacement, type ToastVariants, toastVariants } from './toast.variants';
