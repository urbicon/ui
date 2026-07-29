import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { AuthPageSlotClasses } from '../types.js';

/**
 * @summary Confirms the address from the link in the mail.
 * @description Auto-verifying email confirmation page. Sends POST `{ token }` to `apiPath` (default `/api/auth/verify-email`) on mount.
 * Pair with `createVerifyEmailHandler(authDeps)` on the server.
 *
 * @tag feedback
 * @related RegisterPage
 *
 * @example
 * ```svelte
 * <script>
 *   import { page } from '$app/state';
 * </script>
 * <VerifyEmailPage {t} token={page.url.searchParams.get('token') ?? ''} />
 * ```
 */
export interface VerifyEmailPageProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** Verification token from URL query parameter. */
  token: string;
  /** API endpoint. @default '/api/auth/verify-email' */
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
export { default as VerifyEmailPage } from './VerifyEmailPage.svelte';
