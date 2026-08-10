import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { AuthPageSlotClasses } from '../types.js';

/**
 * @summary The ready-made sign-up page, with the password rules shown as you type.
 * @description Pre-built registration page with invitation-gated signup, password requirements checklist, and confirm field.
 * Sends POST to `apiPath` (default `/api/auth/register`). Pair with `createRegisterHandler(authDeps)` on the server.
 *
 * @tag form
 * @related LoginPage
 *
 * @example
 * ```svelte
 * <RegisterPage {t} onSuccess={() => goto('/')} />
 * ```
 */
export interface RegisterPageProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** Called after successful registration. */
  onSuccess?: () => void;
  /**
   * Pre-fills the email field. Pass the `?email=` query param from the
   * invitation link (`createInvitationHandlers` builds
   * `/auth/register?token=<secret>&email=<invitee>`) so an invited user lands on
   * a ready-to-submit form instead of retyping. Following the same explicit-prop
   * pattern as `ResetPasswordPage`/`VerifyEmailPage`'s `token`, read it from the
   * page in your route (SSR-safe), e.g.
   * `defaultEmail={page.url.searchParams.get('email') ?? ''}`.
   *
   * Convenience only — the invitation names its own address, and registering
   * with a different one is refused.
   * @default ''
   */
  defaultEmail?: string;

  /**
   * The invitation token from the `?token=` query param. **Required to
   * register**: possession of it is the entire proof of invitation (#149), so
   * without it the request is rejected before anything is looked up.
   *
   * Read it in your route the same way as `defaultEmail`:
   * `token={page.url.searchParams.get('token') ?? ''}`.
   *
   * It is a credential: keep it out of logs and analytics, and do not put it in
   * a page title or a shared screenshot.
   * @default ''
   */
  token?: string;
  /** URL for the login page link. @default '/auth/login' */
  loginUrl?: string;
  /** API endpoint. @default '/api/auth/register' */
  apiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Minimum password length. @default 8 */
  passwordMinLength?: number;
  /** Require uppercase letter. @default true */
  requireUppercase?: boolean;
  /** Require lowercase letter. @default true */
  requireLowercase?: boolean;
  /** Require digit. @default true */
  requireDigit?: boolean;
  /** Require special character. @default false */
  requireSpecial?: boolean;
  /** Show real-time password requirements checklist. @default true */
  showRequirements?: boolean;
  /** Content rendered above the form (e.g. social login buttons). */
  header?: Snippet;
  /** Content rendered below the form, above links (e.g. terms checkbox). */
  footer?: Snippet;
  /** Replaces the link area. */
  links?: Snippet;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. Keys: `root`, `card`, `title`, `form`, `field`, `submit`, `error`, `success`, `links`. */
  slotClasses?: AuthPageSlotClasses;
  /** Extra classes on the root element. */
  class?: string;
}

export type { AuthPageSlotClasses } from '../types.js';
export { default as RegisterPage } from './RegisterPage.svelte';
