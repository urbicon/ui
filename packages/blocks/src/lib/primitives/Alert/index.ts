import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { AlertSlots, AlertVariants } from './alert.variants';

/**
 * Props interface for Alert component
 *
 * @summary An inline notice that stays put — status, warning, error or hint, with an optional action.
 * @description Persistent inline notification for communicating status, warnings, errors,
 * or informational messages. Supports icons, titles, descriptions, actions, and dismissal.
 * The announced live-region role follows `intent`: `danger` and `warning` render
 * `role="alert"` (implicitly assertive — it interrupts whatever a screen reader is saying),
 * every other intent renders `role="status"` (polite). An explicit `role` always wins —
 * pass `role="alert"` where a success or info message must interrupt, `role="note"` for a
 * static callout that announces nothing, and `role={undefined}` to drop the attribute when
 * the Alert already sits inside a live region of its own.
 *
 * @tag feedback
 * @related Toast
 * @related Badge
 *
 * @example
 * ```svelte
 * <Alert intent="success" title="Saved successfully">
 *   Your changes have been saved.
 * </Alert>
 * ```
 *
 * @example
 * ```svelte
 * <Alert intent="danger" variant="inline" dismissible onDismiss={() => (visible = false)}>
 *   {#snippet icon()}<AlertCircleIcon size={20} />{/snippet}
 *   Something went wrong. Please try again.
 *   {#snippet actions()}<Button size="sm" variant="ghost">Retry</Button>{/snippet}
 * </Alert>
 * ```
 */
export interface AlertProps
  extends AlertVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  /**
   * Semantic color intent — and the announced urgency with it: `danger` and `warning`
   * render `role="alert"` (assertive), every other intent `role="status"` (polite).
   * An explicit `role` overrides the derived one.
   * @default 'primary'
   * @summary Semantic color — and the announced urgency: danger and warning interrupt, the rest wait.
   */
  intent?: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Visual style @default 'soft' */
  variant?: 'soft' | 'inline' | 'filled';
  /** Size @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Alert title (bold header text) */
  title?: string;
  /** Description content (children slot) */
  children?: Snippet;
  /** Custom icon snippet (replaces default intent icon) */
  icon?: Snippet;
  /** Action buttons snippet */
  actions?: Snippet;
  /** Show dismiss/close button @default false */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | icon | content | title | description | actions | dismissButton */
  slotClasses?: Partial<Record<AlertSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Alert: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Alert } from './Alert.svelte';
export { type AlertVariants, alertVariants } from './alert.variants';
