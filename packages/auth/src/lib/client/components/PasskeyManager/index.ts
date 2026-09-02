import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @summary Add, rename and remove the passkeys on an account.
 * @description Self-service panel for managing passkeys (WebAuthn credentials). Register, list, rename and delete passkeys.
 * Renaming happens inline on the row: the name becomes a text field, Enter or Save commits, Escape or Cancel restores it, and focus returns to the row's rename button either way.
 * Communicates with `apiPath` (default `/api/auth/passkey`). Pair with `createPasskeyHandlers` — this panel uses its `registrationOptions`, `registrationVerify`, `list` (GET `${apiPath}/list`) and `item` (DELETE and PATCH on `${apiPath}/[credentialId]`) groups; the login flow additionally uses `authenticationOptions` and `authenticationVerify`.
 *
 * @tag form
 * @related LoginPage
 * @stability beta
 *
 * @example
 * ```svelte
 * <PasskeyManager {t} apiPath="/api/auth/passkey" />
 * ```
 */
export interface PasskeyManagerProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset, from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for passkey operations. @default '/api/auth/passkey' */
  apiPath?: string;
  /** CSRF cookie/header names. Only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<
      | 'root'
      | 'title'
      | 'error'
      | 'success'
      | 'list'
      | 'item'
      | 'empty'
      | 'renameForm'
      | 'renameField',
      string
    >
  >;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ PasskeyManager: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as PasskeyManager } from './PasskeyManager.svelte';
