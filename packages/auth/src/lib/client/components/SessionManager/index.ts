import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @description Lists the user's active sessions (refresh-token families) with a
 * device label, last-active time and a "this device" badge, and lets them sign
 * out an individual session or all other devices. Requires refresh-token
 * rotation on the server (`config.refreshToken`); without it the list reports
 * itself unavailable. Pair with `createListSessionsHandler` (GET `basePath`),
 * `createRevokeSessionHandler` (POST `basePath/revoke`) and
 * `createRevokeOtherSessionsHandler` (POST `basePath/revoke-others`).
 *
 * @tag display
 * @related AccountSettings
 * @related PasskeyManager
 * @stability beta
 *
 * @example
 * ```svelte
 * <SessionManager basePath="/api/auth/sessions" />
 * ```
 */
export interface SessionManagerProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for the session endpoints. @default '/api/auth/sessions' */
  basePath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<'root' | 'title' | 'list' | 'item' | 'empty' | 'badge', string>>;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as SessionManager } from './SessionManager.svelte';
