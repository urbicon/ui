import type { RequestEvent } from '@sveltejs/kit';
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

/** A `revoke` that records itself, so the order against the bump is observable. */
function tracedRefreshRepo(repo: RefreshTokenRepository, trace: string[]): RefreshTokenRepository {
  return {
    ...repo,
    revoke: (id, replacedById) => {
      trace.push('revoke');
      return repo.revoke(id, replacedById);
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
  } = {}
) {
  const { path = '/api/auth/logout', method = 'POST', trace, locals = {} } = extras;
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
    request: new Request(`http://localhost:3000${path}`, { method }),
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

  it('bumps once, before the refresh revoke and before the cookies are cleared', async () => {
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
    // The bump reads the session cookie, so it must land while the cookie is
    // still in the jar.
    expect(trace).toEqual(['bump', 'revoke', 'clear:session', 'clear:refresh']);
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
    expect(cookieJar(event).get('session')).toBeUndefined();
    expect(cookieJar(event).get('refresh')).toBeUndefined();
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

  it('costs another device its access token but not its refresh token', async () => {
    const deps = createLiveDeps();
    const handle = createAuthHandle({ config, repos: deps.repos });
    const resolve = vi.fn(async () => new Response('OK'));
    const otherAccess = await sessionCookie();
    const { token: otherRefresh } = await issueRefreshToken(deps.repos.refreshToken!, 'user-1', {
      refreshTokenTtl: '30d'
    });

    await createLogoutHandler(deps, { invalidateAccessTokens: true }).POST(
      asEvent(mockEvent({ session: await sessionCookie() }))
    );

    // One request refused: the other device's access cookie is a generation behind.
    const refused = mockEvent(
      { session: otherAccess, refresh: otherRefresh },
      { path: '/api/data', method: 'GET' }
    );
    expect((await handle({ event: asEvent(refused), resolve })).status).toBe(401);
    expect(cookieJar(refused).get('session'), 'stale access cookie cleared').toBeUndefined();

    // The next one rotates the surviving refresh token into a fresh session.
    const rotated = mockEvent({ refresh: otherRefresh }, { path: '/api/data', method: 'GET' });
    await handle({ event: asEvent(rotated), resolve });
    expect((rotated.locals as { user?: { id?: string } }).user?.id).toBe('user-1');
    expect(cookieJar(rotated).get('session'), 'a new access cookie is minted').toBeDefined();
  });
});
