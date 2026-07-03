import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';
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
 * <script>
 *   import { page } from '$app/state';
 * </script>
 * <ResetPasswordPage {t} token={page.url.searchParams.get('token') ?? ''} />
 * ```
 */
export interface ResetPasswordPageProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
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
  /** Content rendered between the heading and the form. */
  header?: Snippet;
  /** Content rendered below the form, above links. */
  footer?: Snippet;
  /** Replaces the link area below the form. */
  links?: Snippet;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. Keys: `root`, `card`, `title`, `form`, `field`, `submit`, `error`, `success`, `links`. */
  slotClasses?: AuthPageSlotClasses;
  /** Extra classes on the root element. */
  class?: string;
}

export type { AuthPageSlotClasses } from '../types.js';
export { default as ResetPasswordPage } from './ResetPasswordPage.svelte';
