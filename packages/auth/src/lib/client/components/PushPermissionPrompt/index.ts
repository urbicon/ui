import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @summary Asks, once and politely, whether push notifications are welcome.
 * @description A dismissible prompt that asks the user to enable push notifications,
 * then registers the VAPID subscription with the server.
 *
 * @tag feedback
 * @related NotificationListener
 *
 * @example
 * ```svelte
 * <PushPermissionPrompt {t} vapidPublicKey={PUBLIC_VAPID_KEY}
 *   onSubscribed={(sub) => console.log('Subscribed', sub)}
 * />
 * ```
 */
export interface PushPermissionPromptProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset, from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** VAPID public key for push subscription. */
  vapidPublicKey: string;
  /** API endpoint for registering subscriptions. @default '/api/notifications/push-subscription' */
  apiPath?: string;
  /** CSRF cookie/header names. Only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Called after successful push subscription. */
  onSubscribed?: (subscription: PushSubscription) => void;
  /** Called when the user dismisses the prompt. */
  onDismissed?: () => void;
  /**
   * Called when the prompt closes because push is not available: the user
   * declined the browser permission (`'denied'`) or the browser has no push
   * support (`'unsupported'`). Persist this to avoid remounting the prompt on
   * every visit; without it, a denial is indistinguishable from never having
   * shown the prompt. Operational failures do not close the prompt; they show
   * the error state instead.
   */
  onUnavailable?: (reason: 'denied' | 'unsupported') => void;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<'root' | 'text' | 'error' | 'actions', string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ PushPermissionPrompt: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as PushPermissionPrompt } from './PushPermissionPrompt.svelte';
