import type { Snippet } from 'svelte';
import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { AuthUser } from '../../../types.js';
import type { CsrfClientOptions } from '../../csrf.js';

/**
 * @summary Turn on two-factor, keep the backup codes, turn it off again.
 * @description Self-service two-factor (TOTP) management: enrol with an
 * authenticator app, show one-time backup codes, and disable with a password
 * re-auth. Talks to `apiPath` (default `/api/auth/account/2fa`); pair with
 * `createTwoFactorHandlers` — this panel uses its `setup`, `enable` and
 * `disable` groups. The core stays zero-dependency, so QR
 * rendering is delegated to the `qr` snippet — without it the otpauth URI +
 * Base32 secret are shown for manual entry.
 *
 * @tag form
 * @related AccountSettings
 * @related LoginPage
 * @stability beta
 *
 * @example
 * ```svelte
 * <TwoFactorManager {user} onEnabled={() => auth.checkStatus()}>
 *   {#snippet qr({ uri })}
 *     <MyQrCode value={uri} />
 *   {/snippet}
 * </TwoFactorManager>
 * ```
 */
export interface TwoFactorManagerProps {
  /**
   * The current authenticated user — its `totpEnabled` seeds the initial state
   * and its `email` labels the otpauth entry. While `null` the panel renders
   * nothing. Resolve `user` before mount, or remount with
   * `{#key user?.id}…{/key}` to re-seed after an async load.
   */
  user: AuthUser | null;
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** API base path for the 2FA account endpoints. @default '/api/auth/account/2fa' */
  apiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. */
  fetcher?: typeof globalThis.fetch;
  /**
   * QR-code renderer for the otpauth URI shown during setup. Receives the
   * `otpauth://` `uri` and the Base32 `secret`. Optional — the package ships no
   * QR encoder (zero-dep), so without this snippet only the URI + secret are
   * shown for manual entry.
   */
  qr?: Snippet<[{ uri: string; secret: string }]>;
  /** Called after 2FA was successfully enabled (e.g. refresh your auth store). */
  onEnabled?: () => void;
  /** Called after 2FA was disabled. */
  onDisabled?: () => void;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<
      'root' | 'title' | 'section' | 'sectionTitle' | 'field' | 'submit' | 'code' | 'backupCode',
      string
    >
  >;
  /** Extra classes on the root element. */
  class?: string;
}

export { default as TwoFactorManager } from './TwoFactorManager.svelte';
