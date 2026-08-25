import { json } from '@sveltejs/kit';
import { en } from '../../i18n/en.js';
import { AUTH_ERROR_MESSAGE_KEYS, type UnkeyedErrorCode } from '../../i18n/error-keys.js';

/**
 * Stable, machine-readable error codes returned by the auth handlers alongside
 * the human-readable English `error` prose. A localized client maps the `code`
 * to its own translated string (see `errorMessageFromCode` in the client utils)
 * and falls back to the raw `error` when a code is unknown — so non-i18n
 * consumers keep working unchanged while localized pages stop rendering English.
 *
 * Codes are an append-only contract: never repurpose an existing value, only add
 * new ones. The set is intentionally semantic (not 1:1 with HTTP status) so the
 * same code can carry across handlers that share a meaning (e.g. every
 * re-auth-gated mutation returns `current_password_incorrect`).
 *
 * Validation failures (`validation_error`) keep their field-level `error`
 * message — the client's fallback surfaces it verbatim — because the precise
 * "email is invalid" / "password too short" text is more useful than a generic
 * localized string.
 */
export const AUTH_ERROR_CODES = {
  // Registration / invitations
  invitation_required: 'invitation_required',
  invitation_used: 'invitation_used',
  invitation_expired: 'invitation_expired',
  email_taken: 'email_taken',
  email_invited: 'email_invited',
  // Login
  invalid_credentials: 'invalid_credentials',
  account_locked: 'account_locked',
  // Declared but sent by no handler in this package: login does not gate on
  // `emailVerified`. Kept because the set is append-only — a consumer whose own
  // handler wants that gate sends it and gets the localized copy for free. Do
  // not write a client branch for it against the shipped handlers.
  email_unverified: 'email_unverified',
  // Tokens (verify-email, reset-password, email-change link)
  invalid_token: 'invalid_token',
  // Re-auth-gated account mutations
  current_password_incorrect: 'current_password_incorrect',
  // AuthZ / session
  not_authenticated: 'not_authenticated',
  forbidden: 'forbidden',
  // Two-factor
  invalid_code: 'invalid_code',
  no_2fa_challenge: 'no_2fa_challenge',
  two_factor_challenge_expired: 'two_factor_challenge_expired',
  two_factor_already_enabled: 'two_factor_already_enabled',
  two_factor_setup_required: 'two_factor_setup_required',
  totp_secret_unreadable: 'totp_secret_unreadable',
  // Sessions / refresh
  session_not_found: 'session_not_found',
  missing_refresh_token: 'missing_refresh_token',
  invalid_refresh_token: 'invalid_refresh_token',
  // A configured-but-unavailable feature (2FA / session listing / refresh off).
  // One code for all three: the surrounding UI names which feature it is, so a
  // split would add codes no surface renders differently. The `message` override
  // at each site keeps the distinction for logs and for non-i18n consumers.
  feature_unavailable: 'feature_unavailable',
  // Input validation (field-level message stays in `error`)
  validation_error: 'validation_error',
  // Rate limiting (429) — too many requests, the reaction is to wait
  rate_limited: 'rate_limited',
  // Per-user cap on concurrent SSE connections (429). Its own code because
  // before the split a connection cap and a request cap were the SAME code, so
  // telling "wait" from "close a tab" meant string-matching English prose —
  // and backoff never clears a connection cap. Who can act on it: a consumer
  // whose SSE client is fetch-based, and whatever reads the server log or
  // metrics by `code`. NOT this package's `<NotificationListener>`: it uses
  // native `EventSource`, which exposes no response body at all, so its
  // `onerror` sees an opaque Event and keeps reconnecting. (This is the
  // opposite call from `feature_unavailable` above for the opposite reason —
  // there each site already carries distinct prose, so a split adds nothing.)
  connection_limit: 'connection_limit',
  // CSRF gate in createAuthHandle (403)
  csrf_failed: 'csrf_failed',
  // Every passkey ceremony failure, registration and sign-in alike. The prose
  // carries no detail on purpose: none of the causes is actionable by the user
  // and one is a possible-clone signal. `onLoginFailed(email, reason)` and the
  // logger separate them server-side (see passkey/handlers.ts).
  passkey_verification_failed: 'passkey_verification_failed',
  // Push subscription writes (409): endpoint owned by another account vs.
  // per-user device cap — distinct codes so the client can tell a permanent
  // ownership conflict from "remove a device first".
  push_endpoint_conflict: 'push_endpoint_conflict',
  push_subscription_limit: 'push_subscription_limit',
  // Catch-all server fault
  server_error: 'server_error'
} as const;

/** Union of every machine error code the auth handlers may return. */
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

/**
 * English prose for the codes {@link AUTH_ERROR_MESSAGE_KEYS} leaves unmapped.
 * The mapped type is what keeps this exhaustive: a new code mapped to `null`
 * without an entry here fails to compile.
 */
const UNKEYED_MESSAGES: Record<UnkeyedErrorCode, string> = {
  push_endpoint_conflict: en.notifications.push.errorConflict,
  push_subscription_limit: en.notifications.push.errorLimit
};

/**
 * The English `error` prose for a code, read out of the `en` locale bundle
 * rather than restated here. The bundle is the end-user text; a consumer
 * without i18n gets the same sentence a localized surface renders, instead of
 * the developer-register copy this file used to hold ("Forbidden", "Not
 * authenticated.").
 */
function defaultMessage(code: AuthErrorCode): string {
  const key = AUTH_ERROR_MESSAGE_KEYS[code];
  // TS narrows `key`, not `code`: both tables are total over `AuthErrorCode`
  // by construction (`satisfies` there, the mapped type here), so the branch
  // this cast serves is the one the type system already proved reachable only
  // for the null-keyed codes.
  return key ? en.auth.errors[key] : UNKEYED_MESSAGES[code as UnkeyedErrorCode];
}

interface AuthErrorOptions {
  /** Override the default English prose (e.g. a field-level validation message). */
  message?: string;
  /** Extra fields to merge into the JSON body (e.g. `errors` for validation). */
  extra?: Record<string, unknown>;
  /** Response headers (e.g. `Cache-Control: no-store`). */
  headers?: HeadersInit;
}

/**
 * Build a handler error response carrying BOTH the human `error` prose and the
 * machine `code`. Drop-in for the old `json({ error }, { status })`:
 *
 * ```ts
 * return authError('invitation_required', 403);
 * // → 403 { error: 'An invitation is required to register.', code: 'invitation_required' }
 * ```
 *
 * Pass `message` to override the prose (validation field messages), `extra` to
 * add body fields (`{ errors }`), and `headers` for cache directives.
 */
export function authError(
  code: AuthErrorCode,
  status: number,
  opts: AuthErrorOptions = {}
): Response {
  return json(
    { error: opts.message ?? defaultMessage(code), code, ...opts.extra },
    opts.headers ? { status, headers: opts.headers } : { status }
  );
}
