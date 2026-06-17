/**
 * @description Unread notification count badge. Uses blocks Badge primitive.
 * Renders nothing when count is 0.
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
  /** Extra classes on the root element. */
  class?: string;
}

export { default as NotificationBadge } from './NotificationBadge.svelte';
