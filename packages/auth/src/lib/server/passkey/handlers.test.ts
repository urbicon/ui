import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { Passkey, PasskeyRepository } from '../adapters/types.js';
import { setSessionCookie } from '../session.js';
import { createMockUser, createMockUserRepository } from '../test-utils.js';
import { createInMemoryChallengeStore } from './challenge-store.js';
import {
  createPasskeyAuthenticationOptionsHandler,
  createPasskeyAuthenticationVerifyHandler,
  createPasskeyDeleteHandler,
  createPasskeyListHandler,
  type PasskeyHandlerDeps
} from './handlers.js';

/** base64url-encode (no padding) — clientDataJSON is transported this way. */
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function mockPasskeyRepo(): PasskeyRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByCredentialId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateCounter: vi.fn(),
    updateLastUsed: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn()
  };
}

function mkPasskey(overrides: Partial<Passkey> = {}): Passkey {
  return {
    credentialId: 'cred-abc',
    userId: 'real-user-99',
    publicKey: new Uint8Array(0),
    publicKeyAlg: -7,
    counter: 0,
    transports: ['internal'],
    aaguid: '00000000-0000-0000-0000-000000000000',
    name: 'Test Key',
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides
  };
}

function makeDeps(): PasskeyHandlerDeps {
  return {
    // A per-test challenge store keeps the ceremony state isolated from the
    // process-wide default (and from sibling tests).
    webauthn: {
      rpId: 'app.test',
      rpName: 'Test',
      origin: 'https://app.test',
      challengeStore: createInMemoryChallengeStore()
    },
    authConfig: {
      appUrl: 'https://app.test',
      jwt: { secret: 's' },
      rateLimit: { passkeyAuth: { windowMs: 60_000, max: 2 } }
    },
    repos: { passkey: mockPasskeyRepo(), user: createMockUserRepository() }
  };
}

/** A real (Map-backed) cookie jar so the options→verify round-trip carries the
 *  ceremony cookie exactly as a browser would. */
function makeCookieJar() {
  const store = new Map<string, string>();
  const cookies = {
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => void store.set(name, value),
    delete: (name: string) => void store.delete(name),
    getAll: () => [],
    serialize: () => ''
  } as unknown as Cookies;
  return { store, cookies };
}

function event(
  body: unknown,
  opts: { ip?: string; jar?: ReturnType<typeof makeCookieJar> } = {}
): RequestEvent {
  const jar = opts.jar ?? makeCookieJar();
  return {
    request: new Request('http://localhost/api/auth/passkey', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    cookies: jar.cookies,
    getClientAddress: () => opts.ip ?? '1.2.3.4'
  } as unknown as RequestEvent;
}

describe('passkey auth rate limiting', () => {
  // Review finding (Cluster A): the options + verify handlers must share ONE
  // per-IP budget, not get an independent one each (which would double the
  // effective allowance for the single login flow they implement).
  it('shares one rate-limit budget across the options + verify handlers', async () => {
    const deps = makeDeps();
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    const verify = createPasskeyAuthenticationVerifyHandler(deps);

    expect((await options.POST(event({}))).status).toBe(200);
    expect((await options.POST(event({}))).status).toBe(200);
    // max=2 is now spent; the verify handler shares the same counter → 429
    // before it ever parses the credential.
    expect((await verify.POST(event({ credential: { id: 'x' } }))).status).toBe(429);
  });

  it('keeps budgets separate per client IP', async () => {
    const options = createPasskeyAuthenticationOptionsHandler(makeDeps());
    expect((await options.POST(event({}, { ip: 'ip-a' }))).status).toBe(200);
    expect((await options.POST(event({}, { ip: 'ip-a' }))).status).toBe(200);
    expect((await options.POST(event({}, { ip: 'ip-a' }))).status).toBe(429);
    // A different IP has its own budget.
    expect((await options.POST(event({}, { ip: 'ip-b' }))).status).toBe(200);
  });

  it('does not rate-limit when passkeyAuth is unconfigured', async () => {
    const deps = makeDeps();
    deps.authConfig.rateLimit = undefined;
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    for (let i = 0; i < 5; i++) {
      expect((await options.POST(event({}))).status).toBe(200);
    }
  });
});

// Cluster G.1 (Finding M4): the authentication challenge must be bound to a
// per-ceremony handle carried in a cookie — NOT to a user id, which made the
// discoverable ("usernameless") flow impossible (the challenge was stored under
// '__passkey_login__' / the email-user but consumed under the credential's
// owner id, so it was never found).
describe('passkey auth — ceremony-handle binding (G.1)', () => {
  it('options stores the challenge under the ceremony cookie value', async () => {
    const deps = makeDeps();
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    const jar = makeCookieJar();

    const res = await options.POST(event({}, { jar }));
    expect(res.status).toBe(200);
    const { options: opts } = await res.json();

    // Exactly one cookie was set; its value keys the stored challenge.
    expect(jar.store.size).toBe(1);
    const ceremonyId = [...jar.store.values()][0];
    expect(ceremonyId).toBeTruthy();
    const entry = await deps.webauthn.challengeStore!.get(ceremonyId);
    expect(entry?.challenge).toBe(opts.challenge);
  });

  it('options uses the __Host- prefixed cookie name on a secure (HTTPS) config', async () => {
    const deps = makeDeps(); // jwt.cookieSecure unset → secure default
    const jar = makeCookieJar();
    await createPasskeyAuthenticationOptionsHandler(deps).POST(event({}, { jar }));
    expect([...jar.store.keys()][0]).toMatch(/^__Host-/);
  });

  it('options falls back to the bare cookie name when cookieSecure is false (dev)', async () => {
    const deps = makeDeps();
    deps.authConfig.jwt.cookieSecure = false;
    const jar = makeCookieJar();
    await createPasskeyAuthenticationOptionsHandler(deps).POST(event({}, { jar }));
    expect([...jar.store.keys()][0]).not.toMatch(/^__Host-/);
  });

  it('email-first: scopes allowCredentials to the user without leaking existence', async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.user.findByEmail).mockResolvedValue(createMockUser({ id: 'u1' }));
    vi.mocked(deps.repos.passkey.findByUserId).mockResolvedValue([
      mkPasskey({ credentialId: 'c1' }),
      mkPasskey({ credentialId: 'c2' })
    ]);
    const options = createPasskeyAuthenticationOptionsHandler(deps);

    const { options: opts } = await (await options.POST(event({ email: 'u1@test.com' }))).json();
    expect(opts.allowCredentials.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2']);

    // Unknown email → empty list, same 200 shape (no enumeration).
    vi.mocked(deps.repos.user.findByEmail).mockResolvedValue(null);
    const { options: opts2 } = await (
      await options.POST(event({ email: 'ghost@test.com' }))
    ).json();
    expect(opts2.allowCredentials).toEqual([]);
  });

  it('discoverable verify resolves the challenge under the ceremony handle, not the credential owner id', async () => {
    const deps = makeDeps();
    // Credential owned by an id unrelated to any ceremony handle. The OLD code
    // consumed the challenge under stored.userId and would always 400 with
    // "Challenge expired or not found"; the fix consumes it under the cookie's
    // handle, so the ceremony advances PAST the challenge gate.
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue(mkPasskey());
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    const verify = createPasskeyAuthenticationVerifyHandler(deps);
    const jar = makeCookieJar();

    const { options: opts } = await (await options.POST(event({}, { jar }))).json();

    const clientDataJSON = b64url(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: opts.challenge,
        origin: deps.webauthn.origin
      })
    );
    const res = await verify.POST(
      event(
        {
          credential: {
            id: 'cred-abc',
            rawId: 'cred-abc',
            type: 'public-key',
            response: { clientDataJSON, authenticatorData: 'AA', signature: 'AA' }
          }
        },
        { jar }
      )
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    // Got past the challenge gate (found AND matched under the handle); fails
    // later on the junk authenticatorData. The defining regression assertion:
    // it is NOT a challenge-resolution failure.
    expect(data.error).not.toMatch(/Challenge/i);
  });

  it('a wrong challenge under a valid ceremony handle reports a mismatch (handle was resolved)', async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue(mkPasskey());
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    const verify = createPasskeyAuthenticationVerifyHandler(deps);
    const jar = makeCookieJar();

    await options.POST(event({}, { jar }));

    const clientDataJSON = b64url(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: 'not-the-issued-one',
        origin: deps.webauthn.origin
      })
    );
    const res = await verify.POST(
      event(
        {
          credential: {
            id: 'cred-abc',
            rawId: 'cred-abc',
            type: 'public-key',
            response: { clientDataJSON, authenticatorData: 'AA', signature: 'AA' }
          }
        },
        { jar }
      )
    );
    const data = await res.json();
    // "mismatch" (not "expired or not found") proves the challenge WAS located
    // under the ceremony handle.
    expect(data.error).toMatch(/mismatch/i);
  });

  it('verify without a ceremony cookie fails closed', async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue(mkPasskey());
    const verify = createPasskeyAuthenticationVerifyHandler(deps);

    // No options call → no cookie in the jar.
    const res = await verify.POST(
      event({
        credential: {
          id: 'cred-abc',
          rawId: 'cred-abc',
          type: 'public-key',
          response: { clientDataJSON: b64url('{}'), authenticatorData: 'AA', signature: 'AA' }
        }
      })
    );
    expect(res.status).toBe(400);
    const challengeBody = await res.json();
    expect(challengeBody.error).toMatch(/Challenge expired or not found/i);
    expect(challengeBody.code, 'append-only machine code contract').toBe(
      'passkey_verification_failed'
    );
    // It must fail before touching the credential store.
    expect(deps.repos.passkey.findByCredentialId).not.toHaveBeenCalled();
  });

  it('verify consumes the ceremony cookie (single-use)', async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue(mkPasskey());
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    const verify = createPasskeyAuthenticationVerifyHandler(deps);
    const jar = makeCookieJar();

    await options.POST(event({}, { jar }));
    expect(jar.store.size).toBe(1);

    await verify.POST(
      event(
        {
          credential: {
            id: 'cred-abc',
            rawId: 'cred-abc',
            type: 'public-key',
            response: { clientDataJSON: b64url('{}'), authenticatorData: 'AA', signature: 'AA' }
          }
        },
        { jar }
      )
    );
    // Cookie cleared regardless of the verify outcome → no replay.
    expect(jar.store.size).toBe(0);
  });

  it('burns the ceremony cookie even on a malformed verify body (no replay after bad input)', async () => {
    const deps = makeDeps();
    const options = createPasskeyAuthenticationOptionsHandler(deps);
    const verify = createPasskeyAuthenticationVerifyHandler(deps);
    const jar = makeCookieJar();

    await options.POST(event({}, { jar }));
    expect(jar.store.size).toBe(1);

    // No `credential` field → 400, but the single-use handle must still be
    // burned so a follow-up can't reuse the same ceremony.
    const res = await verify.POST(event({}, { jar }));
    expect(res.status).toBe(400);
    expect(jar.store.size).toBe(0);
  });
});

// The self-service handlers resolve the caller from the session cookie
// (requireSessionUser, R5) — an authenticated event carries a real signed
// session cookie plus a matching findById row.
async function sessionEvent(
  deps: PasskeyHandlerDeps,
  extra: { params?: Record<string, string> } = {}
): Promise<RequestEvent> {
  const user = createMockUser({ id: 'real-user-99' });
  vi.mocked(deps.repos.user.findById).mockResolvedValue(user);
  const jar = makeCookieJar();
  await setSessionCookie(
    jar.cookies,
    { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    deps.authConfig.jwt
  );
  return { cookies: jar.cookies, params: extra.params ?? {} } as unknown as RequestEvent;
}

describe('createPasskeyListHandler — GET', () => {
  it('returns 401 when unauthenticated', async () => {
    const deps = makeDeps();
    const res = await createPasskeyListHandler(deps).GET({
      cookies: makeCookieJar().cookies
    } as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(deps.repos.passkey.findByUserId).not.toHaveBeenCalled();
  });

  it("lists the session user's passkeys projected to the display shape", async () => {
    const deps = makeDeps();
    const stored = mkPasskey({
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 42,
      lastUsedAt: new Date('2026-06-01T00:00:00Z')
    });
    deps.repos.passkey.findByUserId = vi.fn().mockResolvedValue([stored]);

    const res = await createPasskeyListHandler(deps).GET(await sessionEvent(deps));
    expect(res.status).toBe(200);
    expect(deps.repos.passkey.findByUserId).toHaveBeenCalledWith('real-user-99');

    const { passkeys } = await res.json();
    expect(passkeys).toHaveLength(1);
    // Display fields only — the COSE public key and the sign counter are
    // server-internal verification state and must never reach the client.
    expect(Object.keys(passkeys[0]).sort()).toEqual([
      'aaguid',
      'createdAt',
      'credentialId',
      'lastUsedAt',
      'name'
    ]);
    expect(passkeys[0].credentialId).toBe('cred-abc');
    expect(passkeys[0].name).toBe('Test Key');
  });
});

describe('createPasskeyDeleteHandler — DELETE', () => {
  it('returns 401 when unauthenticated', async () => {
    const deps = makeDeps();
    const res = await createPasskeyDeleteHandler(deps).DELETE({
      cookies: makeCookieJar().cookies,
      params: { credentialId: 'cred-abc' }
    } as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(deps.repos.passkey.delete).not.toHaveBeenCalled();
  });

  it('returns 400 without a credentialId param', async () => {
    const deps = makeDeps();
    const res = await createPasskeyDeleteHandler(deps).DELETE(await sessionEvent(deps));
    expect(res.status).toBe(400);
    expect(deps.repos.passkey.delete).not.toHaveBeenCalled();
  });

  it('deletes owner-scoped: (credentialId, userId) in that order', async () => {
    const deps = makeDeps();
    const res = await createPasskeyDeleteHandler(deps).DELETE(
      await sessionEvent(deps, { params: { credentialId: 'cred-abc' } })
    );
    expect(res.status).toBe(200);
    // Argument order is the IDOR guard: the repo no-ops unless the row
    // belongs to this user.
    expect(deps.repos.passkey.delete).toHaveBeenCalledWith('cred-abc', 'real-user-99');
  });
});

describe('passkey self-service — session revalidation (R5)', () => {
  it('rejects a stale tokenVersion with 401 ("log out everywhere" covers passkey management)', async () => {
    // The R5 selling point: cookie resolution re-validates tokenVersion, so a
    // JWT-only drift (trusting the claims without findById) must fail here.
    const deps = makeDeps();
    const user = createMockUser({ id: 'real-user-99', tokenVersion: 5 });
    vi.mocked(deps.repos.user.findById).mockResolvedValue(user);
    const jar = makeCookieJar();
    await setSessionCookie(
      jar.cookies,
      { userId: user.id, email: user.email, role: user.role, tokenVersion: 4 }, // stale
      deps.authConfig.jwt
    );

    const res = await createPasskeyListHandler(deps).GET({
      cookies: jar.cookies
    } as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(deps.repos.passkey.findByUserId).not.toHaveBeenCalled();
  });
});
