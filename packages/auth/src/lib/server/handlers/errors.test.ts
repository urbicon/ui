import { describe, expect, it } from 'vitest';
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

  it('exposes every code as a self-keyed constant', () => {
    for (const [key, value] of Object.entries(AUTH_ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });
});
