import type { Handle, RequestEvent, RequestHandler } from '@sveltejs/kit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthLogger, JwtConfig } from '../types.js';
import { base64UrlEncodeString } from './encoding.js';
import {
  createFederatedAuthHandle,
  type FederatedAuthHandleOptions,
  type FederatedIdentity
} from './federated-handle.js';
import { createJWKSHandler } from './handlers/jwks.js';
import { createSessionToken, generateES256KeyPair } from './jwt.js';

/**
 * Consumer-side federation tests. The IdP side (key generation, ES256
 * minting, JWKS serving) is exercised with the REAL implementations — a token
 * minted by `createSessionToken` under an ES256 config, verified against the
 * document `createJWKSHandler` actually serves — so the two halves of the
 * federation contract are pinned against each other, not against fixtures.
 * Only the network hop is stubbed (fetch on globalThis).
 */

type MockEvent = ReturnType<typeof createMockEvent>;
const asEvent = (e: MockEvent) => e as unknown as RequestEvent;

const JWKS_URL = 'https://idp.test/.well-known/jwks.json';

let pair: Awaited<ReturnType<typeof generateES256KeyPair>>;
let rotated: Awaited<ReturnType<typeof generateES256KeyPair>>;

beforeAll(async () => {
  pair = await generateES256KeyPair();
  rotated = await generateES256KeyPair();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function idpJwt(overrides: Partial<JwtConfig> = {}): JwtConfig {
  return {
    secret: 'idp-internal-secret',
    algorithm: 'ES256',
    signingKey: pair.privateKey,
    expiresIn: '1h',
    ...overrides
  };
}

/** The exact JWKS document the IdP would serve for `jwt` — via the real handler. */
async function jwksDocumentFor(jwt: JwtConfig): Promise<string> {
  const handler = createJWKSHandler({ jwt }) as { GET: RequestHandler };
  const res = await handler.GET(undefined as unknown as RequestEvent);
  return res.text();
}

/** Stub globalThis.fetch to serve `body()` (fresh Response per call). */
function stubJwksFetch(body: () => string | Promise<string>) {
  const fetchMock = vi.fn(
    async () =>
      new Response(await body(), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function createMockEvent(options: {
  path: string;
  method?: string;
  sessionCookie?: string;
  cookieName?: string;
  isRemoteRequest?: boolean;
}) {
  const cookieStore = new Map<string, string>();
  if (options.sessionCookie) {
    cookieStore.set(options.cookieName ?? 'session', options.sessionCookie);
  }
  return {
    request: new Request(`https://consumer.test${options.path}`, {
      method: options.method ?? 'GET'
    }),
    url: new URL(`https://consumer.test${options.path}`),
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

function mockLogger() {
  return {
    warn: vi.fn<(message: string, ...context: unknown[]) => void>(),
    error: vi.fn<(message: string, ...context: unknown[]) => void>()
  } satisfies AuthLogger;
}

function handleOptions(
  overrides: Partial<FederatedAuthHandleOptions<unknown>> = {}
): FederatedAuthHandleOptions<unknown> {
  return {
    jwksUrl: JWKS_URL,
    resolveUser: (identity) => ({ id: `local-${identity.subject}`, email: identity.email }),
    logger: mockLogger(),
    ...overrides
  };
}

const ok = () => vi.fn().mockResolvedValue(new Response('OK'));

async function mintIdpToken(overrides: Partial<JwtConfig> = {}): Promise<string> {
  return createSessionToken(
    { userId: 'idp-user-1', email: 'user@idp.test', role: 'admin', tokenVersion: 3 },
    idpJwt(overrides)
  );
}

describe('createFederatedAuthHandle — factory guards', () => {
  it('throws for a non-https jwksUrl (http is not a trust anchor)', () => {
    expect(() =>
      createFederatedAuthHandle(handleOptions({ jwksUrl: 'http://idp.example.com/jwks.json' }))
    ).toThrow(/https/);
  });

  it('throws for a relative/invalid jwksUrl', () => {
    expect(() => createFederatedAuthHandle(handleOptions({ jwksUrl: '/jwks.json' }))).toThrow(
      /absolute URL/
    );
  });

  it('tolerates http for localhost development, with a warning', () => {
    const logger = mockLogger();
    expect(() =>
      createFederatedAuthHandle(
        handleOptions({ jwksUrl: 'http://localhost:5173/jwks.json', logger })
      )
    ).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('localhost'));
  });

  it('throws for a non-positive cacheTtlMs', () => {
    expect(() => createFederatedAuthHandle(handleOptions({ cacheTtlMs: 0 }))).toThrow(/cacheTtlMs/);
  });

  it('throws for a malformed maxTokenAge duration at factory time', () => {
    expect(() => createFederatedAuthHandle(handleOptions({ maxTokenAge: 'soon' }))).toThrow(
      /Invalid duration/
    );
  });
});

describe('createFederatedAuthHandle — IdP token round-trip', () => {
  it('verifies a real IdP ES256 token against the real JWKS document and resolves the user', async () => {
    const fetchMock = stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const resolveUser = vi.fn((identity: FederatedIdentity) => ({
      id: `local-${identity.subject}`,
      tenant: 'acme'
    }));
    const handle = createFederatedAuthHandle(handleOptions({ resolveUser }));

    const event = createMockEvent({ path: '/dashboard', sessionCookie: await mintIdpToken() });
    const response = await handle({ event: asEvent(event), resolve: ok() });

    expect(response.status).toBe(200);
    expect(event.locals.user).toEqual({ id: 'local-idp-user-1', tenant: 'acme' });
    expect(resolveUser).toHaveBeenCalledTimes(1);
    // The JWKS fetch is lazy and cached: exactly one fetch for the request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(JWKS_URL, expect.anything());

    // A second request within the TTL verifies from the cache — no refetch.
    const second = createMockEvent({ path: '/dashboard', sessionCookie: await mintIdpToken() });
    await handle({ event: asEvent(second), resolve: ok() });
    expect(second.locals.user).toMatchObject({ id: 'local-idp-user-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hands resolveUser identity claims ONLY — the IdP role/tokenVersion never arrive', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    let seen: FederatedIdentity | null = null;
    const handle = createFederatedAuthHandle(
      handleOptions({
        resolveUser: (identity) => {
          seen = identity;
          // Type-level guarantee: the IdP-internal authorization claims are
          // not part of FederatedIdentity at all.
          // @ts-expect-error — role is deliberately absent from FederatedIdentity
          void identity.role;
          // @ts-expect-error — tokenVersion is deliberately absent from FederatedIdentity
          void identity.tokenVersion;
          return { id: identity.subject, email: identity.email };
        }
      })
    );

    const event = createMockEvent({ path: '/x', sessionCookie: await mintIdpToken() });
    await handle({ event: asEvent(event), resolve: ok() });

    // Runtime guarantee: field-by-field construction — nothing beyond the
    // four identity claims, whatever the token carried.
    expect(seen).not.toBeNull();
    expect(Object.keys(seen ?? {}).sort()).toEqual(['email', 'expiresAt', 'issuedAt', 'subject']);
    expect(seen).toMatchObject({ subject: 'idp-user-1', email: 'user@idp.test' });
    expect((seen as unknown as { issuedAt: number }).issuedAt).toBeTypeOf('number');
  });

  it('treats resolveUser → null as denial: no locals.user, guard applies (fail-closed)', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(
      handleOptions({ resolveUser: () => null, loginUrl: 'https://idp.test/auth/login' })
    );

    // API route → machine-readable 401 despite the valid IdP token.
    const api = createMockEvent({ path: '/api/data', sessionCookie: await mintIdpToken() });
    const response = await handle({ event: asEvent(api), resolve: vi.fn() });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('not_authenticated');
    expect(api.locals.user).toBeNull();

    // Page → redirect to the IdP login.
    const page = createMockEvent({ path: '/dashboard', sessionCookie: await mintIdpToken() });
    try {
      await handle({ event: asEvent(page), resolve: vi.fn() });
      expect.fail('Should have redirected');
    } catch (e) {
      const err = e as { status?: number; location?: string };
      expect(err.status).toBe(302);
      // Verbatim loginUrl — deliberately NO redirectTo (the IdP's
      // sanitizeRedirect admits IdP-local paths only).
      expect(err.location).toBe('https://idp.test/auth/login');
    }
  });

  it('rejects an HS256 token before any JWKS fetch (federation is asymmetric-only)', async () => {
    const fetchMock = stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions());

    const hs256Token = await createSessionToken(
      { userId: 'idp-user-1', email: 'user@idp.test', role: 'admin', tokenVersion: 0 },
      { secret: 'shared-secret', expiresIn: '1h' } // HS256 default
    );
    const event = createMockEvent({ path: '/api/data', sessionCookie: hs256Token });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });

    expect(response.status).toBe(401);
    expect(event.locals.user).toBeNull();
    expect(fetchMock, 'alg pin rejects before key lookup').not.toHaveBeenCalled();
  });

  it('rejects a kid-less ES256 token before any JWKS fetch', async () => {
    const fetchMock = stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions());

    // Hand-crafted foreign token: ES256 header without a kid (the IdP always
    // stamps one). Signature content is irrelevant — rejection precedes it.
    const header = base64UrlEncodeString(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
    const body = base64UrlEncodeString(
      JSON.stringify({ sub: 'x', email: 'x@x.test', iat: 0, exp: 9999999999 })
    );
    const token = `${header}.${body}.${'A'.repeat(86)}`;

    const event = createMockEvent({ path: '/api/data', sessionCookie: token });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an expired token and one older than maxTokenAge (revocation-blindness cap)', async () => {
    vi.useFakeTimers();
    try {
      stubJwksFetch(() => jwksDocumentFor(idpJwt()));
      const resolveUser = vi.fn(() => ({ id: 'u' }));
      const handle = createFederatedAuthHandle(handleOptions({ resolveUser, maxTokenAge: '10m' }));

      const token = await mintIdpToken(); // exp 1h, iat now
      const fresh = createMockEvent({ path: '/x', sessionCookie: token });
      await handle({ event: asEvent(fresh), resolve: ok() });
      expect(fresh.locals.user, 'fresh token passes').not.toBeNull();

      // 11 minutes later the token is still within exp (1h) but past the
      // consumer's freshness cap — reject.
      vi.advanceTimersByTime(11 * 60_000);
      const stale = createMockEvent({ path: '/api/data', sessionCookie: token });
      const response = await handle({ event: asEvent(stale), resolve: vi.fn() });
      expect(response.status).toBe(401);
      expect(resolveUser).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the cookie name the IdP is configured with', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions({ cookieName: 'idp_session' }));

    const event = createMockEvent({
      path: '/x',
      sessionCookie: await mintIdpToken(),
      cookieName: 'idp_session'
    });
    await handle({ event: asEvent(event), resolve: ok() });
    expect(event.locals.user).not.toBeNull();
  });
});

describe('createFederatedAuthHandle — JWKS cache, rotation & cooldown', () => {
  it('refreshes once for an unknown kid (key rotation), then fails closed within the cooldown', async () => {
    vi.useFakeTimers();
    try {
      // The IdP starts on `pair`, then rotates to `rotated` (previous public
      // key kept in the JWKS — the real rotation runbook).
      let currentJwt = idpJwt();
      const fetchMock = stubJwksFetch(() => jwksDocumentFor(currentJwt));
      const handle = createFederatedAuthHandle(handleOptions());

      const first = createMockEvent({ path: '/x', sessionCookie: await mintIdpToken() });
      await handle({ event: asEvent(first), resolve: ok() });
      expect(first.locals.user).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Rotate the IdP. Past the cooldown, a token under the NEW kid triggers
      // exactly one refresh and then verifies.
      currentJwt = idpJwt({
        signingKey: rotated.privateKey,
        previousPublicKeys: [pair.publicKey]
      });
      vi.advanceTimersByTime(61_000);
      const rotatedToken = await createSessionToken(
        { userId: 'idp-user-1', email: 'user@idp.test', role: 'admin', tokenVersion: 3 },
        currentJwt
      );
      const second = createMockEvent({ path: '/x', sessionCookie: rotatedToken });
      await handle({ event: asEvent(second), resolve: ok() });
      expect(second.locals.user).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Invented kids right after: the cooldown blocks further refreshes —
      // every request fails closed, no fetch storm.
      const bogusHeader = base64UrlEncodeString(
        JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'invented-kid' })
      );
      const [, body, sig] = rotatedToken.split('.');
      for (let i = 0; i < 5; i++) {
        const event = createMockEvent({
          path: '/api/data',
          sessionCookie: `${bogusHeader}.${body}.${sig}`
        });
        const response = await handle({ event: asEvent(event), resolve: vi.fn() });
        expect(response.status).toBe(401);
      }
      expect(fetchMock, 'invented kids cause no fetch storm').toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refetches after the cache TTL expires', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = stubJwksFetch(() => jwksDocumentFor(idpJwt()));
      const handle = createFederatedAuthHandle(handleOptions());

      const first = createMockEvent({ path: '/x', sessionCookie: await mintIdpToken() });
      await handle({ event: asEvent(first), resolve: ok() });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Within the TTL: served from cache.
      vi.advanceTimersByTime(4 * 60_000);
      const second = createMockEvent({ path: '/x', sessionCookie: await mintIdpToken() });
      await handle({ event: asEvent(second), resolve: ok() });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Past the TTL (default 5 min): the next verification refetches.
      vi.advanceTimersByTime(2 * 60_000);
      const third = createMockEvent({ path: '/x', sessionCookie: await mintIdpToken() });
      await handle({ event: asEvent(third), resolve: ok() });
      expect(third.locals.user).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createFederatedAuthHandle — fail-closed JWKS handling', () => {
  async function expectSignedOut(handle: Handle, token: string) {
    const event = createMockEvent({ path: '/api/data', sessionCookie: token });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status, 'fail-closed: signed out, not a 500').toBe(401);
    expect(event.locals.user).toBeNull();
  }

  it('treats a failing fetch as signed out, warns exactly once, and does not re-fetch within the cooldown', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network unreachable');
    });
    vi.stubGlobal('fetch', fetchMock);
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));

    const token = await mintIdpToken();
    await expectSignedOut(handle, token);
    await expectSignedOut(handle, token);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('fail closed'),
      expect.anything()
    );
    expect(fetchMock, 'cooldown gates retry').toHaveBeenCalledTimes(1);
  });

  it('treats a non-OK response as a failed fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('teapot', { status: 503 }))
    );
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));
    await expectSignedOut(handle, await mintIdpToken());
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('treats malformed JSON as a failed fetch', async () => {
    stubJwksFetch(() => 'this is not JSON');
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));
    await expectSignedOut(handle, await mintIdpToken());
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('treats a document without a keys array as a failed fetch', async () => {
    stubJwksFetch(() => JSON.stringify({ nokeys: true }));
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));
    await expectSignedOut(handle, await mintIdpToken());
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('fail closed'),
      expect.anything()
    );
  });

  it('refuses an oversized key set wholesale (cap 10)', async () => {
    const key = {
      kty: 'EC',
      crv: 'P-256',
      x: pair.publicKey.x,
      y: pair.publicKey.y,
      alg: 'ES256',
      use: 'sig'
    };
    stubJwksFetch(() =>
      JSON.stringify({
        keys: Array.from({ length: 11 }, (_, i) => ({ ...key, kid: i === 0 ? pair.kid : `k${i}` }))
      })
    );
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));
    // The active kid IS in the document — but an 11-key JWKS is not trusted.
    await expectSignedOut(handle, await mintIdpToken());
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('discards a JWKS key carrying the private scalar `d` and warns loudly', async () => {
    stubJwksFetch(() =>
      JSON.stringify({
        // The IdP catastrophically served its PRIVATE key: same kid the token
        // references — the consumer must refuse to use it.
        keys: [{ ...pair.privateKey, kid: pair.kid, alg: 'ES256', use: 'sig' }]
      })
    );
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));
    await expectSignedOut(handle, await mintIdpToken());
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('private scalar'));
  });

  it('ignores non-P-256 / non-EC entries (strict filter)', async () => {
    stubJwksFetch(() =>
      JSON.stringify({
        keys: [
          { kty: 'RSA', n: 'xx', e: 'AQAB', kid: pair.kid }, // wrong kty under the right kid
          { kty: 'EC', crv: 'P-384', x: 'a', y: 'b', kid: 'p384' },
          { kty: 'EC', crv: 'P-256', x: pair.publicKey.x, kid: 'incomplete' } // missing y
        ]
      })
    );
    const handle = createFederatedAuthHandle(handleOptions());
    await expectSignedOut(handle, await mintIdpToken());
  });

  it('fetches the JWKS with redirect: "error" so a 302 cannot relocate the trust anchor', async () => {
    const fetchMock = stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions());
    const event = createMockEvent({ path: '/dashboard', sessionCookie: await mintIdpToken() });
    await handle({ event: asEvent(event), resolve: ok() });
    expect(fetchMock).toHaveBeenCalledWith(
      JWKS_URL,
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('refuses an oversized JWKS body (byte cap) before buffering it whole, and fails closed', async () => {
    stubJwksFetch(() => 'x'.repeat(300 * 1024));
    const logger = mockLogger();
    const handle = createFederatedAuthHandle(handleOptions({ logger }));
    const event = createMockEvent({ path: '/api/data', sessionCookie: await mintIdpToken() });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status, 'fail-closed: signed out, not a 500').toBe(401);
    expect(event.locals.user).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('fail closed'),
      expect.anything()
    );
  });
});

describe('createFederatedAuthHandle — route guard', () => {
  it('lets public routes resolve without a session (locals.user null)', async () => {
    const fetchMock = stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions({ publicRoutes: ['/public'] }));

    const event = createMockEvent({ path: '/public/pricing' });
    const resolve = ok();
    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
    expect(event.locals.user).toBeNull();
    expect(fetchMock, 'no cookie → no verification → no fetch').not.toHaveBeenCalled();
  });

  it('defaults to a fully guarded app (empty publicRoutes) with a JSON 401 when no loginUrl is set', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions());

    const event = createMockEvent({ path: '/any/page' });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('not_authenticated');
  });

  it('keeps the JSON 401 for /api/ routes even when loginUrl is set', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(
      handleOptions({ loginUrl: 'https://idp.test/auth/login' })
    );
    const event = createMockEvent({ path: '/api/data' });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status).toBe(401);
  });

  it('default-denies an unauthenticated remote request even on a (spoofable) public path', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions({ publicRoutes: ['/public'] }));

    const event = createMockEvent({ path: '/public/pricing', isRemoteRequest: true });
    const resolve = vi.fn().mockResolvedValue(new Response('leaked'));
    const response = await handle({ event: asEvent(event), resolve });
    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('default-denies the no-JS ?/remote= form fallback on a public path', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions({ publicRoutes: ['/public'] }));

    const event = createMockEvent({
      path: '/public/pricing?/remote=deleteThing',
      method: 'POST'
    });
    const response = await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(response.status).toBe(401);
  });

  it('honours allowUnauthenticatedRemote and lets authenticated remote requests through', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));

    const optIn = createFederatedAuthHandle(handleOptions({ allowUnauthenticatedRemote: true }));
    const anon = createMockEvent({ path: '/x', isRemoteRequest: true });
    expect((await optIn({ event: asEvent(anon), resolve: ok() })).status).toBe(200);

    const strict = createFederatedAuthHandle(handleOptions());
    const authed = createMockEvent({
      path: '/x',
      sessionCookie: await mintIdpToken(),
      isRemoteRequest: true
    });
    expect((await strict({ event: asEvent(authed), resolve: ok() })).status).toBe(200);
    expect(authed.locals.user).not.toBeNull();
  });

  it('never writes or clears cookies — the IdP owns the session cookie', async () => {
    stubJwksFetch(() => jwksDocumentFor(idpJwt()));
    const handle = createFederatedAuthHandle(handleOptions({ resolveUser: () => null }));

    // Even for a denied session the consumer must not touch the cookie: it is
    // the IdP's, shared via cookieDomain — clearing it here would log the
    // user out of every sibling app.
    const token = await mintIdpToken();
    const event = createMockEvent({ path: '/api/data', sessionCookie: token });
    await handle({ event: asEvent(event), resolve: vi.fn() });
    expect(event._cookieStore.get('session')).toBe(token);
  });
});
