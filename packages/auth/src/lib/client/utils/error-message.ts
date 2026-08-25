import { AUTH_ERROR_MESSAGE_KEYS, type AuthErrorMessageKey } from '../../i18n/error-keys.js';
import type { AuthLocale } from '../../i18n/keys.js';

// The code arrives over the wire as an arbitrary string — an old server, a
// proxy, a typo — so the lookup is widened to `string` here. The table itself
// stays bound to the `AuthErrorCode` union (see `i18n/error-keys.ts`); this
// assignment only relaxes the *index*, never the value type.
const CODE_TO_KEY: Record<string, AuthErrorMessageKey | null | undefined> = AUTH_ERROR_MESSAGE_KEYS;

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
  // An empty string carries no information — normalize it to "no prose" so a
  // `{ "error": "" }` body can never win the chain and blank the error UI
  // (`'' ?? generic` would NOT fall through; `{#if error}` would render nothing).
  const prose = fallbackError || undefined;

  // Validation errors carry a precise field message in `error`; prefer it.
  if (code === 'validation_error' && prose) return prose;

  const key = code ? CODE_TO_KEY[code] : undefined;
  // `t` is complete by type (and by mergeAuthLocale at every component call
  // site), but this is a root export: a JS consumer can still hand it a bare
  // partial object — including one missing the whole `auth.errors` subtree.
  // Full read-tolerance (`?.` + `||`) keeps that failure on the server prose
  // instead of throwing inside the caller's error path.
  if (key) return (t.auth?.errors?.[key] || undefined) ?? prose;

  return prose;
}
