import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { AuthUser } from '../../../types.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @summary Self-service panel to change name, email and password, or delete the account.
 * @description Self-service account-settings panel: change name, email and
 * password, and delete the account. Each section talks to `apiPath` (default
 * `/api/auth/account`); pair them with the server handlers
 * `createUpdateProfileHandler`, `createChangeEmailHandler`,
 * `createChangePasswordHandler` and `createDeleteAccountHandler`.
 *
 * @tag form
 * @related PasskeyManager
 * @related LoginPage
 * @stability beta
 *
 * @example
 * ```svelte
 * <AccountSettings {user} onProfileUpdated={(u) => (auth.user = u)} onDeleted={() => goto('/')} />
 * ```
 */
export interface AccountSettingsProps {
  /**
   * The current authenticated user — its `name` pre-fills the profile field and
   * its `email` is shown as the current address. Pass `locals.user` / your auth
   * store's user. While `null` the panel renders nothing.
   */
  user: AuthUser | null;
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for the account endpoints. @default '/api/auth/account' */
  apiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Called with the refreshed user after a successful profile change (update your store here). */
  onProfileUpdated?: (user: AuthUser) => void;
  /** Called after the account has been deleted (e.g. redirect to a goodbye page). */
  onDeleted?: () => void;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<'root' | 'title' | 'section' | 'sectionTitle' | 'field' | 'submit' | 'danger', string>
  >;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as AccountSettings } from './AccountSettings.svelte';
