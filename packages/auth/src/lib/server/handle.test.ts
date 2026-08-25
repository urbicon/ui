import type { Handle, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { sanitizeRedirect } from '../redirect.js';
import type { AuthConfig, AuthUser } from '../types.js';
import { createInMemoryRefreshTokenRepository } from './adapters/in-memory.js';
import type { Repositories, UserRepository } from './adapters/types.js';
import { hashToken } from './auth.js';
import { createAuthHandle, DEFAULT_PUBLIC_ROUTES } from './handle.js';
import { createSessionToken } from './jwt.js';
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
  isRemoteRequest?: boolean;
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
    isRemoteRequest: options.isRemoteRequest ?? false,
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
    expect((await response.json()).code, 'unified error shape on the CSRF gate').toBe(
      'csrf_failed'
    );
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

  describe('publicRoutes', () => {
    /** Drive a handle with an unauthenticated request; report what the guard did. */
    const drive = async (handle: Handle, path: string, method?: string) => {
      const resolve = vi.fn().mockResolvedValue(new Response('OK'));
      const event = createMockEvent({
        path,
        method,
        origin: method && method !== 'GET' ? 'http://localhost:3000' : undefined
      });
      try {
        const response = await handle({ event: asEvent(event), resolve });
        return resolve.mock.calls.length > 0 ? 'passed-through' : `status-${response.status}`;
      } catch (e) {
        return `redirect-${(e as { status?: number }).status}`;
      }
    };

    const unauthenticated = async (options: {
      publicRoutes?: readonly string[];
      path: string;
      method?: string;
    }) =>
      drive(
        createAuthHandle({
          config,
          repos: createMockRepos(),
          ...(options.publicRoutes ? { publicRoutes: options.publicRoutes } : {})
        }),
        options.path,
        options.method
      );

    it('exempts every DEFAULT_PUBLIC_ROUTES entry when the option is omitted', async () => {
      for (const route of DEFAULT_PUBLIC_ROUTES) {
        expect(await unauthenticated({ path: route }), route).toBe('passed-through');
      }
      // Positive control: a route outside the list is still guarded, so the
      // loop above is not passing because the guard is off.
      expect(await unauthenticated({ path: '/dashboard' })).toBe('redirect-302');
    });

    it('replaces the defaults rather than extending them — an override locks out login', async () => {
      expect(await unauthenticated({ publicRoutes: ['/pricing'], path: '/pricing' })).toBe(
        'passed-through'
      );
      // The half that hurts: '/api/auth/' was in the list the override
      // dropped, so the app's own sign-in endpoint is now guarded.
      expect(
        await unauthenticated({
          publicRoutes: ['/pricing'],
          path: '/api/auth/login',
          method: 'POST'
        })
      ).toBe('status-401');
      // Positive control: the same request passes with the defaults in place.
      expect(await unauthenticated({ path: '/api/auth/login', method: 'POST' })).toBe(
        'passed-through'
      );
    });

    it('restores the auth endpoints when DEFAULT_PUBLIC_ROUTES is spread in', async () => {
      const publicRoutes = [...DEFAULT_PUBLIC_ROUTES, '/pricing'];
      expect(await unauthenticated({ publicRoutes, path: '/pricing' })).toBe('passed-through');
      expect(await unauthenticated({ publicRoutes, path: '/api/auth/login', method: 'POST' })).toBe(
        'passed-through'
      );
      expect(await unauthenticated({ publicRoutes, path: '/dashboard' })).toBe('redirect-302');
    });

    it("'/' is a prefix like any other, so it exempts the entire app", async () => {
      // Not a corner case: '/' is the obvious way to spell "my landing page is
      // public", and startsWith makes it match every route there is.
      expect(await unauthenticated({ publicRoutes: ['/'], path: '/dashboard' })).toBe(
        'passed-through'
      );
      expect(await unauthenticated({ publicRoutes: ['/'], path: '/api/admin/secrets' })).toBe(
        'passed-through'
      );
      // Positive control: the same two routes under a prefix that does not match.
      expect(await unauthenticated({ publicRoutes: ['/pricing'], path: '/dashboard' })).toBe(
        'redirect-302'
      );
      expect(
        await unauthenticated({ publicRoutes: ['/pricing'], path: '/api/admin/secrets' })
      ).toBe('status-401');
    });

    it('guards everything on an empty list, the login page included', async () => {
      expect(await unauthenticated({ publicRoutes: [], path: '/dashboard' })).toBe('redirect-302');
      // The login page redirecting to itself is what an empty list buys — the
      // list is the only thing exempting it.
      expect(await unauthenticated({ publicRoutes: [], path: '/auth/login' })).toBe('redirect-302');
      expect(
        await unauthenticated({ publicRoutes: [], path: '/api/auth/login', method: 'POST' })
      ).toBe('status-401');
    });

    it("reads the list once — a later push into the caller's array does not move the guard", async () => {
      const mine = ['/pricing'];
      const handle = createAuthHandle({ config, repos: createMockRepos(), publicRoutes: mine });
      expect(await drive(handle, '/dashboard')).toBe('redirect-302');
      mine.push('/dashboard');
      expect(await drive(handle, '/dashboard')).toBe('redirect-302');
      // Positive control: a handle built after the push does see the entry, so
      // the array really did change and the snapshot is what held.
      const later = createAuthHandle({ config, repos: createMockRepos(), publicRoutes: mine });
      expect(await drive(later, '/dashboard')).toBe('passed-through');
    });

    it('rejects mutation of DEFAULT_PUBLIC_ROUTES', () => {
      // Exported, and one array backs every handle that omits the option, so a
      // push into it would widen the guard for all of them at once.
      expect(() => (DEFAULT_PUBLIC_ROUTES as string[]).push('/pricing')).toThrow(TypeError);
      // The entry the replacement trap turns on. Every prose mention of it in
      // README/AUTH.md is only as true as this line.
      expect(DEFAULT_PUBLIC_ROUTES).toContain('/api/auth/');
    });
  });

  it('should redirect unauthenticated users to login, preserving the deep link', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({ path: '/dashboard?tab=usage' });
    const resolve = vi.fn();

    try {
      await handle({ event: asEvent(event), resolve });
      expect.fail('Should have redirected');
    } catch (e) {
      const err = e as { status?: number; location?: string };
      expect(err.status).toBe(302);
      // The requested path (incl. query) rides along so the login flow can
      // send the user back — via sanitizeRedirect, which round-trips this.
      expect(err.location).toBe(
        `/auth/login?redirectTo=${encodeURIComponent('/dashboard?tab=usage')}`
      );
      const query = new URL(`http://localhost:3000${err.location}`).searchParams;
      expect(sanitizeRedirect(query.get('redirectTo'), '/')).toBe('/dashboard?tab=usage');
    }
  });

  it('joins redirectTo with & when the configured loginPage already has a query', async () => {
    // Mutation finding (test-coverage review): always joining with '?' kept
    // the suite green while producing '/login?lang=de?redirectTo=…' — a
    // broken query string from which the deep link silently never parses.
    const repos = createMockRepos();
    const handle = createAuthHandle({
      config: { ...config, routes: { loginPage: '/auth/login?lang=de' } },
      repos
    });
    const event = createMockEvent({ path: '/dashboard' });

    try {
      await handle({ event: asEvent(event), resolve: vi.fn() });
      expect.fail('Should have redirected');
    } catch (e) {
      const err = e as { status?: number; location?: string };
      expect(err.status).toBe(302);
      expect(err.location).toBe(
        `/auth/login?lang=de&redirectTo=${encodeURIComponent('/dashboard')}`
      );
      // The param must round-trip through the parser a consumer would use.
      const query = new URL(`http://localhost:3000${err.location}`).searchParams;
      expect(query.get('redirectTo')).toBe('/dashboard');
    }
  });

  it('omits redirectTo for non-GET requests (a POST target must not become a GET)', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({
      path: '/dashboard',
      method: 'POST',
      origin: 'http://localhost:3000'
    });
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
    expect((await response.json()).code, 'guard 401 carries the machine code').toBe(
      'not_authenticated'
    );
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

  it('rejects a session whose tokenVersion is stale and clears the cookie ("log out everywhere")', async () => {
    // Test-review mutation finding: weakening the tokenVersion gate to a bare
    // `if (user)` kept the whole suite green — the one mechanism that makes
    // incrementTokenVersion revoke live sessions was unpinned.
    const repos = createMockRepos({
      findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 }))
    });
    const handle = createAuthHandle({ config, repos });

    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      config.jwt
    );
    const event = createMockEvent({ path: '/api/data', sessionCookie: token });

    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status).toBe(401);
    expect(event.locals.user).toBeNull();
    expect(
      (event as { _cookieStore: Map<string, string> })._cookieStore.get('session'),
      'stale session cookie is cleared'
    ).toBeUndefined();
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

describe('createAuthHandle — remote-function guard', () => {
  // Regression for the x-sveltekit-pathname spoof (issue #43): for a remote
  // request event.url.pathname is client-controlled (SvelteKit rewrites it from
  // the header before this hook), so a public route in the path must NOT make
  // the request public. The guard keys on the unspoofable event.isRemoteRequest.
  it('rejects an unauthenticated remote request even when the (spoofable) path is public', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({ path: '/auth/login', isRemoteRequest: true });
    const resolve = vi.fn().mockResolvedValue(new Response('leaked'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
    expect((await response.json()).code, 'remote guard shares the unified shape').toBe(
      'not_authenticated'
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns 401 (not a 302 redirect) for an unauthenticated remote request', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    // A non-public path would 302-redirect a normal browser request; a remote
    // request must get a machine-readable 401 instead of a redirect to HTML.
    const event = createMockEvent({ path: '/dashboard', isRemoteRequest: true });
    const resolve = vi.fn();

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lets an authenticated remote request through', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      config.jwt
    );
    const event = createMockEvent({
      path: '/auth/login',
      sessionCookie: token,
      isRemoteRequest: true
    });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
  });

  it('allows unauthenticated remote requests when allowUnauthenticatedRemote is set', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos, allowUnauthenticatedRemote: true });
    const event = createMockEvent({ path: '/dashboard', isRemoteRequest: true });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
  });

  // Regression for the second transport (issue #43 follow-up): the no-JS
  // <form action="?/remote=…"> fallback dispatches the remote function from the
  // /remote search param through the page pipeline, with event.isRemoteRequest
  // left false and the *real* (unspoofed) pathname. A public path must not wave
  // it past the guard. POST → needs a same-origin header to clear CSRF (step 1).
  it('rejects an unauthenticated form() no-JS fallback POST (?/remote=) on a public path', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({
      path: '/auth/login?/remote=deleteAccount',
      method: 'POST',
      origin: 'http://localhost:3000',
      isRemoteRequest: false
    });
    const resolve = vi.fn().mockResolvedValue(new Response('leaked'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lets an authenticated form() no-JS fallback POST through', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const token = await createSessionToken(
      { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 },
      config.jwt
    );
    const event = createMockEvent({
      path: '/dashboard?/remote=updateProfile',
      method: 'POST',
      origin: 'http://localhost:3000',
      sessionCookie: token,
      isRemoteRequest: false
    });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
  });

  // Precision of the /remote detection: a normal page action named "remote"
  // serializes to ?/remote with an EMPTY value, which SvelteKit runs as a plain
  // action (get_remote_action is falsy). It must stay on the path guard, so an
  // unauthenticated POST to a public path is not spuriously default-denied.
  it('does not treat a normal action named "remote" (empty ?/remote) as a remote call', async () => {
    const repos = createMockRepos();
    const handle = createAuthHandle({ config, repos });
    const event = createMockEvent({
      path: '/auth/login?/remote',
      method: 'POST',
      origin: 'http://localhost:3000',
      isRemoteRequest: false
    });
    const resolve = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
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
    // Fake timers: the replay step below must land OUTSIDE the 10s grace
    // window, and repo reads return detached copies (backdating a returned
    // record's revokedAt would not reach the store).
    vi.useFakeTimers();
    try {
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
      vi.advanceTimersByTime(11_000);

      const event2 = createMockEvent({ path: '/api/data', refreshCookie: token });
      const response2 = await handle({ event: asEvent(event2), resolve });
      expect(response2.status).toBe(401);

      // And the freshly-issued successor is now also revoked
      const hash = hashToken(stillSameCookie!);
      const record = await repos.refreshToken!.findByHash(hash);
      expect(record?.revokedAt).toBeInstanceOf(Date);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mints a session cookie that verifies on the next request (payload round-trip)', async () => {
    // Test-review mutation finding: dropping a claim from sessionPayload kept
    // the whole suite green — every rotation "succeeded" while minting dead
    // cookies (verify fails closed on a missing claim), so login would
    // silently produce permanently unauthenticated sessions.
    const repos = reposWithRefresh();
    const { token } = await issueRefreshToken(repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const handle = createAuthHandle({ config: rotationConfig, repos });

    const first = createMockEvent({ path: '/dashboard', refreshCookie: token });
    await handle({ event: asEvent(first), resolve: vi.fn(async () => new Response('OK')) });
    const mintedSession = (first as { _cookieStore: Map<string, string> })._cookieStore.get(
      'session'
    );
    expect(mintedSession).toBeDefined();

    // Feed the freshly minted access cookie into a second request WITHOUT a
    // refresh cookie: it must authenticate on its own.
    const second = createMockEvent({ path: '/dashboard', sessionCookie: mintedSession });
    await handle({ event: asEvent(second), resolve: vi.fn(async () => new Response('OK')) });
    expect(second.locals.user).toBeDefined();
    expect((second.locals.user as { id?: string }).id).toBe('user-1');
  });

  it('clears both cookies when the refresh cookie is invalid', async () => {
    const repos = reposWithRefresh();
    const handle = createAuthHandle({ config: rotationConfig, repos });

    // Seed a stale access cookie alongside the bad refresh cookie so the
    // "both" in this test's name is actually asserted (test-review gap 3).
    const event = createMockEvent({
      path: '/api/data',
      sessionCookie: 'stale-session',
      refreshCookie: 'not-a-token'
    });
    const resolve = vi.fn();

    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
    expect(event.locals.user).toBeNull();
    const store = (event as { _cookieStore: Map<string, string> })._cookieStore;
    expect(store.get('session'), 'access cookie cleared').toBeUndefined();
    expect(store.get('refresh'), 'refresh cookie cleared').toBeUndefined();
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

  it('survives a throwing transform on the refresh-rotation path without burning the family', async () => {
    // Fake timers: the second rotation below must land outside the 10s grace.
    vi.useFakeTimers();
    try {
      const refreshRepo = createInMemoryRefreshTokenRepository();
      const revokeFamily = vi.spyOn(refreshRepo, 'revokeFamily');
      const repos = { ...createMockRepos(), refreshToken: refreshRepo };
      const { token } = await issueRefreshToken(refreshRepo, 'user-1', { refreshTokenTtl: '30d' });
      const logger = { warn: vi.fn(), error: vi.fn() };
      const handle = createAuthHandle({
        config: {
          ...config,
          logger,
          refreshToken: { accessTokenTtl: '15m', refreshTokenTtl: '30d' },
          hooks: {
            transformUser: () => {
              throw new Error('enrichment boom');
            }
          }
        },
        repos
      });

      // By the time the transform runs, the successor row is written and the
      // predecessor CAS-revoked, with both cookies staged on the event.
      // SvelteKit flushes staged cookies on the success and redirect paths
      // only — so the guard's 302 still delivers them, while a throw out of
      // the hook would not, leaving the browser to replay the spent token.
      const event = createMockEvent({ path: '/dashboard', refreshCookie: token });
      await expect(handle({ event: asEvent(event), resolve: ok() })).rejects.toMatchObject({
        status: 302
      });

      expect(event.locals.user).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('transformUser'),
        expect.any(Error)
      );

      const successor = event._cookieStore.get('refresh');
      expect(successor).toBeDefined();
      expect(successor).not.toBe(token);

      // The line is alive: the successor still rotates outside the grace
      // window, and nothing was ever reported as stolen.
      vi.advanceTimersByTime(11_000);
      const next = createMockEvent({ path: '/dashboard', refreshCookie: successor });
      await expect(handle({ event: asEvent(next), resolve: ok() })).rejects.toMatchObject({
        status: 302
      });
      expect(next._cookieStore.get('refresh')).not.toBe(successor);
      expect(revokeFamily).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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

describe('createAuthHandle refresh-token wiring', () => {
  // config.refreshToken without repos.refreshToken would silently skip the
  // hook's transparent-rotation branch (2a) — assertReposMatchConfig makes it
  // fail loud at wiring time instead.
  it('throws when refreshToken is configured but repos.refreshToken is missing', () => {
    expect(() =>
      createAuthHandle({ config: { ...config, refreshToken: {} }, repos: createMockRepos() })
    ).toThrow(/repos\.refreshToken is missing/);
  });

  it('does not throw when the refreshToken repo is present', () => {
    expect(() =>
      createAuthHandle({
        config: { ...config, refreshToken: {} },
        repos: { ...createMockRepos(), refreshToken: createInMemoryRefreshTokenRepository() }
      })
    ).not.toThrow();
  });

  it('does not throw when refreshToken is not configured at all', () => {
    expect(() => createAuthHandle({ config, repos: createMockRepos() })).not.toThrow();
  });
});

describe('createAuthHandle JWT config validation (ES256 wiring)', () => {
  // The hook is wired independently of createAuthDeps, so it must run the
  // same fail-loud JWT config check — an ES256 config without its signing key
  // would otherwise only surface as per-request verification failures.
  it('throws at wiring time when algorithm ES256 lacks a signingKey', () => {
    expect(() =>
      createAuthHandle({
        config: { ...config, jwt: { secret: 'test-secret', algorithm: 'ES256' } },
        repos: createMockRepos()
      })
    ).toThrow(/signingKey is missing/);
  });
});
