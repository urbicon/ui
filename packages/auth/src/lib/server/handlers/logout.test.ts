import type { Handle, RequestEvent, RequestHandler } from '@sveltejs/kit';
import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../../types.js';
import {
  createInMemoryRefreshTokenRepository,
  createInMemoryStore
} from '../adapters/in-memory.js';
import type { FullAuthUser, RefreshTokenRepository } from '../adapters/types.js';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { createAuthHandle } from '../handle.js';
import { createSessionToken } from '../jwt.js';
import { issueRefreshToken } from '../refresh-token.js';
import {
  createMockInvitationRepository,
  createMockUser,
  createMockUserRepository
} from '../test-utils.js';
import { createLogoutHandler } from './logout.js';

const JWT: AuthConfig['jwt'] = { secret: 'test-secret', expiresIn: '15m' };

/** Refresh-repo writes record themselves, so their order against the bump is observable. */
function tracedRefreshRepo(repo: RefreshTokenRepository, trace: string[]): RefreshTokenRepository {
  return {
    ...repo,
    revoke: (id, replacedById) => {
      trace.push('revoke');
      return repo.revoke(id, replacedById);
    },
    revokeAllForUser: (userId) => {
      trace.push('revokeAllForUser');
      return repo.revokeAllForUser(userId);
    },
    revokeFamily: (family) => {
      trace.push('revokeFamily');
      return repo.revokeFamily(family);
    }
  };
}

function createMockDeps(
  refreshEnabled = false,
  extras: { user?: FullAuthUser | null; trace?: string[] } = {}
): AuthDeps {
  const { user = null, trace } = extras;
  const store = refreshEnabled
    ? createInMemoryRefreshTokenRepository(createInMemoryStore())
    : undefined;
  const refreshRepo = store && trace ? tracedRefreshRepo(store, trace) : store;
  return {
    config: {
      appUrl: 'https://app.test',
      jwt: JWT,
      ...(refreshEnabled ? { refreshToken: { refreshTokenTtl: '30d' } } : {})
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    repos: {
      user: createMockUserRepository({
        findById: vi.fn(async () => user),
        incrementTokenVersion: vi.fn(async () => {
          trace?.push('bump');
        })
      }),
      invitation: createMockInvitationRepository(),
      refreshToken: refreshRepo
    },
    email: { send: vi.fn() }
  };
}

function mockEvent(
  initialCookies: Record<string, string> = {},
  extras: {
    path?: string;
    method?: string;
    trace?: string[];
    locals?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const { path = '/api/auth/logout', method = 'POST', trace, locals = {}, headers } = extras;
  const store = new Map(Object.entries(initialCookies));
  return {
    cookies: {
      get: (name: string) => store.get(name),
      set: (name: string, value: string) => store.set(name, value),
      delete: (name: string) => {
        trace?.push(`clear:${name}`);
        store.delete(name);
      },
      getAll: () => [],
      serialize: () => ''
    },
    _store: store,
    request: new Request(`http://localhost:3000${path}`, { method, headers }),
    url: new URL(`http://localhost:3000${path}`),
    params: {},
    locals,
    platform: undefined,
    route: { id: path },
    isDataRequest: false,
    isSubRequest: false,
    isRemoteRequest: false,
    getClientAddress: () => '127.0.0.1'
  };
}

const asEvent = (event: ReturnType<typeof mockEvent>) => event as unknown as RequestEvent;
const cookieJar = (event: ReturnType<typeof mockEvent>) => event._store;

/** A session cookie the JWT path really verifies, for `user-1` at generation 0. */
const sessionCookie = (tokenVersion = 0) =>
  createSessionToken(
    { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion },
    JWT
  );

describe('createLogoutHandler', () => {
  it('clears the session cookie', async () => {
    const deps = createMockDeps();
    const handler = createLogoutHandler(deps);
    const event = mockEvent({ session: 'some-token' });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(cookieJar(event).get('session')).toBeUndefined();
  });

  it('revokes the refresh token and clears both cookies when rotation is enabled', async () => {
    const deps = createMockDeps(true);
    const { token } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const handler = createLogoutHandler(deps);
    const event = mockEvent({ session: 'access', refresh: token });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);

    const record = await deps.repos.refreshToken!.findByHash(hashToken(token));
    expect(record?.revokedAt).toBeInstanceOf(Date);
    expect(cookieJar(event).get('session')).toBeUndefined();
    expect(cookieJar(event).get('refresh')).toBeUndefined();
  });

  it('is a no-op on the refresh repo when the cookie is missing', async () => {
    const deps = createMockDeps(true);
    const handler = createLogoutHandler(deps);
    const event = mockEvent({});

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
  });
});

describe('createLogoutHandler — invalidateAccessTokens', () => {
  it('leaves tokenVersion alone by default', async () => {
    const deps = createMockDeps(false, { user: createMockUser() });
    const handler = createLogoutHandler(deps);
    const event = mockEvent({ session: await sessionCookie() });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(deps.repos.user.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it('bumps and revokes every family before the cookies are cleared', async () => {
    const trace: string[] = [];
    const deps = createMockDeps(true, { user: createMockUser(), trace });
    const { token } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const handler = createLogoutHandler(deps, { invalidateAccessTokens: true });
    const event = mockEvent({ session: await sessionCookie(), refresh: token }, { trace });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledTimes(1);
    expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledWith('user-1');
    // Both writes read the session cookie's user, so they must land while the
    // cookie is still in the jar. The cookie's own token is already revoked by
    // then, which sends the per-cookie revoke down its family branch.
    expect(trace).toEqual([
      'bump',
      'revokeAllForUser',
      'revokeFamily',
      'clear:session',
      'clear:refresh'
    ]);
    expect(deps.logger.error, 'the spent cookie token logs nothing').not.toHaveBeenCalled();
  });

  it('takes the user id from the session cookie, not from locals', async () => {
    const deps = createMockDeps(false, { user: createMockUser() });
    const handler = createLogoutHandler(deps, { invalidateAccessTokens: true });
    const event = mockEvent(
      { session: await sessionCookie() },
      { locals: { user: { id: 'other-user' } } }
    );

    await handler.POST(asEvent(event));
    expect(deps.repos.user.incrementTokenVersion).toHaveBeenCalledWith('user-1');
  });

  it('skips the bump when no session resolves, and still answers 200', async () => {
    const deps = createMockDeps(false, { user: createMockUser() });
    const handler = createLogoutHandler(deps, { invalidateAccessTokens: true });
    const event = mockEvent({});

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(deps.repos.user.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it('refuses a session cookie the row has already outrun, without bumping again', async () => {
    const deps = createMockDeps(false, { user: createMockUser({ tokenVersion: 2 }) });
    const handler = createLogoutHandler(deps, { invalidateAccessTokens: true });
    const event = mockEvent({ session: await sessionCookie(0) });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(deps.repos.user.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it('logs a failed bump and still revokes the refresh token and clears the cookies', async () => {
    const deps = createMockDeps(true, { user: createMockUser() });
    deps.repos.user.incrementTokenVersion = vi.fn(async () => {
      throw new Error('db down');
    });
    const { token } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const handler = createLogoutHandler(deps, { invalidateAccessTokens: true });
    const event = mockEvent({ session: await sessionCookie(), refresh: token });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(deps.logger.error).toHaveBeenCalledWith(
      '[auth] logout: token-version bump failed',
      expect.any(Error)
    );
    const record = await deps.repos.refreshToken!.findByHash(hashToken(token));
    expect(record?.revokedAt, 'the revoke is not skipped by a failed bump').toBeInstanceOf(Date);
    expect(
      await deps.repos.refreshToken!.listActiveByUser('user-1'),
      'nor is the family revoke'
    ).toEqual([]);
    expect(cookieJar(event).get('session')).toBeUndefined();
    expect(cookieJar(event).get('refresh')).toBeUndefined();
  });

  it('reports a failed family revoke under its own message, bump intact', async () => {
    const deps = createMockDeps(true, { user: createMockUser() });
    const repo = deps.repos.refreshToken!;
    repo.revokeAllForUser = vi.fn(async () => {
      throw new Error('db down');
    });
    const { token } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '30d' });
    const handler = createLogoutHandler(deps, { invalidateAccessTokens: true });
    const event = mockEvent({ session: await sessionCookie(), refresh: token });

    const response = await handler.POST(asEvent(event));
    expect(response.status).toBe(200);
    expect(deps.repos.user.incrementTokenVersion, 'the bump landed').toHaveBeenCalledWith('user-1');
    expect(deps.logger.error).toHaveBeenCalledWith(
      '[auth] logout: refresh-family revoke failed',
      expect.any(Error)
    );
    expect(deps.logger.error, 'an operator can tell which half failed').not.toHaveBeenCalledWith(
      '[auth] logout: token-version bump failed',
      expect.any(Error)
    );
    // The per-cookie revoke is the fallback — this browser is out either way.
    const record = await repo.findByHash(hashToken(token));
    expect(record?.revokedAt).toBeInstanceOf(Date);
    expect(cookieJar(event).get('session')).toBeUndefined();
  });
});

describe('createLogoutHandler — invalidateAccessTokens through the handle', () => {
  const config: AuthConfig = {
    appUrl: 'https://app.test',
    jwt: JWT,
    refreshToken: { accessTokenTtl: '15m', refreshTokenTtl: '30d' }
  };

  /** Deps whose user row carries the bump for real, so the handle can read it. */
  function createLiveDeps(): AuthDeps {
    let tokenVersion = 0;
    return {
      config,
      logger: { warn: vi.fn(), error: vi.fn() },
      repos: {
        user: createMockUserRepository({
          findById: vi.fn(async () => createMockUser({ tokenVersion })),
          incrementTokenVersion: vi.fn(async () => {
            tokenVersion += 1;
          })
        }),
        invitation: createMockInvitationRepository(),
        refreshToken: createInMemoryRefreshTokenRepository(createInMemoryStore())
      },
      email: { send: vi.fn() }
    };
  }

  /**
   * A browser's cookie jar in front of the handle. SvelteKit writes the cookies
   * a hook staged on `event.cookies` in exactly two places — inside
   * `resolve(...).then(...)` and on the thrown-redirect path (`respond.js`) — so
   * a hook that returns a Response without calling `resolve`, which is what the
   * route guard does for `/api/…`, writes none of them. `handle.ts:222-224`
   * builds the rotation branch's throw policy on that same rule. A jar that
   * takes every staged cookie would report cookie state no browser ever holds.
   */
  function createJar(initial: Record<string, string>) {
    const jar = new Map(Object.entries(initial));
    return {
      get: (name: string) => jar.get(name),
      /**
       * One request through `handle`, with Kit's flush rule applied to the jar.
       * `endpoint` is what `resolve` runs — the route the hook hands the
       * request to, on the same `event.cookies` the hook staged into.
       */
      async send(handle: Handle, path: string, method = 'GET', endpoint?: RequestHandler) {
        const event = mockEvent(Object.fromEntries(jar), {
          path,
          method,
          // The hook's Origin gate refuses a mutating request without one.
          headers: method === 'GET' ? {} : { origin: 'http://localhost:3000' }
        });
        const commit = () => {
          jar.clear();
          for (const [name, value] of cookieJar(event)) jar.set(name, value);
        };
        let resolved = false;
        try {
          const response = await handle({
            event: asEvent(event),
            resolve: async () => {
              resolved = true;
              return endpoint ? await endpoint(asEvent(event)) : new Response('OK');
            }
          });
          if (resolved) commit();
          return { status: response.status, event };
        } catch (err) {
          if (!isRedirect(err)) throw err;
          commit();
          return { status: err.status, event };
        }
      }
    };
  }

  it('makes the handle refuse an access token copied before the logout', async () => {
    const deps = createLiveDeps();
    const handle = createAuthHandle({ config, repos: deps.repos });
    const resolve = vi.fn(async () => new Response('OK'));
    const copied = await sessionCookie();

    // Control: the copy authenticates as long as the generation matches.
    const before = mockEvent({ session: copied }, { path: '/api/data', method: 'GET' });
    await handle({ event: asEvent(before), resolve });
    expect((before.locals as { user?: unknown }).user, 'copy is valid pre-logout').toBeDefined();

    await createLogoutHandler(deps, { invalidateAccessTokens: true }).POST(
      asEvent(mockEvent({ session: copied }))
    );

    const after = mockEvent({ session: copied }, { path: '/api/data', method: 'GET' });
    const response = await handle({ event: asEvent(after), resolve });
    expect(response.status).toBe(401);
    expect((after.locals as { user?: unknown }).user).toBeNull();
  });

  it('signs another device out, and it cannot rotate back in', async () => {
    const deps = createLiveDeps();
    const handle = createAuthHandle({ config, repos: deps.repos });
    const { token: otherRefresh } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    const deviceB = createJar({ session: await sessionCookie(), refresh: otherRefresh });

    await createLogoutHandler(deps, { invalidateAccessTokens: true }).POST(
      asEvent(mockEvent({ session: await sessionCookie() }))
    );

    expect(
      await deps.repos.refreshToken!.listActiveByUser('user-1'),
      "the other device's refresh family is revoked too"
    ).toEqual([]);

    // The guard answers an API request without resolving, so the clear it staged
    // never reaches the jar — and the next call is refused on the same cookie.
    expect((await deviceB.send(handle, '/api/data')).status).toBe(401);
    expect(deviceB.get('session'), 'the API 401 sets no cookie').toBeDefined();
    expect((await deviceB.send(handle, '/api/data')).status).toBe(401);

    // A page navigation redirects — one of the two paths that do flush — and
    // takes the stale access cookie with it.
    expect((await deviceB.send(handle, '/dashboard')).status).toBe(302);
    expect(deviceB.get('session'), 'stale access cookie cleared').toBeUndefined();
    expect(deviceB.get('refresh'), 'the cookie outlives its revoked row').toBeDefined();

    // The rotation branch runs now, and finds nothing to rotate.
    const back = await deviceB.send(handle, '/api/data');
    expect(back.status).toBe(401);
    expect((back.event.locals as { user?: unknown }).user).toBeNull();
  });

  it('bumps after the hook rotated an expired access cookie in the same request', async () => {
    const deps = createLiveDeps();
    const handle = createAuthHandle({ config, repos: deps.repos });
    const { token: refresh } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });
    // An idle browser: the access token is long gone, the refresh cookie is not.
    const idle = createJar({ refresh });

    const result = await idle.send(
      handle,
      '/api/auth/logout',
      'POST',
      createLogoutHandler(deps, { invalidateAccessTokens: true }).POST
    );

    expect(result.status).toBe(200);
    expect(
      deps.repos.user.incrementTokenVersion,
      'the endpoint reads the session the hook just staged'
    ).toHaveBeenCalledWith('user-1');
    expect(await deps.repos.refreshToken!.listActiveByUser('user-1')).toEqual([]);
    expect(idle.get('session')).toBeUndefined();
    expect(idle.get('refresh')).toBeUndefined();
  });
});
