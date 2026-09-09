import type { HTMLAttributes } from 'svelte/elements';
import type { PartialAuthLocale } from '../../../i18n/keys.js';

/**
 * @summary The unread count on a bell, invisible at zero.
 * @description An unread-count badge that renders nothing when the count is 0.
 * The visible text is the count, capped at `99+`; the accessible name is the
 * localized `notifications.badge.unread` string with that same text substituted
 * for `{n}`, so the badge announces "Unread notifications: 3" instead of a bare
 * number. Pass your own `aria-label` (or any other attribute — the rest spread
 * reaches the badge root) to override it.
 *
 * The ARIA role follows the handler, because `Badge` derives it: with an
 * `onclick` the badge is a `button` and a tab stop; without one it is a
 * `status` — a polite live region, so a changing count announces itself.
 *
 * @tag feedback
 * @related NotificationCenter
 *
 * @example
 * ```svelte
 * <NotificationBadge count={store.unreadCount} onclick={() => (open = !open)} />
 * ```
 */
export interface NotificationBadgeProps
  extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'class' | 'onclick' | 'role'> {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset, from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** Number of unread notifications. Badge hidden when 0. */
  count: number;
  /** Click handler (e.g. toggle notification center). Also what makes the badge a `button` and a tab stop. */
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
  /**
   * ARIA role, passed to `Badge`. Leave unset to take the derived one: `button`
   * with an `onclick`, `status` (a polite live region) without.
   * @summary Announced role; without it the badge is a button when clickable, a polite status otherwise.
   */
  role?: 'status' | 'alert' | 'button';
}

export { default as NotificationBadge } from './NotificationBadge.svelte';
