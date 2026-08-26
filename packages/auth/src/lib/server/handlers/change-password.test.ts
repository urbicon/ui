import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import {
  createInMemoryRefreshTokenRepository,
  createInMemoryStore
} from '../adapters/in-memory.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword } from '../password.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createChangePasswordHandler } from './change-password.js';

/** Build an authenticated POST event whose session cookie matches `deps`. */
async function authed<R extends string>(deps: AuthDeps<R>, body: unknown, tokenVersion = 0) {
  const ev = mockPostEvent(body);
  await setSessionCookie(
    ev.cookies as unknown as Cookies,
    { userId: 'user-1', email: 'test@test.com', role: 'admin' as R, tokenVersion },
    deps.config.jwt
  );
  return ev;
}

const run = (deps: AuthDeps<string>, ev: ReturnType<typeof mockPostEvent>) =>
  createChangePasswordHandler(deps).POST(ev as unknown as RequestEvent);

describe('createChangePasswordHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const deps = createMockAuthDeps();
    const res = await run(deps, mockPostEvent({ currentPassword: 'a', newPassword: 'b' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when input is missing', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser()) }
    });
    const res = await run(deps, await authed(deps, { currentPassword: 'only-current' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 (re-auth) when the current password is wrong', async () => {
    const user = createMockUser({ passwordHash: await hashPassword('correct-current') });
    const deps = createMockAuthDeps({ user: { findById: vi.fn().mockResolvedValue(user) } });
    const ev = await authed(deps, { currentPassword: 'WRONG', newPassword: 'NewStrongPass1' });

    const res = await run(deps, ev);
    expect(res.status).toBe(403);
    expect(deps.repos.user.updatePassword).not.toHaveBeenCalled();
    expect(deps.repos.user.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it('returns 400 when the new password fails the strength policy', async () => {
    const user = createMockUser({ passwordHash: await hashPassword('correct-current') });
    const deps = createMockAuthDeps({
      config: { password: { minLength: 8 } },
      user: { findById: vi.fn().mockResolvedValue(user) }
    });
    const ev = await authed(deps, { currentPassword: 'correct-current', newPassword: 'short' });

    const res = await run(deps, ev);
    expect(res.status).toBe(400);
    expect(deps.repos.user.updatePassword).not.toHaveBeenCalled();
  });

  it('changes the password, bumps tokenVersion, revokes all refresh families and keeps this session', async () => {
    const user = createMockUser({ passwordHash: await hashPassword('correct-current') });
    const refreshToken = createInMemoryRefreshTokenRepository(createInMemoryStore());
    const revokeSpy = vi.spyOn(refreshToken, 'revokeAllForUser');
    const onPasswordChanged = vi.fn();
    const deps = createMockAuthDeps({
      config: { refreshToken: {}, hooks: { onPasswordChanged } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      refreshToken
    });
    const ev = await authed(deps, {
      currentPassword: 'correct-current',
      newPassword: 'NewStrongPass1'
    });

    const res = await run(deps, ev);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(deps.repos.user.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    // Every session invalidated …
    expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledWith('user-1');
    expect(revokeSpy).toHaveBeenCalledWith('user-1');
    // … but THIS device stays signed in: a fresh session cookie was re-issued.
    expect(ev._cookieStore.get('session')).toBeTruthy();
    expect(onPasswordChanged).toHaveBeenCalledWith('user-1');
  });

  it('keeps a completed change a 200 when the onPasswordChanged hook throws', async () => {
    const user = createMockUser({ passwordHash: await hashPassword('correct-current') });
    const deps = createMockAuthDeps({
      config: {
        hooks: { onPasswordChanged: vi.fn().mockRejectedValue(new Error('consumer hook exploded')) }
      },
      user: { findById: vi.fn().mockResolvedValue(user) }
    });
    const ev = await authed(deps, {
      currentPassword: 'correct-current',
      newPassword: 'NewStrongPass1'
    });

    const res = await run(deps, ev);

    // The old password is already dead — reporting a failure here would leave
    // the user with neither password working.
    expect(res.status).toBe(200);
    expect(deps.repos.user.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('onPasswordChanged'),
      expect.any(Error)
    );
  });
});
