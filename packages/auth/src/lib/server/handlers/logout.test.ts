import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryRefreshTokenRepository } from '../adapters/in-memory.js';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { issueRefreshToken } from '../refresh-token.js';
import { createMockInvitationRepository, createMockUserRepository } from '../test-utils.js';
import { createLogoutHandler } from './logout.js';

function createMockDeps(refreshEnabled = false): AuthDeps {
  const refreshRepo = refreshEnabled ? createInMemoryRefreshTokenRepository() : undefined;
  return {
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '15m' },
      ...(refreshEnabled ? { refreshToken: { refreshTokenTtl: '30d' } } : {})
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    repos: {
      user: createMockUserRepository(),
      invitation: createMockInvitationRepository(),
      refreshToken: refreshRepo
    },
    email: { send: vi.fn() }
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
});
