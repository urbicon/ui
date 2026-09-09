import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import {
  createInMemoryRefreshTokenRepository,
  createInMemoryStore
} from '../adapters/in-memory.js';
import type { UserRepository } from '../adapters/types.js';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { issueRefreshToken } from '../refresh-token.js';
import { setSessionCookie } from '../session.js';
import {
  createMockInvitationRepository,
  createMockUser,
  createMockUserRepository
} from '../test-utils.js';
import { createLogoutHandler } from './logout.js';

function createMockDeps(
  refreshEnabled = false,
  user: Partial<UserRepository> = {}
): AuthDeps & { repos: { user: UserRepository } } {
  const refreshRepo = refreshEnabled
    ? createInMemoryRefreshTokenRepository(createInMemoryStore())
    : undefined;
  return {
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '15m' },
      ...(refreshEnabled ? { refreshToken: { refreshTokenTtl: '30d' } } : {})
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    repos: {
      user: createMockUserRepository(user),
      invitation: createMockInvitationRepository(),
      refreshToken: refreshRepo
    },
    email: { send: vi.fn() }
  };
}

/** A user repo that resolves `user-1` — what `requireSessionUser` reads. */
function signedInUserRepo(overrides: Partial<UserRepository> = {}): Partial<UserRepository> {
  return {
    findById: vi.fn().mockResolvedValue(createMockUser({ id: 'user-1', tokenVersion: 0 })),
    ...overrides
  };
}

function mockEvent(initialCookies: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialCookies));
  return {
    cookies: {
      get: (name: string) => store.get(name),
      set: (name: string, value: string) => store.set(name, value),
      delete: (name: string) => store.delete(name),
      getAll: () => [],
      serialize: () => ''
    },
    _store: store,
    request: new Request('http://localhost:3000/api/auth/logout', { method: 'POST' }),
    url: new URL('http://localhost:3000/api/auth/logout'),
    params: {},
    locals: {},
    platform: undefined,
    route: { id: '/api/auth/logout' },
    isDataRequest: false,
    isSubRequest: false,
    getClientAddress: () => '127.0.0.1'
  };
}

/** An event carrying a session cookie `requireSessionUser` accepts. */
async function signedInEvent(deps: AuthDeps, extra: Record<string, string> = {}) {
  const event = mockEvent(extra);
  await setSessionCookie(
    event.cookies as unknown as Cookies,
    { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
    deps.config.jwt
  );
  return event;
}

const post = (deps: AuthDeps, event: ReturnType<typeof mockEvent>) =>
  createLogoutHandler(deps).POST(event as unknown as RequestEvent);

describe('createLogoutHandler', () => {
  it('clears the session cookie', async () => {
    const deps = createMockDeps();
    const handler = createLogoutHandler(deps);
    const event = mockEvent({ session: 'some-token' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(200);
    expect((event as { _store: Map<string, string> })._store.get('session')).toBeUndefined();
  });

  it('revokes the refresh token and clears both cookies when rotation is enabled', async () => {
    const deps = createMockDeps(true);
    const { token } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const handler = createLogoutHandler(deps);
    const event = mockEvent({ session: 'access', refresh: token });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(200);

    const record = await deps.repos.refreshToken!.findByHash(hashToken(token));
    expect(record?.revokedAt).toBeInstanceOf(Date);
    expect((event as { _store: Map<string, string> })._store.get('session')).toBeUndefined();
    expect((event as { _store: Map<string, string> })._store.get('refresh')).toBeUndefined();
  });

  it('is a no-op on the refresh repo when the cookie is missing', async () => {
    const deps = createMockDeps(true);
    const handler = createLogoutHandler(deps);
    const event = mockEvent({});

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(200);
  });

  describe('invalidateAccessTokens', () => {
    it('bumps tokenVersion exactly once and reports it', async () => {
      const deps = createMockDeps(false, signedInUserRepo());
      const event = await signedInEvent(deps);

      const response = await createLogoutHandler(deps, {
        invalidateAccessTokens: true
      }).POST(event as unknown as RequestEvent);

      expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledTimes(1);
      expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledWith('user-1');
      await expect(response.json()).resolves.toEqual({ success: true, invalidated: true });
    });

    it('revokes every refresh family, not only the one in the cookie', async () => {
      // A family that survived the bump would re-read the row and mint a
      // session on the new tokenVersion — the other device would never notice.
      const deps = createMockDeps(true, signedInUserRepo());
      const repo = deps.repos.refreshToken!;
      const { token: thisDevice } = await issueRefreshToken(repo, 'user-1', {
        refreshTokenTtl: '30d'
      });
      const { token: otherDevice } = await issueRefreshToken(repo, 'user-1', {
        refreshTokenTtl: '30d'
      });
      const event = await signedInEvent(deps, { refresh: thisDevice });

      await createLogoutHandler(deps, { invalidateAccessTokens: true }).POST(
        event as unknown as RequestEvent
      );

      expect(await repo.listActiveByUser('user-1')).toEqual([]);
      expect((await repo.findByHash(hashToken(otherDevice)))?.revokedAt).toBeInstanceOf(Date);
    });

    it('does not bump by default', async () => {
      const deps = createMockDeps(false, signedInUserRepo());
      const event = await signedInEvent(deps);

      const response = await post(deps, event);

      expect(deps.repos.user.incrementTokenVersion).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({ success: true, invalidated: false });
    });

    it('ends the session without a bump when the access token no longer resolves', async () => {
      const deps = createMockDeps(false, signedInUserRepo());
      // Not a session cookie this config verifies — the expired/tampered case.
      const event = mockEvent({ session: 'not-a-jwt' });

      const response = await createLogoutHandler(deps, {
        invalidateAccessTokens: true
      }).POST(event as unknown as RequestEvent);

      expect(deps.repos.user.incrementTokenVersion).not.toHaveBeenCalled();
      expect(event._store.get('session')).toBeUndefined();
      await expect(response.json()).resolves.toEqual({ success: true, invalidated: false });
    });

    it('reports a failed bump and still revokes the refresh token and clears the cookies', async () => {
      const deps = createMockDeps(
        true,
        signedInUserRepo({
          incrementTokenVersion: vi.fn().mockRejectedValue(new Error('user store down'))
        })
      );
      const { token } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
        refreshTokenTtl: '30d'
      });
      const event = await signedInEvent(deps, { refresh: token });

      const response = await createLogoutHandler(deps, {
        invalidateAccessTokens: true
      }).POST(event as unknown as RequestEvent);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true, invalidated: false });
      expect(deps.logger.error).toHaveBeenCalledWith(
        '[auth] logout: account-wide token invalidation failed',
        expect.any(Error)
      );
      expect(
        (await deps.repos.refreshToken!.findByHash(hashToken(token)))?.revokedAt
      ).toBeInstanceOf(Date);
      expect(event._store.get('session')).toBeUndefined();
      expect(event._store.get('refresh')).toBeUndefined();
    });
  });
});
