import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';

/**
 * @summary The list behind the bell: read it, clear it, or find it empty.
 * @description Menu-ready notification list with mark-as-read, delete, and empty state.
 * Renders each notification as a clickable card with timestamp. Feed it from `createNotificationStore`,
 * whose routes are served by the `createNotificationsHandlers` server factory.
 *
 * @tag feedback
 * @related NotificationBadge
 * @related NotificationListener
 *
 * @example
 * ```svelte
 * <NotificationCenter {t} notifications={store.notifications}
 *   onMarkAsRead={(id) => store.markAsRead(id)}
 *   onMarkAllAsRead={() => store.markAllAsRead()}
 * />
 * ```
 */
export interface NotificationCenterProps {
  /**
   * Locale overrides, deep-merged over the bundle registered for the active
   * locale — English unless `registerAuthLocale` ran for it. Pass any subset,
   * from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** Notification records to display. */
  notifications: import('../../../server/adapters/types.js').NotificationRecord[];
  /** Called when a single notification is marked as read. */
  onMarkAsRead?: (id: string) => void;
  /** Called when all notifications are marked as read. */
  onMarkAllAsRead?: () => void;
  /** Called when a notification is deleted. */
  onDelete?: (id: string) => void;
  /**
   * Called when a notification is clicked (e.g. to navigate to a URL).
   * SECURITY: `notification.url` is DB-/server-sourced and untrusted; before
   * passing it to `goto()` / `window.location`, validate it is same-origin or
   * relative (reject `javascript:` and absolute cross-origin URLs). Never
   * navigate to a raw `notification.url`.
   */
  onNotificationClick?: (
    notification: import('../../../server/adapters/types.js').NotificationRecord
  ) => void;
  /** Custom notification item renderer. */
  item?: Snippet<[import('../../../server/adapters/types.js').NotificationRecord]>;
  /**
   * Heading level of the component's title, clamped to 1..6. `h2` fits a
   * component placed directly on a page under its `h1`; pass the rank that
   * continues the embedding page's outline where it sits deeper — inside a
   * titled card, tab or popover. The title is styled by class, not by tag,
   * so the level changes none of the component's own styling.
   * @default 2
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<'root' | 'header' | 'list' | 'item' | 'empty', string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ NotificationCenter: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as NotificationCenter } from './NotificationCenter.svelte';
