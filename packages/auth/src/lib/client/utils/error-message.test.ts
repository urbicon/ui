import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de.js';
import { en } from '../../i18n/en.js';
import type { AuthLocale } from '../../i18n/keys.js';
import { errorMessageFromCode } from './error-message.js';

describe('errorMessageFromCode', () => {
  it('maps a known code to the localized string (en)', () => {
    expect(errorMessageFromCode('invitation_required', en, 'raw prose')).toBe(
      en.auth.errors.invitationRequired
    );
  });

  it('maps a known code to the localized string (de) — not the English prose', () => {
    const msg = errorMessageFromCode('invalid_credentials', de, 'Invalid email or password.');
    expect(msg).toBe(de.auth.errors.invalidCredentials);
    expect(msg).not.toBe('Invalid email or password.');
  });

  it('falls back to the raw server prose for an unknown code', () => {
    expect(errorMessageFromCode('totally_unknown_code', en, 'Server said this')).toBe(
      'Server said this'
    );
  });

  it('falls back to the raw prose when no code is present', () => {
    expect(errorMessageFromCode(undefined, en, 'Legacy server error')).toBe('Legacy server error');
  });

  it('returns undefined when neither a known code nor prose is available', () => {
    expect(errorMessageFromCode(undefined, en, undefined)).toBeUndefined();
    expect(errorMessageFromCode('unknown', en, undefined)).toBeUndefined();
  });

  it('prefers the field-level prose for a validation_error', () => {
    // The precise "Email is invalid" message beats a generic localized string.
    expect(errorMessageFromCode('validation_error', de, 'Email is invalid')).toBe(
      'Email is invalid'
    );
  });

  it('uses the generic localized validation message when no prose is supplied', () => {
    expect(errorMessageFromCode('validation_error', de, undefined)).toBe(
      de.auth.errors.validationError
    );
  });

  it('maps the client-synthesized network_error without needing server prose', () => {
    // The stores emit `{ code: 'network_error' }` with NO error prose (the
    // request never reached a server that could write any) — so unlike every
    // server code, this one has no prose fallback layer. An unmapped
    // network_error degrades straight to the caller's generic message with
    // zero signal (surviving-mutant finding, package-5 test review).
    expect(errorMessageFromCode('network_error', en)).toBe(en.auth.errors.networkError);
    expect(errorMessageFromCode('network_error', de)).toBe(de.auth.errors.networkError);
  });

  it('falls back to the server prose when a JS consumer bundle lacks the key at runtime', () => {
    // errorMessageFromCode is a root export: a JS consumer can hand it a bare
    // partial object the type system never saw. The read-tolerant `??` must
    // surface the prose instead of rendering `undefined`.
    const bare = { auth: { errors: {} } } as AuthLocale;
    expect(errorMessageFromCode('invalid_credentials', bare, 'Server prose.')).toBe(
      'Server prose.'
    );
  });

  it('tolerates a bundle missing the whole auth/errors subtree (no throw in the error path)', () => {
    // Silent-failure review M2: `t.auth.errors[key]` threw a TypeError for a
    // KNOWN code when the hand-rolled bundle lacked the subtree — an unhandled
    // rejection inside the consumer's failure branch.
    expect(errorMessageFromCode('invalid_credentials', {} as AuthLocale, 'Prose.')).toBe('Prose.');
    expect(errorMessageFromCode('invalid_credentials', { auth: {} } as AuthLocale, 'Prose.')).toBe(
      'Prose.'
    );
  });

  it('normalizes an empty prose string to undefined instead of returning it', () => {
    expect(errorMessageFromCode(undefined, en, '')).toBeUndefined();
    expect(errorMessageFromCode('totally_unknown_code', en, '')).toBeUndefined();
    expect(errorMessageFromCode('validation_error', en, '')).toBe(en.auth.errors.validationError);
  });

  it('localizes csrf_failed instead of showing the security term from the server', () => {
    // `handle.ts` answers 403 with "CSRF validation failed" — a security term
    // under a login form. The reaction (reload) is only in the locale string.
    const msg = errorMessageFromCode('csrf_failed', de, 'CSRF validation failed');
    expect(msg).toBe(de.auth.errors.csrfFailed);
    expect(msg).not.toBe('CSRF validation failed');
  });

  it('localizes passkey_verification_failed over every server prose it may carry', () => {
    // The eight ceremony failures share one code; none of their English
    // sentences may reach the user, least of all the clone warning.
    for (const prose of [
      'Challenge expired or not found',
      'Counter did not increase — possible cloned authenticator',
      undefined
    ]) {
      expect(errorMessageFromCode('passkey_verification_failed', de, prose)).toBe(
        de.auth.errors.passkeyVerificationFailed
      );
    }
  });

  it('separates the connection cap from the request cap (both 429)', () => {
    expect(errorMessageFromCode('connection_limit', de)).toBe(de.auth.errors.connectionLimit);
    expect(errorMessageFromCode('connection_limit', de)).not.toBe(de.auth.errors.rateLimited);
  });

  it('covers every code key with a non-empty string in both bundles', () => {
    // Guards against an AuthLocale errors key being added without translations.
    for (const bundle of [en, de] as AuthLocale[]) {
      for (const value of Object.values(bundle.auth.errors)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
