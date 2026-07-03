import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createResetPasswordHandler } from './reset-password.js';

const event = (body: unknown) => mockPostEvent(body) as unknown as RequestEvent;

describe('createResetPasswordHandler', () => {
  it('returns 400 when token or password is missing', async () => {
    const deps = createMockAuthDeps();
    const res = await createResetPasswordHandler(deps).POST(event({ token: 'x' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the password fails the strength policy', async () => {
    const deps = createMockAuthDeps({ config: { password: { minLength: 12 } } });
    const res = await createResetPasswordHandler(deps).POST(
      event({ token: 'tok', password: 'short' })
    );
    expect(res.status).toBe(400);
    // The token must NOT be consumed when the password is rejected upfront.
    expect(deps.repos.user.consumeResetToken).not.toHaveBeenCalled();
  });

  it('returns 400 when the reset token cannot be claimed (invalid/expired/used)', async () => {
    const deps = createMockAuthDeps({
      user: { consumeResetToken: vi.fn().mockResolvedValue(null) }
    });
    const res = await createResetPasswordHandler(deps).POST(
      event({ token: 'bad', password: 'a-good-password' })
    );
    expect(res.status).toBe(400);
    expect(deps.repos.user.updatePassword).not.toHaveBeenCalled();
  });

  it('on a successful claim: updates password, bumps tokenVersion, revokes refresh family, fires hook', async () => {
    const onPasswordChanged = vi.fn();
    const revokeAllForUser = vi.fn();
    const deps = createMockAuthDeps({
      config: { hooks: { onPasswordChanged } },
      user: { consumeResetToken: vi.fn().mockResolvedValue(createMockUser({ id: 'u-9' })) },
      refreshToken: {
        create: vi.fn(),
        findByHash: vi.fn(),
        revoke: vi.fn(),
        revokeFamily: vi.fn(),
        revokeAllForUser,
        deleteExpired: vi.fn(),
        listActiveByUser: vi.fn(),
        revokeFamilyForUser: vi.fn(),
        revokeOtherFamiliesForUser: vi.fn()
      }
    });

    const res = await createResetPasswordHandler(deps).POST(
      event({ token: 'tok', password: 'a-good-password' })
    );

    expect(res.status).toBe(200);
    expect(deps.repos.user.updatePassword).toHaveBeenCalledWith('u-9', expect.any(String));
    expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledWith('u-9');
    expect(revokeAllForUser).toHaveBeenCalledWith('u-9');
    expect(onPasswordChanged).toHaveBeenCalledWith('u-9');
  });

  it('single-use: a concurrent second claim of the same token is rejected', async () => {
    // Model the atomic claim: first call wins (returns the user), second loses.
    const consumeResetToken = vi
      .fn()
      .mockResolvedValueOnce(createMockUser({ id: 'u-1' }))
      .mockResolvedValueOnce(null);
    const deps = createMockAuthDeps({ user: { consumeResetToken } });
    const handler = createResetPasswordHandler(deps);

    const [a, b] = await Promise.all([
      handler.POST(event({ token: 'tok', password: 'a-good-password' })),
      handler.POST(event({ token: 'tok', password: 'a-good-password' }))
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(deps.repos.user.updatePassword).toHaveBeenCalledTimes(1);
  });

  // Cluster J: the reset-password *consume* handler reads the `resetPassword`
  // key — deliberately distinct from forgot-password's `forgotPassword`. Assert
  // it so a future rename can't silently cross-wire (or disable) the limit.
  it('returns 429 once the reset rate limit is exceeded (resetPassword key)', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { resetPassword: { windowMs: 60_000, max: 1 } } }
    });
    const handler = createResetPasswordHandler(deps);
    const body = { token: 'tok', password: 'a-good-password' };
    await handler.POST(event(body));
    const limited = await handler.POST(event(body));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
