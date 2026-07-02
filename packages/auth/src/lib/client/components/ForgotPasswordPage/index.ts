import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { AuthPageSlotClasses } from '../types.js';

/**
 * @description Pre-built forgot-password page. Sends POST to `apiPath` (default `/api/auth/forgot-password`).
 * Pair with `createForgotPasswordHandler(authDeps)` on the server. Timing-safe to prevent email enumeration.
 *
 * @tag form
 * @related ResetPasswordPage
 * @related LoginPage
 *
 * @example
 * ```svelte
 * <ForgotPasswordPage {t} />
 * ```
 */
export interface ForgotPasswordPageProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** URL for the login page link. @default '/auth/login' */
  loginUrl?: string;
  /** API endpoint. @default '/api/auth/forgot-password' */
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
export { default as ForgotPasswordPage } from './ForgotPasswordPage.svelte';
