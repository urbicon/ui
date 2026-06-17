import type { AuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { AuthPageSlotClasses } from '../types.js';

/**
 * @description Pre-built reset-password page with password confirmation.
 * Sends POST to `apiPath` (default `/api/auth/reset-password`). Pair with `createResetPasswordHandler(authDeps)` on the server.
 *
 * @tag form
 * @related ForgotPasswordPage
 * @related LoginPage
 *
 * @example
 * ```svelte
 * <ResetPasswordPage {t} token={$page.url.searchParams.get('token') ?? ''} />
 * ```
 */
export interface ResetPasswordPageProps {
  /** Locale bundle. Auto-detected from i18n context when omitted. */
  t?: AuthLocale;
  /** Reset token from URL query parameter. */
  token: string;
  /** URL for the login page link. @default '/auth/login' */
  loginUrl?: string;
  /** API endpoint. @default '/api/auth/reset-password' */
  apiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. Keys: `root`, `card`, `title`, `form`, `field`, `submit`, `error`, `success`, `links`. */
  slotClasses?: AuthPageSlotClasses;
  /** Extra classes on the root element. */
  class?: string;
}

export type { AuthPageSlotClasses } from '../types.js';
export { default as ResetPasswordPage } from './ResetPasswordPage.svelte';
