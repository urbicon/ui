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
