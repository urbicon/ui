import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en.js';
import { AUTH_ERROR_MESSAGE_KEYS } from '../../i18n/error-keys.js';
import { AUTH_ERROR_CODES, AUTH_ERROR_STATUS, authError } from './errors.js';

describe('authError', () => {
  it('emits both the default English prose and the machine code', async () => {
    const res = authError('invitation_required');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      error: 'An invitation is required to register.',
      code: 'invitation_required'
    });
  });

  it('overrides the prose with `message` while keeping the code', async () => {
    const res = authError('invalid_token', { message: 'Invalid or expired reset token.' });
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired reset token.');
    expect(body.code).toBe('invalid_token');
  });

  it('merges `extra` fields into the body (e.g. validation errors)', async () => {
    const res = authError('validation_error', {
      message: 'Email is invalid',
      extra: { errors: [{ field: 'email', message: 'Email is invalid' }] }
    });
    const body = await res.json();
    expect(body.code).toBe('validation_error');
    expect(body.errors).toEqual([{ field: 'email', message: 'Email is invalid' }]);
  });

  it('sets the cache directive itself, on a refusal that passes no headers', () => {
    expect(authError('not_authenticated').headers.get('Cache-Control')).toBe('no-store');
  });

  it('forwards Retry-After beside the directive it sets', () => {
    // The two must coexist: the directive is written onto the response `json()`
    // already built, so a header the caller passed cannot be lost to it.
    const res = authError('rate_limited', { headers: { 'Retry-After': '30' } });
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('reads the English prose out of the `en` bundle, not a second table', async () => {
    // These two used to carry developer-register copy ("Forbidden", "Not
    // authenticated.") that a consumer without i18n rendered verbatim.
    expect((await authError('forbidden').json()).error).toBe(en.auth.errors.forbidden);
    expect((await authError('not_authenticated').json()).error).toBe(
      en.auth.errors.notAuthenticated
    );
  });

  it('gives the codes with no `auth.errors` key their prose from where they ARE localized', async () => {
    // `<PushPermissionPrompt>` owns the copy for these two; the wire prose must
    // still be the same sentence, not a third wording.
    expect((await authError('push_subscription_limit').json()).error).toBe(
      en.notifications.push.errorLimit
    );
  });

  it('has English prose for every code — no `undefined` on the wire', async () => {
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      const body = await authError(code).json();
      expect(typeof body.error, code).toBe('string');
      expect(body.error.length, code).toBeGreaterThan(0);
    }
    // Positive control on the oracle: the table this derives from is total over
    // the code set, so a code missing from it would have thrown above.
    expect(Object.keys(AUTH_ERROR_MESSAGE_KEYS)).toEqual(
      expect.arrayContaining(Object.values(AUTH_ERROR_CODES))
    );
  });

  it('takes the status from AUTH_ERROR_STATUS rather than from the caller', async () => {
    // The wiring, not the numbers: an implementation that hardcoded a status
    // would pass every prose assertion above and fail here.
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      expect(authError(code).status, code).toBe(AUTH_ERROR_STATUS[code]);
    }
  });

  it('gives every code a client- or server-error status', () => {
    // Totality is the compiler's job (`Record<AuthErrorCode, number>`); the
    // value is not, and a typo lands on a status that answers "success".
    for (const [code, status] of Object.entries(AUTH_ERROR_STATUS)) {
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status, code).toBeLessThan(600);
    }
  });

  it('splits every sign-in/enrolment pair across the 400/401 boundary', () => {
    // Both families had one name doing two jobs. The rule that separates them
    // (401 = a credential offered to authenticate was refused) lives on
    // AUTH_ERROR_STATUS; the handlers that send them are pinned in
    // two-factor.test.ts and the passkey suites.
    expect(AUTH_ERROR_STATUS.invalid_code).toBe(401);
    expect(AUTH_ERROR_STATUS.two_factor_setup_code_invalid).toBe(400);
    expect(AUTH_ERROR_STATUS.passkey_verification_failed).toBe(401);
    expect(AUTH_ERROR_STATUS.passkey_registration_verification_failed).toBe(400);
  });

  it('answers every missing-or-refused credential with 401, and nothing else', () => {
    // The class the split buys: whichever factor refused, and whether the
    // credential was invalid, unknown or absent, the status is the same — so a
    // client mapping 401 to "discard the session, show sign-in" is never wrong
    // and never has to read the code to get the coarse decision right.
    //
    // Asserted as exact membership, both directions: a new code quietly added
    // at 401, or one of these moved off it, fails here. Which is the review
    // this class deserves — it is what a consumer branches on.
    const expected = [
      'invalid_credentials',
      'invalid_code',
      'invalid_refresh_token',
      'missing_refresh_token',
      'not_authenticated',
      'passkey_credential_deleted',
      'passkey_verification_failed'
    ];
    const actual = Object.entries(AUTH_ERROR_STATUS)
      .filter(([, status]) => status === 401)
      .map(([code]) => code)
      .sort();
    expect(actual).toEqual([...expected].sort());
  });

  it('exposes every code as a self-keyed constant', () => {
    for (const [key, value] of Object.entries(AUTH_ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });
});
