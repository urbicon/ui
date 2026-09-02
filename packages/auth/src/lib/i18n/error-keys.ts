import type { AuthErrorCode } from '../server/handlers/errors.js';
import type { AuthLocale } from './keys.js';

/** A key under `AuthLocale['auth']['errors']` — the localized copy for one error code. */
export type AuthErrorMessageKey = keyof AuthLocale['auth']['errors'];

/**
 * Every error code a client can receive → its key in
 * `AuthLocale['auth']['errors']`, or `null` where the code is deliberately not
 * translated through this table.
 *
 * The `satisfies` clause is the point of the file: a new `AuthErrorCode` that
 * nobody keys here is a **compile error**, not an English sentence on a
 * localized page. It also spends nothing at runtime — `AuthErrorCode` is a
 * type-only import, erased by the compiler, so the client bundle stays free of
 * server code.
 *
 * `network_error` is the one entry with no server side: the client stores mint
 * it when a request never reached a server (offline, DNS, CORS).
 */
export const AUTH_ERROR_MESSAGE_KEYS = {
  invitation_required: 'invitationRequired',
  invitation_used: 'invitationUsed',
  invitation_expired: 'invitationExpired',
  email_taken: 'emailTaken',
  email_invited: 'emailInvited',
  invalid_credentials: 'invalidCredentials',
  account_locked: 'accountLocked',
  email_unverified: 'emailUnverified',
  invalid_token: 'invalidToken',
  current_password_incorrect: 'currentPasswordIncorrect',
  not_authenticated: 'notAuthenticated',
  forbidden: 'forbidden',
  invalid_code: 'invalidCode',
  two_factor_setup_code_invalid: 'twoFactorSetupCodeInvalid',
  no_2fa_challenge: 'no2faChallenge',
  two_factor_challenge_expired: 'twoFactorChallengeExpired',
  two_factor_already_enabled: 'twoFactorAlreadyEnabled',
  two_factor_setup_required: 'twoFactorSetupRequired',
  totp_secret_unreadable: 'totpSecretUnreadable',
  session_not_found: 'sessionNotFound',
  missing_refresh_token: 'missingRefreshToken',
  invalid_refresh_token: 'invalidRefreshToken',
  feature_unavailable: 'featureUnavailable',
  validation_error: 'validationError',
  rate_limited: 'rateLimited',
  connection_limit: 'connectionLimit',
  csrf_failed: 'csrfFailed',
  passkey_verification_failed: 'passkeyVerificationFailed',
  passkey_registration_verification_failed: 'passkeyRegistrationVerificationFailed',
  passkey_credential_deleted: 'passkeyCredentialDeleted',
  passkey_not_found: 'passkeyNotFound',
  // The two push codes are the only `null`s: `<PushPermissionPrompt>` renders
  // them from `notifications.push.errorConflict` / `errorLimit`, whose copy is
  // written for that prompt ("remove a device first"). Keying them here too
  // would be a second German sentence for one state. A consumer building its
  // own push prompt reads the code off the body the same way the prompt does.
  push_endpoint_conflict: null,
  push_subscription_limit: null,
  server_error: 'serverError',
  network_error: 'networkError'
} satisfies Record<AuthErrorCode | 'network_error', AuthErrorMessageKey | null>;

/** Codes {@link AUTH_ERROR_MESSAGE_KEYS} maps to `null` — they need English prose of their own. */
export type UnkeyedErrorCode = {
  [K in AuthErrorCode]: (typeof AUTH_ERROR_MESSAGE_KEYS)[K] extends null ? K : never;
}[AuthErrorCode];
