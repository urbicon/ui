import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en.js';
import { AUTH_ERROR_MESSAGE_KEYS } from '../../i18n/error-keys.js';
import { AUTH_ERROR_CODES, authError } from './errors.js';

describe('authError', () => {
  it('emits both the default English prose and the machine code', async () => {
    const res = authError('invitation_required', 403);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      error: 'An invitation is required to register.',
      code: 'invitation_required'
    });
  });

  it('overrides the prose with `message` while keeping the code', async () => {
    const res = authError('invalid_token', 400, { message: 'Invalid or expired reset token.' });
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired reset token.');
    expect(body.code).toBe('invalid_token');
  });

  it('merges `extra` fields into the body (e.g. validation errors)', async () => {
    const res = authError('validation_error', 400, {
      message: 'Email is invalid',
      extra: { errors: [{ field: 'email', message: 'Email is invalid' }] }
    });
    const body = await res.json();
    expect(body.code).toBe('validation_error');
    expect(body.errors).toEqual([{ field: 'email', message: 'Email is invalid' }]);
  });

  it('applies response headers (e.g. Cache-Control: no-store)', () => {
    const res = authError('not_authenticated', 401, { headers: { 'Cache-Control': 'no-store' } });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('reads the English prose out of the `en` bundle, not a second table', async () => {
    // These two used to carry developer-register copy ("Forbidden", "Not
    // authenticated.") that a consumer without i18n rendered verbatim.
    expect((await authError('forbidden', 403).json()).error).toBe(en.auth.errors.forbidden);
    expect((await authError('not_authenticated', 401).json()).error).toBe(
      en.auth.errors.notAuthenticated
    );
  });

  it('gives the codes with no `auth.errors` key their prose from where they ARE localized', async () => {
    // `<PushPermissionPrompt>` owns the copy for these two; the wire prose must
    // still be the same sentence, not a third wording.
    expect((await authError('push_subscription_limit', 409).json()).error).toBe(
      en.notifications.push.errorLimit
    );
  });

  it('has English prose for every code — no `undefined` on the wire', async () => {
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      const body = await authError(code, 400).json();
      expect(typeof body.error, code).toBe('string');
      expect(body.error.length, code).toBeGreaterThan(0);
    }
    // Positive control on the oracle: the table this derives from is total over
    // the code set, so a code missing from it would have thrown above.
    expect(Object.keys(AUTH_ERROR_MESSAGE_KEYS)).toEqual(
      expect.arrayContaining(Object.values(AUTH_ERROR_CODES))
    );
  });

  it('exposes every code as a self-keyed constant', () => {
    for (const [key, value] of Object.entries(AUTH_ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });
});
