import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { PasswordPolicy } from '../../../password-policy.js';
import type { AuthUser } from '../../../types.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @summary Self-service panel to change name, email and password, or delete the account.
 * @description Self-service account-settings panel: change name, email and
 * password, and delete the account. Each section talks to `apiPath` (default
 * `/api/auth/account`); pair them with the server handlers
 * `createUpdateProfileHandler`, `createChangeEmailHandler`,
 * `createChangePasswordHandler` and `createDeleteAccountHandler`. The new-password
 * field gates against the server's policy, read from `policyPath`
 * (`createPasswordPolicyHandler`).
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
   * The current authenticated user: its `name` pre-fills the profile field and
   * its `email` is shown as the current address. Pass `locals.user` / your auth
   * store's user. While `null` nothing renders.
   */
  user: AuthUser | null;
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset, from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for the account endpoints. @default '/api/auth/account' */
  apiPath?: string;
  /** CSRF cookie/header names. Only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Called with the refreshed user after a successful profile change (update your store here). */
  onProfileUpdated?: (user: AuthUser) => void;
  /** Called after the account has been deleted (e.g. redirect to a goodbye page). */
  onDeleted?: () => void;
  /**
   * The password policy the new-password field gates against, when you already
   * have it server-side (`resolvePasswordPolicy(config.password)`). Supplying
   * it skips the `policyPath` request.
   */
  passwordPolicy?: PasswordPolicy;
  /**
   * Endpoint serving `createPasswordPolicyHandler`, read once on mount so the
   * checklist and the submit gate match what the server enforces. `null`
   * disables the request and falls back to the package defaults (min 8, no
   * character classes).
   * @default '/api/auth/password-policy'
   */
  policyPath?: string | null;
  /** Show the real-time password requirements checklist under the new password. @default true */
  showRequirements?: boolean;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<
      | 'root'
      | 'title'
      | 'section'
      | 'sectionTitle'
      | 'field'
      | 'requirements'
      | 'submit'
      | 'danger',
      string
    >
  >;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ AccountSettings: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export type { PasswordPolicy } from '../../../password-policy.js';
export { default as AccountSettings } from './AccountSettings.svelte';
