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
    // Codes minted on the client (never in AUTH_ERROR_CODES) — listed here so
    // the drift gate covers them too: the server-side iteration alone is
    // structurally blind to them (surviving-mutant finding, package 5).
    const CLIENT_SYNTHESIZED_CODES = ['network_error'];
    const { AUTH_ERROR_CODES } = await import('../../server/handlers/errors.js');
    for (const code of [...Object.values(AUTH_ERROR_CODES), ...CLIENT_SYNTHESIZED_CODES]) {
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
