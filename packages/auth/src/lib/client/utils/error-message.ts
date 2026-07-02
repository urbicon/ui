import type { AuthLocale } from '../../i18n/keys.js';

/**
 * Maps each server `AuthErrorCode` (the `code` field on an error response) to its
 * key in `AuthLocale['auth']['errors']`. Kept as a plain string→string record so
 * the client never imports server code: the code arrives over the wire as a
 * string, and an unrecognised one simply isn't in the map.
 */
const CODE_TO_KEY: Record<string, keyof AuthLocale['auth']['errors']> = {
  invitation_required: 'invitationRequired',
  invitation_used: 'invitationUsed',
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
  server_error: 'serverError'
};

/**
 * Resolve a server error to a localized message. Pass the `code` and `error`
 * fields from a handler's JSON error body plus the active `AuthLocale`:
 *
 * ```ts
 * error = errorMessageFromCode(data.code, t, data.error);
 * ```
 *
 * Resolution order:
 * 1. a known `code` with a localized string → the translation;
 * 2. otherwise the raw server `error` prose (back-compat with non-i18n
 *    consumers and any code not yet translated);
 * 3. otherwise `undefined`, so the caller can apply its own generic fallback.
 *
 * `validation_error` deliberately resolves to the server prose when one is
 * supplied (the field-level "email is invalid" message is more useful than a
 * generic localized string); only a code-less/prose-less validation error uses
 * the generic localized text.
 */
export function errorMessageFromCode(
  code: string | undefined,
  t: AuthLocale,
  fallbackError?: string
): string | undefined {
  // Validation errors carry a precise field message in `error`; prefer it.
  if (code === 'validation_error' && fallbackError) return fallbackError;

  const key = code ? CODE_TO_KEY[code] : undefined;
  if (key) return t.auth.errors[key];

  return fallbackError;
}
