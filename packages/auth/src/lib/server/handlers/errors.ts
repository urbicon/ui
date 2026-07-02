import { json } from '@sveltejs/kit';

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
  email_taken: 'email_taken',
  email_invited: 'email_invited',
  // Login
  invalid_credentials: 'invalid_credentials',
  account_locked: 'account_locked',
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
  // A configured-but-unavailable feature (2FA / session listing / refresh off)
  feature_unavailable: 'feature_unavailable',
  // Input validation (field-level message stays in `error`)
  validation_error: 'validation_error',
  // Rate limiting (429) — also used for connection caps
  rate_limited: 'rate_limited',
  // CSRF gate in createAuthHandle (403)
  csrf_failed: 'csrf_failed',
  // Passkey ceremony failures (options/verify; the prose carries the detail)
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
 * Canonical English prose for each code. This is the SAME copy the handlers
 * returned before codes existed, centralised here so the `error` string stays
 * byte-for-byte back-compatible while every response now also carries a `code`.
 */
const DEFAULT_MESSAGES: Record<AuthErrorCode, string> = {
  invitation_required: 'An invitation is required to register.',
  invitation_used: 'This invitation has already been used.',
  email_taken: 'This email is already registered.',
  email_invited: 'This email has already been invited.',
  invalid_credentials: 'Invalid email or password.',
  account_locked: 'Account locked. Please try again later.',
  email_unverified: 'Please verify your email first.',
  invalid_token: 'Invalid or expired token.',
  current_password_incorrect: 'Current password is incorrect.',
  not_authenticated: 'Not authenticated.',
  forbidden: 'Forbidden',
  invalid_code: 'Invalid code.',
  no_2fa_challenge: 'No pending two-factor challenge.',
  two_factor_challenge_expired: 'Two-factor challenge expired. Please sign in again.',
  two_factor_already_enabled: 'Two-factor is already enabled.',
  two_factor_setup_required: 'Start two-factor setup first.',
  totp_secret_unreadable: 'Could not read the stored secret.',
  session_not_found: 'Session not found.',
  missing_refresh_token: 'Missing refresh token.',
  invalid_refresh_token: 'Invalid refresh token.',
  feature_unavailable: 'This feature is not available.',
  validation_error: 'Invalid input.',
  rate_limited: 'Too many requests. Please try again later.',
  csrf_failed: 'CSRF validation failed',
  passkey_verification_failed: 'Passkey verification failed.',
  push_endpoint_conflict: 'Subscription endpoint is registered to another account',
  push_subscription_limit: 'Subscription limit reached',
  server_error: 'Something went wrong. Please try again.'
};

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
    { error: opts.message ?? DEFAULT_MESSAGES[code], code, ...opts.extra },
    opts.headers ? { status, headers: opts.headers } : { status }
  );
}
