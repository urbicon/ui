import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @description Self-service panel for managing passkeys (WebAuthn credentials). Register, list and delete passkeys.
 * Communicates with `apiPath` (default `/api/auth/passkey`). Pair with `createPasskeyHandlers` — this panel uses its `registrationOptions`, `registrationVerify`, `list` (GET `${apiPath}/list`) and `item` (DELETE `${apiPath}/[credentialId]`) groups; the login flow additionally uses `authenticationOptions` and `authenticationVerify`.
 *
 * @tag form
 * @related LoginPage
 *
 * @example
 * ```svelte
 * <PasskeyManager {t} apiPath="/api/auth/passkey" />
 * ```
 */
export interface PasskeyManagerProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for passkey operations. @default '/api/auth/passkey' */
  apiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. See component source for available slot keys. */
  slotClasses?: Partial<Record<'root' | 'title' | 'error' | 'list' | 'item' | 'empty', string>>;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as PasskeyManager } from './PasskeyManager.svelte';
