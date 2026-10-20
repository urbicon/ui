import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { PasswordPolicy } from '../../../password-policy.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { AuthPageSlotClasses } from '../types.js';

/**
 * @summary The ready-made page for choosing a new password.
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
   * Locale overrides, deep-merged over the bundle registered for the active
   * locale — English unless `registerAuthLocale` ran for it. Pass any subset,
   * from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** Reset token from URL query parameter. */
  token: string;
  /** URL for the login page link. @default '/auth/login' */
  loginUrl?: string;
  /** API endpoint for the reset request. @default '/api/auth/reset-password' */
  apiPath?: string;
  /** CSRF cookie/header names. Only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /**
   * The password policy to gate against, when you already have it server-side
   * (`resolvePasswordPolicy(config.password)` in a `+page.server.ts` load).
   * Supplying it skips the `policyPath` request.
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
  /** Show the real-time password requirements checklist. @default true */
  showRequirements?: boolean;
  /** Content rendered between the heading and the form. */
  header?: Snippet;
  /** Content rendered below the form, above links. */
  footer?: Snippet;
  /** Replaces the link area below the form. */
  links?: Snippet;
  /**
   * Heading level of the page title, clamped to 1..6. `h1` fits a page that is
   * its own route; pass a lower rank where the surrounding layout already owns
   * the `h1` — a docs page, a dialog, a tab of a settings screen. The title
   * is styled by class, not by tag, so the level changes none of the component's own styling.
   * @default 1
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. Keys: `root`, `card`, `title`, `form`, `field`, `requirements`, `submit`, `error`, `success`, `links`. */
  slotClasses?: AuthPageSlotClasses;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ResetPasswordPage: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export type { PasswordPolicy } from '../../../password-policy.js';
export type { AuthPageSlotClasses } from '../types.js';
export { default as ResetPasswordPage } from './ResetPasswordPage.svelte';
