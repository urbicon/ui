import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @summary Every device signed in to this account, and the button to sign them out.
 * @description Lists the user's active sessions (refresh-token families) with a
 * device label, last-active time and a "this device" badge, and lets them sign
 * out an individual session or all other devices. Requires refresh-token
 * rotation on the server (`config.refreshToken`); without it the list reports
 * itself unavailable. Pair with `createSessionsHandlers` — mount its `list`
 * (GET `apiPath`), `revoke` (POST `apiPath/revoke`) and `revokeOthers`
 * (POST `apiPath/revoke-others`) groups.
 *
 * @tag display
 * @related AccountSettings
 * @related PasskeyManager
 * @stability beta
 *
 * @example
 * ```svelte
 * <SessionManager apiPath="/api/auth/sessions" />
 * ```
 */
export interface SessionManagerProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset, from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for the session endpoints. @default '/api/auth/sessions' */
  apiPath?: string;
  /** CSRF cookie/header names. Only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<'root' | 'title' | 'error' | 'list' | 'item' | 'empty' | 'badge', string>
  >;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as SessionManager } from './SessionManager.svelte';
