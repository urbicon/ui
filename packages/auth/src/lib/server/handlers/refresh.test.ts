import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import {
  createInMemoryRefreshTokenRepository,
  createInMemoryStore
} from '../adapters/in-memory.js';
import type { FullAuthUser, RefreshTokenRepository } from '../adapters/types.js';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { issueRefreshToken } from '../refresh-token.js';
import {
  createMockInvitationRepository,
  createMockUser,
  createMockUserRepository
} from '../test-utils.js';
import { createRefreshHandler } from './refresh.js';

const makeUser = (): FullAuthUser => createMockUser({ role: 'user' });

function makeDeps(refreshEnabled = true, refreshRepo?: RefreshTokenRepository): AuthDeps {
  return {
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret' },
      ...(refreshEnabled ? { refreshToken: { refreshTokenTtl: '30d' } } : {})
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    repos: {
      user: createMockUserRepository({ findById: vi.fn().mockResolvedValue(makeUser()) }),
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
    request: new Request('http://localhost:3000/api/auth/refresh', { method: 'POST' }),
    url: new URL('http://localhost:3000/api/auth/refresh'),
    params: {},
    locals: {},
    platform: undefined,
    route: { id: '/api/auth/refresh' },
    isDataRequest: false,
    isSubRequest: false,
    getClientAddress: () => '127.0.0.1'
  };
}

describe('createRefreshHandler', () => {
  it('returns 400 when refresh-token rotation is not enabled', async () => {
    const handler = createRefreshHandler(makeDeps(false));
    const event = mockEvent();

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(400);
  });

  it('returns 401 when the refresh cookie is missing', async () => {
    const repo = createInMemoryRefreshTokenRepository(createInMemoryStore());
    const handler = createRefreshHandler(makeDeps(true, repo));

    const response = await handler.POST(mockEvent() as unknown as RequestEvent);
    expect(response.status).toBe(401);
  });

  it('returns 401 and clears both cookies when the token is unknown', async () => {
    const repo = createInMemoryRefreshTokenRepository(createInMemoryStore());
    const handler = createRefreshHandler(makeDeps(true, repo));
    const event = mockEvent({ session: 'stale', refresh: 'fake' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(401);
    expect((event as { _store: Map<string, string> })._store.get('session')).toBeUndefined();
    expect((event as { _store: Map<string, string> })._store.get('refresh')).toBeUndefined();
  });

  it('rotates the token and returns the user on success', async () => {
    const repo = createInMemoryRefreshTokenRepository(createInMemoryStore());
    const { token } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '30d' });
    const handler = createRefreshHandler(makeDeps(true, repo));
    const event = mockEvent({ refresh: token });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe('user-1');

    // Old token revoked, new token in the cookie, new session cookie set
    const oldRecord = await repo.findByHash(hashToken(token));
    expect(oldRecord?.revokedAt).toBeInstanceOf(Date);
    expect((event as { _store: Map<string, string> })._store.get('refresh')).toBeDefined();
    expect((event as { _store: Map<string, string> })._store.get('refresh')).not.toBe(token);
    expect((event as { _store: Map<string, string> })._store.get('session')).toBeDefined();
  });

  it('returns 401 and clears cookies on reuse of a revoked token outside the grace window', async () => {
    // Fake timers to age the revoke past the grace window (10s): repo reads
    // return detached copies, so backdating a returned record's revokedAt
    // would not reach the store — the clock itself has to move.
    vi.useFakeTimers();
    try {
      const repo = createInMemoryRefreshTokenRepository(createInMemoryStore());
      const { token } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '30d' });

      // First rotation
      const handler = createRefreshHandler(makeDeps(true, repo));
      const event1 = mockEvent({ refresh: token });
      await handler.POST(event1 as unknown as RequestEvent);

      vi.advanceTimersByTime(11_000);

      // Replay the old token
      const event2 = mockEvent({ refresh: token });
      const response = await handler.POST(event2 as unknown as RequestEvent);
      expect(response.status).toBe(401);
      expect((event2 as { _store: Map<string, string> })._store.get('refresh')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats an immediate replay as a concurrent-rotation race and re-issues only the access token', async () => {
    const repo = createInMemoryRefreshTokenRepository(createInMemoryStore());
    const { token } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '30d' });

    const handler = createRefreshHandler(makeDeps(true, repo));
    const event1 = mockEvent({ refresh: token });
    await handler.POST(event1 as unknown as RequestEvent);

    // Immediately replay the old token (within the grace window)
    const event2 = mockEvent({ refresh: token });
    const response = await handler.POST(event2 as unknown as RequestEvent);
    expect(response.status).toBe(200);
    // New session cookie is set but the stale refresh cookie is left alone —
    // the winner has already written the successor into the browser jar.
    expect((event2 as { _store: Map<string, string> })._store.get('session')).toBeDefined();
    expect((event2 as { _store: Map<string, string> })._store.get('refresh')).toBe(token);
  });

  // Cluster J: the explicit refresh endpoint reads the `refresh` rate-limit key.
  it('returns 429 once the refresh rate limit is exceeded', async () => {
    const deps = makeDeps(false);
    deps.config.rateLimit = { refresh: { windowMs: 60_000, max: 1 } };
    const handler = createRefreshHandler(deps);
    // The first call spends the per-IP budget (refresh disabled → 400, but the
    // limiter runs first and counts it); the second is refused with 429.
    await handler.POST(mockEvent() as unknown as RequestEvent);
    const limited = await handler.POST(mockEvent() as unknown as RequestEvent);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
