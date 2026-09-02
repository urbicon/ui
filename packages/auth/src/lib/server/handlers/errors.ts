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
  // Two-factor. The two wrong-code answers are separate codes because they are
  // separate events: `invalid_code` is the sign-in challenge refusing the
  // second factor, `two_factor_setup_code_invalid` is enrolment rejecting a
  // code on a request that authenticates nobody. They answer under different
  // statuses, so one name cannot carry both — see the 400/401 rule on
  // AUTH_ERROR_STATUS.
  invalid_code: 'invalid_code',
  two_factor_setup_code_invalid: 'two_factor_setup_code_invalid',
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
  // Per-user cap on concurrent SSE connections (429). Its own code because a
  // connection cap and a request cap answer under the same status while the
  // reactions differ — wait for `rate_limited`, close a tab here — and backoff
  // never clears a connection cap. `<NotificationListener>` reads the code off
  // the refused `fetch` response and stops instead of reconnecting; whatever
  // reads the log or metrics by `code` tells the two apart the same way. (The
  // opposite call from `feature_unavailable` above for the opposite reason —
  // there each site already carries distinct prose, so a split adds nothing.)
  connection_limit: 'connection_limit',
  // CSRF gate in createAuthHandle (403)
  csrf_failed: 'csrf_failed',
  // Every sign-in ceremony failure a retry can fix. The prose carries no detail
  // on purpose: none of those causes is actionable by the user and one is a
  // possible-clone signal. `onLoginFailed(email, reason)` and the logger
  // separate them server-side (see passkey/handlers.ts).
  // One of the collapsed causes — a missing ceremony cookie — is a request that
  // does not match server state, which the 400/401 rule would put at 400. It
  // stays inside this code anyway: giving it its own status would tell the
  // browser which of the five causes fired, the exact distinction the collapse
  // exists to deny. Do not split it out to satisfy the rule.
  passkey_verification_failed: 'passkey_verification_failed',
  // The same ceremony during enrolment. Its own code because the sign-in half
  // refuses a credential offered to authenticate someone and the enrolment half
  // rejects a ceremony that authenticates nobody — the 400/401 rule on
  // AUTH_ERROR_STATUS, the same cut as the two 2FA codes above.
  passkey_registration_verification_failed: 'passkey_registration_verification_failed',
  // The passkey the browser offered is not stored on the server (deleted from
  // another device; the browser keeps offering it). A retry presents the same
  // passkey to the same server, so the uniform "try again" would loop the
  // user — this code's prose names the way out instead. The audit reasons
  // stay `unknown_credential` / `credential_deleted`.
  passkey_credential_deleted: 'passkey_credential_deleted',
  // The self-service half, where the caller is already signed in: the passkey
  // named in the path is not one of theirs — deleted from another device since
  // the list was fetched, or never theirs at all. One code for both, because
  // telling them apart would answer "does this credential exist?" for a
  // credential the caller does not own. Distinct from
  // `passkey_credential_deleted` above, which refuses a *sign-in* (401) and
  // whose copy tells the user to sign in another way; here the session stands
  // and the fix is to reload the list.
  passkey_not_found: 'passkey_not_found',
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
 * The HTTP status each code answers under. The status is a property of the
 * code, not of the call site: two handlers returning the same code answer
 * under the same status because they read it from here rather than repeating
 * it.
 *
 * `Record<AuthErrorCode, number>` and not `Partial` is the whole enforcement —
 * a new code with no status here fails to compile, so there is no default to
 * fall back to and no way to reach a status this table does not name.
 *
 * **Choosing between 400 and 401 for a new code.** 401 means the request was an
 * attempt to authenticate and the credential it carried was missing or refused.
 * Everything else about a request is 400: a payload the server cannot read, a
 * request that does not match the server's state, and — the case that decides
 * the split pairs below — a wrong secret on a request that was not
 * authenticating anyone. Being signed in is not itself the test: a wrong TOTP
 * during enrolment is 400 because nothing was being authenticated.
 *
 * **What counts as "the credential it carried" needs saying, because two
 * server-issued cookies answer differently.** A refresh token *is* the
 * credential: the request offers it and asks for a session in exchange, so a
 * missing or rejected one is 401. The pending-2FA cookie is only a handle
 * naming which challenge is open — the credential is the TOTP or backup code
 * in the body — so a missing or expired handle is a request that does not
 * match server state, 400. The seam is that `verifySignedToken` returns null
 * for an expired token and a forged one alike, so a forged pending cookie
 * answers 400 where a forged refresh token answers 401. Both are refusals
 * either way; only the class differs, and nothing downstream reads it.
 *
 * The rule reaches only that pair. Every other status is chosen by its own HTTP
 * meaning: 403 when an authenticated caller is refused the action (a failed
 * re-auth gate included), 409 for a conflict, 423, 429, 404, 500 for a fault.
 *
 * Not re-exported from `./index.js`: a consumer reads the status off the
 * `Response`, and pinning the table as API would freeze numbers that belong to
 * the handlers.
 */
export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  // Registration / invitations
  invitation_required: 403,
  invitation_used: 403,
  invitation_expired: 403,
  email_taken: 409,
  email_invited: 409,
  // Login
  invalid_credentials: 401,
  account_locked: 423,
  // No handler in this package sends it (see AUTH_ERROR_CODES), so this is the
  // one status no call site derives — every other entry reproduces what its
  // handlers already answered. 403: the credentials were accepted and the
  // account is refused anyway.
  email_unverified: 403,
  // Tokens
  invalid_token: 400,
  // Re-auth-gated account mutations
  current_password_incorrect: 403,
  // AuthZ / session
  not_authenticated: 401,
  forbidden: 403,
  // Two-factor
  invalid_code: 401,
  two_factor_setup_code_invalid: 400,
  no_2fa_challenge: 400,
  two_factor_challenge_expired: 400,
  two_factor_already_enabled: 400,
  two_factor_setup_required: 400,
  totp_secret_unreadable: 500,
  // Sessions / refresh
  session_not_found: 404,
  missing_refresh_token: 401,
  invalid_refresh_token: 401,
  feature_unavailable: 400,
  // Input validation
  validation_error: 400,
  // Rate limiting / connection caps
  rate_limited: 429,
  connection_limit: 429,
  csrf_failed: 403,
  // Passkeys
  passkey_verification_failed: 401,
  passkey_registration_verification_failed: 400,
  passkey_credential_deleted: 401,
  // 404 and not 403: an authenticated caller naming a passkey that is not
  // theirs must not learn that it exists. Not 401 — the request authenticated
  // someone and its session credential was accepted; what is missing is the
  // row.
  passkey_not_found: 404,
  // Push subscription writes
  push_endpoint_conflict: 409,
  push_subscription_limit: 409,
  server_error: 500
};

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
  /**
   * `Retry-After`, on the two rate-limit codes. Typed as that one header rather
   * than `HeadersInit` because it is the only one any refusal has ever carried,
   * and because the narrower type makes the case worth warning about —
   * a caller passing `Cache-Control`, which {@link authError} would override —
   * impossible to write instead of merely documented.
   */
  headers?: { 'Retry-After': string };
}

/**
 * Build a handler error response carrying BOTH the human `error` prose and the
 * machine `code`. Drop-in for the old `json({ error }, { status })`:
 *
 * ```ts
 * return authError('invitation_required');
 * // → 403 { error: 'An invitation is required to register.', code: 'invitation_required' }
 * ```
 *
 * The status comes from {@link AUTH_ERROR_STATUS} keyed by the code — callers
 * do not pass one. Pass `message` to override the prose (validation field
 * messages), `extra` to add body fields (`{ errors }`), and `headers` for the
 * one header a refusal carries beyond the directive below (`Retry-After`).
 *
 * **`Cache-Control: no-store` is a property of the refusal, not of the call
 * site.** Every code here names an account, a credential state or a rate-limit
 * verdict, and none of it may be replayed to a second caller; `session_not_found`
 * answers 404, which is heuristically storable on its own (RFC 9111 §4.2.2),
 * and `json()` emits nothing but `content-type` and `content-length`. Set once
 * here, no call site can forget it and none has to spell it. The header is put
 * on the response `json()` already built rather than merged into a fresh
 * `Headers`, so a caller's own header cannot be dropped in the process.
 */
export function authError(code: AuthErrorCode, opts: AuthErrorOptions = {}): Response {
  const status = AUTH_ERROR_STATUS[code];
  const response = json(
    { error: opts.message ?? defaultMessage(code), code, ...opts.extra },
    opts.headers ? { status, headers: opts.headers } : { status }
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
