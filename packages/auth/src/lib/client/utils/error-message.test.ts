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

describe('CODE_TO_KEY drift against the server contract', () => {
  it('every server AuthErrorCode resolves to a localized string — or is on the documented unmapped list', async () => {
    // Test-review finding: the next server code can ship without a client
    // mapping with zero signal — English prose on localized pages, the exact
    // bug class R15 fixed. Codes deliberately unmapped (their server prose
    // carries the detail / a component maps them directly): keep this list
    // in sync with the rationale in client/utils/error-message.ts.
    const EXPECTED_UNMAPPED = new Set([
      'csrf_failed',
      'passkey_verification_failed',
      'push_endpoint_conflict',
      'push_subscription_limit'
    ]);
    const { AUTH_ERROR_CODES } = await import('../../server/handlers/errors.js');
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      const resolved = errorMessageFromCode(code, en);
      if (EXPECTED_UNMAPPED.has(code)) {
        expect(
          resolved,
          `${code} should stay unmapped or be removed from the list`
        ).toBeUndefined();
      } else {
        expect(resolved, `${code} needs a CODE_TO_KEY entry + locale string`).toBeTruthy();
      }
    }
  });
});
