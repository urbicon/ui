import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig, AuthUser } from '../types.js';
import { createInMemoryRefreshTokenRepository } from './adapters/in-memory-refresh-token.js';
import type { Repositories, UserRepository } from './adapters/types.js';
import { createSessionToken, hashToken } from './auth.js';
import { createAuthHandle } from './handle.js';
import { issueRefreshToken } from './refresh-token.js';
import {
  createMockInvitationRepository,
  createMockUser,
  createMockUserRepository
} from './test-utils.js';

type MockEvent = ReturnType<typeof createMockEvent>;
// Bridge the mock to a RequestEvent-compatible shape without resorting to
// `as any`; SvelteKit's RequestEvent is generic and bringing the full surface
// into every test would be noise.
const asEvent = (e: MockEvent) => e as unknown as RequestEvent;

const config: AuthConfig = {
  appUrl: 'https://app.test',
  jwt: { secret: 'test-secret', expiresIn: '1h' }
};

function createMockRepos(overrides: Partial<UserRepository> = {}): Repositories {
  return {
    user: createMockUserRepository({
      findById: vi.fn().mockResolvedValue(createMockUser()),
      ...overrides
    }),
    invitation: createMockInvitationRepository()
  };
}

function createMockEvent(options: {
  path: string;
  method?: string;
  origin?: string;
  sessionCookie?: string;
  refreshCookie?: string;
  refreshCookieName?: string;
}) {
  const headers = new Headers();
  if (options.origin) headers.set('origin', options.origin);

  const cookieStore = new Map<string, string>();
  if (options.sessionCookie) cookieStore.set('session', options.sessionCookie);
  if (options.refreshCookie) {
    cookieStore.set(options.refreshCookieName ?? 'refresh', options.refreshCookie);
  }

  return {
    request: new Request(`http://localhost:3000${options.path}`, {
      method: options.method ?? 'GET',
      headers
    }),
    url: new URL(`http://localhost:3000${options.path}`),
    cookies: {
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string) => cookieStore.set(name, value),
      delete: (name: string) => cookieStore.delete(name),
      getAll: () => [],
      serialize: () => ''
    },
    _cookieStore: cookieStore,
    locals: {} as Record<string, unknown>,
    params: {},
    route: { id: options.path },
    isDataRequest: false,
    isSubRequest: false,
    getClientAddress: () => '127.0.0.1',
    platform: undefined
  };
}

describe('createAuthHandle', () => {
  it('should reject POST without origin header (CSRF)', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({ path: '/api/data', method: 'POST' });
    const resolve = vi.fn();

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('should allow GET requests to public routes without session', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({ path: '/auth/login' });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    await handle({ event: asEvent(event), resolve });
    expect(resolve).toHaveBeenCalled();
  });

  it('should redirect unauthenticated users to login', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({ path: '/dashboard' });
    const resolve = vi.fn();

    try {
      await handle({ event: asEvent(event), resolve });
      expect.fail('Should have redirected');
    } catch (e) {
      const err = e as { status?: number; location?: string };
      expect(err.status).toBe(302);
      expect(err.location).toBe('/auth/login');
    }
  });

  it('should return 401 for unauthenticated API requests', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({ path: '/api/data' });
    const resolve = vi.fn();

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
  });

  it('should set user on event.locals for authenticated requests', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });

    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      config.jwt
    );

    const event = createMockEvent({ path: '/dashboard', sessionCookie: token });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    await handle({ event: asEvent(event), resolve });
    expect(event.locals.user).toBeDefined();
    expect((event.locals.user as { id?: string }).id).toBe('user-1');
    expect(event.locals.user as { id?: string }).not.toHaveProperty('passwordHash');
  });

  it('should apply security headers', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });

    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      config.jwt
    );

    const event = createMockEvent({ path: '/dashboard', sessionCookie: token });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    // Secure config (no cookieSecure override) → HSTS + CSP baseline emitted.
    expect(response.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains'
    );
    expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  });

  it('omits HSTS in a non-secure (dev) config but still sends CSP', async () => {
    const devConfig: AuthConfig = {
      appUrl: 'http://localhost:3000',
      jwt: { secret: 'test-secret', expiresIn: '1h', cookieSecure: false }
    };
    const repos = createMockRepos();
    const handle = createAuthHandle({ config: devConfig, repos });

    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      devConfig.jwt
    );
    const event = createMockEvent({ path: '/dashboard', sessionCookie: token });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  });

  it('threads securityHeaders config through to the response', async () => {
    const customConfig: AuthConfig = {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '1h' },
      securityHeaders: { hsts: false, csp: "default-src 'self'" }
    };
    const repos = createMockRepos();
    const handle = createAuthHandle({ config: customConfig, repos });

    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      customConfig.jwt
    );
    const event = createMockEvent({ path: '/dashboard', sessionCookie: token });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
  });

  it('warns when csrf.useHostPrefix is combined with csrf.cookieSecure:false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createAuthHandle({
      config: {
        appUrl: 'https://app.test',
        jwt: { secret: 's' },
        csrf: { doubleSubmit: true, useHostPrefix: true, cookieSecure: false }
      },
      repos: createMockRepos()
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('useHostPrefix forces a Secure'));
    warn.mockRestore();
  });

  it('warns when csrf.useHostPrefix is combined with jwt.cookieSecure:false (the dev-flag case)', () => {
    // Regression: the warning must also fire for the package-wide non-HTTPS
    // signal, not only the csrf-specific opt-out. This is the config that
    // previously slipped through and 403-ed every request without a hint.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createAuthHandle({
      config: {
        appUrl: 'http://localhost:3000',
        jwt: { secret: 's', cookieSecure: false },
        csrf: { doubleSubmit: true, useHostPrefix: true }
      },
      repos: createMockRepos()
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('useHostPrefix forces a Secure'));
    warn.mockRestore();
  });

  it('does not warn when useHostPrefix is paired with a secure cookie', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createAuthHandle({
      config: {
        appUrl: 'https://app.test',
        jwt: { secret: 's' },
        csrf: { doubleSubmit: true, useHostPrefix: true }
      },
      repos: createMockRepos()
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('createAuthHandle — refresh-token rotation', () => {
  const rotationConfig: AuthConfig = {
    appUrl: 'https://app.test',
    jwt: { secret: 'test-secret', expiresIn: '1h' },
    refreshToken: { accessTokenTtl: '15m', refreshTokenTtl: '30d' }
  };

  function reposWithRefresh(): Repositories {
    const refreshRepo = createInMemoryRefreshTokenRepository();
    return { ...createMockRepos(), refreshToken: refreshRepo };
  }

  it('rotates transparently when the access token is missing but the refresh cookie is valid', async () => {
    const repos = reposWithRefresh();
    const { token } = await issueRefreshToken(repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const handle = createAuthHandle({ config: rotationConfig, repos });

    const event = createMockEvent({ path: '/dashboard', refreshCookie: token });
    const resolve = vi.fn(async () => new Response('OK'));

    await handle({ event: asEvent(event), resolve });

    expect(event.locals.user).toBeDefined();
    expect((event.locals.user as { id?: string }).id).toBe('user-1');
    // A fresh access cookie is written
    expect(
      (event as { _cookieStore: Map<string, string> })._cookieStore.get('session')
    ).toBeDefined();
    // The old refresh token is revoked, the new one is in the cookie
    const stillSameCookie = (event as { _cookieStore: Map<string, string> })._cookieStore.get(
      'refresh'
    );
    expect(stillSameCookie).toBeDefined();
    expect(stillSameCookie).not.toBe(token);

    // Reusing the old (now-revoked) refresh token OUTSIDE the grace window
    // triggers family revoke. Inside the grace window it's treated as a
    // concurrent-rotation race (see the `race_ok` test below).
    const predecessor = await repos.refreshToken!.findByHash(hashToken(token));
    if (predecessor?.revokedAt) predecessor.revokedAt = new Date(Date.now() - 60_000);

    const event2 = createMockEvent({ path: '/api/data', refreshCookie: token });
    const response2 = await handle({ event: asEvent(event2), resolve });
    expect(response2.status).toBe(401);

    // And the freshly-issued successor is now also revoked
    const hash = hashToken(stillSameCookie!);
    const record = await repos.refreshToken!.findByHash(hash);
    expect(record?.revokedAt).toBeInstanceOf(Date);
  });

  it('clears both cookies when the refresh cookie is invalid', async () => {
    const repos = reposWithRefresh();
    const handle = createAuthHandle({ config: rotationConfig, repos });

    const event = createMockEvent({ path: '/api/data', refreshCookie: 'not-a-token' });
    const resolve = vi.fn();

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
    expect(event.locals.user).toBeNull();
  });

  it('falls back to the normal "no session" path when neither cookie is present', async () => {
    const repos = reposWithRefresh();
    const handle = createAuthHandle({ config: rotationConfig, repos });

    const event = createMockEvent({ path: '/api/data' });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status).toBe(401);
    expect(event.locals.user).toBeNull();
  });
});

describe('createAuthHandle — transformUser', () => {
  const ok = () => vi.fn().mockResolvedValue(new Response('OK'));

  async function authedEvent(path = '/dashboard') {
    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      config.jwt
    );
    return createMockEvent({ path, sessionCookie: token });
  }

  it('replaces locals.user with the transform result', async () => {
    const handle = createAuthHandle({
      config: { ...config, hooks: { transformUser: (user) => ({ ...user, tenant: 'acme' }) } },
      repos: createMockRepos()
    });
    const event = await authedEvent();

    await handle({ event: asEvent(event), resolve: ok() });
    expect(event.locals.user).toMatchObject({ id: 'user-1', tenant: 'acme' });
  });

  it('passes the sanitized user (no passwordHash) and the event to the transform', async () => {
    const repos = createMockRepos({
      findById: vi.fn().mockResolvedValue(createMockUser({ passwordHash: 'secret-hash' }))
    });
    const transformUser = vi.fn((user: AuthUser, _event: RequestEvent) => user);
    const handle = createAuthHandle({ config: { ...config, hooks: { transformUser } }, repos });
    const event = await authedEvent();

    await handle({ event: asEvent(event), resolve: ok() });

    expect(transformUser).toHaveBeenCalledTimes(1);
    const [userArg, eventArg] = transformUser.mock.calls[0];
    expect(userArg).not.toHaveProperty('passwordHash');
    expect(userArg).toMatchObject({ id: 'user-1', email: 'test@test.com' });
    expect(eventArg).toBe(event);
  });

  it('awaits an async transform', async () => {
    const handle = createAuthHandle({
      config: {
        ...config,
        hooks: { transformUser: async (user) => ({ ...user, plan: await Promise.resolve('pro') }) }
      },
      repos: createMockRepos()
    });
    const event = await authedEvent();

    await handle({ event: asEvent(event), resolve: ok() });
    expect((event.locals.user as { plan?: string }).plan).toBe('pro');
  });

  it('leaves locals.user as the plain AuthUser when no transform is configured', async () => {
    const handle = createAuthHandle({ config, repos: createMockRepos() });
    const event = await authedEvent();

    await handle({ event: asEvent(event), resolve: ok() });
    expect(event.locals.user).toMatchObject({ id: 'user-1', role: 'admin' });
    expect(event.locals.user as object).not.toHaveProperty('passwordHash');
  });

  it('fails the request when the transform throws', async () => {
    const handle = createAuthHandle({
      config: {
        ...config,
        hooks: {
          transformUser: () => {
            throw new Error('enrichment boom');
          }
        }
      },
      repos: createMockRepos()
    });
    const event = await authedEvent();

    await expect(handle({ event: asEvent(event), resolve: ok() })).rejects.toThrow(
      'enrichment boom'
    );
  });

  it('applies the transform on the refresh-rotation path', async () => {
    const refreshRepo = createInMemoryRefreshTokenRepository();
    const repos = { ...createMockRepos(), refreshToken: refreshRepo };
    const { token } = await issueRefreshToken(refreshRepo, 'user-1', { refreshTokenTtl: '30d' });
    const handle = createAuthHandle({
      config: {
        ...config,
        refreshToken: { accessTokenTtl: '15m', refreshTokenTtl: '30d' },
        hooks: { transformUser: (user) => ({ ...user, tenant: 'acme' }) }
      },
      repos
    });
    const event = createMockEvent({ path: '/dashboard', refreshCookie: token });

    await handle({ event: asEvent(event), resolve: ok() });
    expect(event.locals.user).toMatchObject({ id: 'user-1', tenant: 'acme' });
  });
});
