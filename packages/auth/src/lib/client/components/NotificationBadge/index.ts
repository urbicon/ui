/**
 * @summary The unread count on a bell, invisible at zero.
 * @description An unread-count badge that renders nothing when the count is 0.
 *
 * @tag feedback
 * @related NotificationCenter
 *
 * @example
 * ```svelte
 * <NotificationBadge count={store.unreadCount} onclick={() => (open = !open)} />
 * ```
 */
export interface NotificationBadgeProps {
  /** Number of unread notifications. Badge hidden when 0. */
  count: number;
  /** Click handler (e.g. toggle notification center). */
  onclick?: () => void;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: root */
  slotClasses?: Partial<Record<'root', string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ NotificationBadge: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as NotificationBadge } from './NotificationBadge.svelte';
