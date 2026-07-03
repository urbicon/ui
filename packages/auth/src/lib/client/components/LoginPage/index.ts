import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { AuthPageSlotClasses } from '../types.js';

/**
 * @description Pre-built login page with email/password, optional passkey, and remember-me.
 * Sends POST to `apiPath` (default `/api/auth/login`). Pair with `createLoginHandler(authDeps)` on the server.
 *
 * @tag form
 * @related RegisterPage
 * @related ForgotPasswordPage
 *
 * @example
 * ```svelte
 * <LoginPage {t} onSuccess={() => goto('/')} />
 * ```
 */
export interface LoginPageProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** Called after successful login. */
  onSuccess?: () => void;
  /** Login mode. `'password'` shows only email/password, `'passkey'` shows only passkey button, `'both'` shows both with separator. @default 'both' */
  mode?: 'password' | 'passkey' | 'both';
  /** Show a "Remember me" checkbox. When checked, sends `rememberMe: true` in the login request body. @default false */
  rememberMe?: boolean;
  /** URL for the register page link. @default '/auth/register' */
  registerUrl?: string;
  /** URL for the forgot-password page link. @default '/auth/forgot-password' */
  forgotPasswordUrl?: string;
  /** API endpoint for the login request. @default '/api/auth/login' */
  apiPath?: string;
  /**
   * API endpoint for the 2FA verify step. When the login response signals
   * `twoFactorRequired`, the page switches to a code-entry step that POSTs here.
   * Pair with `createTwoFactorHandlers().verify`. @default '/api/auth/2fa/verify'
   */
  twoFactorApiPath?: string;
  /** Passkey API base path. Required when mode is `'passkey'` or `'both'`. @default undefined */
  passkeyApiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Content rendered above the form (e.g. social login buttons, welcome text). */
  header?: Snippet;
  /** Content rendered below the form, above links (e.g. terms checkbox). */
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
export { default as LoginPage } from './LoginPage.svelte';
