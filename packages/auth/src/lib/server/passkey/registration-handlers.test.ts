import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the WebAuthn core so the registration *handler* logic (auth gate →
// verify → persist → respond) is exercised independently of the attestation
// crypto, which is verified exhaustively in webauthn.test.ts. We keep the real
// `WebAuthnError` (the handler maps it with `instanceof`) and the real options
// generator; only `verifyRegistration` — the boundary to the crypto — is
// stubbed, the canonical "test the unit, fake the well-tested collaborator"
// seam. This isolation is also why these tests live in their own file: mocking
// is module-scoped, and handlers.test.ts must keep the real WebAuthn core.
//
// This correctness depends on Vitest per-file isolation (the default, pinned in
// vitest.config.ts): under `--no-isolate` the shared module registry would let
// this mock bleed into handlers.test.ts (or be pre-empted by it, depending on
// load order). Keep the package isolated so this stays a local concern.
vi.mock('./webauthn.js', async (importActual) => {
  const actual = await importActual<typeof import('./webauthn.js')>();
  return { ...actual, verifyRegistration: vi.fn() };
});

import type { Passkey, PasskeyRepository } from '../adapters/types.js';
import type { AuthDeps } from '../deps.js';
import { resetRateLimiters } from '../secret-registry.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser } from '../test-utils.js';
import { createInMemoryChallengeStore } from './challenge-store.js';
import { WebAuthnError } from './errors.js';
import { createPasskeyHandlers } from './handlers.js';
import { verifyRegistration, type WebAuthnConfig } from './webauthn.js';

type TestDeps = AuthDeps & {
  webauthn: WebAuthnConfig;
  repos: AuthDeps['repos'] & { passkey: PasskeyRepository };
};
const passkeyHandlers = (d: TestDeps) => createPasskeyHandlers(d, d.webauthn);

const mockedVerify = vi.mocked(verifyRegistration);

function mockPasskeyRepo(overrides: Partial<PasskeyRepository> = {}): PasskeyRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByCredentialId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateCounter: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(),
    ...overrides
  };
}

function mkPasskey(overrides: Partial<Passkey> = {}): Passkey {
  return {
    credentialId: 'cred-abc',
    userId: 'user-1',
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

function makeDeps(
  passkey: PasskeyRepository = mockPasskeyRepo(),
  config: Partial<AuthDeps['config']> = {}
): TestDeps {
  const base = createMockAuthDeps({ config: { jwt: { secret: 's' }, ...config } });
  return {
    ...base,
    repos: { ...base.repos, passkey },
    webauthn: {
      rpId: 'app.test',
      rpName: 'Test',
      origin: 'https://app.test',
      challengeStore: createInMemoryChallengeStore()
    }
  };
}

const SESSION_USER = createMockUser({ id: 'user-1', email: 'user@test.com', name: 'Test User' });

/** The registration handlers resolve the caller from the session cookie
 *  (`requireSessionUser` — R5 replaced the `locals.user` read, which a
 *  consumer `transformUser` hook could reshape), so an authenticated event
 *  carries a real signed session cookie and a matching `findById` row. */
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

function event(body: unknown, jar = makeCookieJar()): RequestEvent {
  return {
    request: new Request('http://localhost/api/auth/passkey/register', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    cookies: jar.cookies
  } as unknown as RequestEvent;
}

async function authedEvent(
  deps: TestDeps,
  body: unknown,
  user = SESSION_USER
): Promise<RequestEvent> {
  const jar = makeCookieJar();
  vi.mocked(deps.repos.user.findById).mockResolvedValue(user);
  await setSessionCookie(
    jar.cookies,
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion
    },
    deps.config.jwt
  );
  return event(body, jar);
}

beforeEach(() => {
  mockedVerify.mockReset();
  // `sharedLimiter` keeps one limiter per (secret, key, window, max) for the
  // whole process, so without this every test in this file would draw on the
  // budget its predecessors spent.
  resetRateLimiters();
});

describe('createPasskeyHandlers — registrationOptions', () => {
  it('returns 401 when there is no authenticated user', async () => {
    const res = await passkeyHandlers(makeDeps()).registrationOptions.POST(event({}));
    expect(res.status).toBe(401);
  });

  it('returns options scoped to the user and excludes already-registered credentials', async () => {
    const passkey = mockPasskeyRepo({
      findByUserId: vi
        .fn()
        .mockResolvedValue([mkPasskey({ credentialId: 'c1' }), mkPasskey({ credentialId: 'c2' })])
    });
    const deps = makeDeps(passkey);

    const res = await passkeyHandlers(deps).registrationOptions.POST(await authedEvent(deps, {}));
    expect(res.status).toBe(200);
    const { options } = await res.json();

    // The ceremony is scoped to the session user (id/email/displayName)…
    expect(options.user.name).toBe('user@test.com');
    expect(options.user.displayName).toBe('Test User');
    // …and the user's existing keys are excluded so they can't double-register.
    expect(options.excludeCredentials.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2']);
    expect(passkey.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('rate-limits per user: the 11th call in the window is refused with Retry-After', async () => {
    const deps = makeDeps();
    const handlers = passkeyHandlers(deps);

    for (let i = 0; i < 10; i++) {
      expect((await handlers.registrationOptions.POST(await authedEvent(deps, {}))).status).toBe(
        200
      );
    }

    const limited = await handlers.registrationOptions.POST(await authedEvent(deps, {}));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect((await limited.json()).code, 'the 429 carries the machine code').toBe('rate_limited');
  });

  it('rateLimit: { passkeyRegister: null } opts out (the default must not creep back)', async () => {
    const deps = makeDeps(mockPasskeyRepo(), { rateLimit: { passkeyRegister: null } });
    const handlers = passkeyHandlers(deps);

    // One past the built-in default of 10 — all must pass.
    for (let i = 0; i < 11; i++) {
      expect((await handlers.registrationOptions.POST(await authedEvent(deps, {}))).status).toBe(
        200
      );
    }
  });

  it('keys on the user id: one account spending its budget does not reach another', async () => {
    // Two bundles built from the same secret read ONE process-wide limiter
    // (`sharedLimiter`), so this also pins that the identifier separating them
    // is the user id and not the bundle.
    const depsA = makeDeps();
    const depsB = makeDeps();
    const other = createMockUser({ id: 'user-2', email: 'other@test.com', name: 'Other User' });
    const handlersA = passkeyHandlers(depsA);
    const handlersB = passkeyHandlers(depsB);

    for (let i = 0; i < 10; i++)
      await handlersA.registrationOptions.POST(await authedEvent(depsA, {}));
    expect(
      (await handlersA.registrationOptions.POST(await authedEvent(depsA, {}))).status,
      'user-1 is spent'
    ).toBe(429);

    expect(
      (await handlersB.registrationOptions.POST(await authedEvent(depsB, {}, other))).status,
      'user-2 has its own budget'
    ).toBe(200);
  });
});

describe('createPasskeyHandlers — registrationVerify', () => {
  it('returns 401 when there is no authenticated user', async () => {
    const res = await passkeyHandlers(makeDeps()).registrationVerify.POST(
      event({ credential: {} })
    );
    expect(res.status).toBe(401);
    // The auth gate short-circuits before any verification runs.
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('returns 400 when the credential is missing from the body', async () => {
    const deps = makeDeps();
    const res = await passkeyHandlers(deps).registrationVerify.POST(await authedEvent(deps, {}));
    expect(res.status).toBe(400);
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('maps a WebAuthnError to a 400 (bad attestation is a client error, not a 500)', async () => {
    mockedVerify.mockRejectedValue(new WebAuthnError('Invalid attestation'));
    const deps = makeDeps();
    const res = await passkeyHandlers(deps).registrationVerify.POST(
      await authedEvent(deps, { credential: { id: 'x' } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code, 'append-only machine code contract').toBe(
      'passkey_registration_verification_failed'
    );
    // The attestation detail names WebAuthn internals; registration has no
    // `onLoginFailed` seam, so the log is the only place it goes.
    expect(body.error).not.toMatch(/attestation/i);
    expect(vi.mocked(deps.logger.warn).mock.calls.flat().join(' ')).toMatch(/Invalid attestation/);
  });

  it('re-throws a non-WebAuthn error so the framework surfaces it as a 500', async () => {
    mockedVerify.mockRejectedValue(new Error('database is down'));
    const deps = makeDeps();
    await expect(
      passkeyHandlers(deps).registrationVerify.POST(
        await authedEvent(deps, { credential: { id: 'x' } })
      )
    ).rejects.toThrow('database is down');
  });

  it('persists the verified credential and returns 201 on success', async () => {
    mockedVerify.mockResolvedValue({
      credentialId: 'cred-xyz',
      publicKey: new Uint8Array([1, 2, 3]),
      publicKeyAlg: -7,
      counter: 0,
      transports: ['internal'],
      aaguid: 'aaaa-bbbb'
    });
    const created = mkPasskey({ credentialId: 'cred-xyz', name: 'My Laptop', aaguid: 'aaaa-bbbb' });
    const passkey = mockPasskeyRepo({ create: vi.fn().mockResolvedValue(created) });
    const deps = makeDeps(passkey);

    const res = await passkeyHandlers(deps).registrationVerify.POST(
      // A hostile body claims another owner and a forged credentialId; the
      // handler must bind to the SESSION user and store the VERIFIED fields.
      await authedEvent(deps, {
        userId: 'victim-2',
        credential: { id: 'spoofed' },
        name: 'My Laptop'
      })
    );

    expect(res.status).toBe(201);
    // The verified fields (not raw client input) are what gets stored, bound to
    // the session user — never a user id from the request body (IDOR guard).
    expect(passkey.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        credentialId: 'cred-xyz', // from verifyRegistration, NOT the body's 'spoofed'
        publicKeyAlg: -7,
        counter: 0,
        transports: ['internal'],
        aaguid: 'aaaa-bbbb',
        name: 'My Laptop'
      })
    );
    expect(passkey.create).not.toHaveBeenCalledWith('victim-2', expect.anything());
    const { passkey: out } = await res.json();
    expect(out).toEqual({
      credentialId: 'cred-xyz',
      name: 'My Laptop',
      createdAt: created.createdAt.toISOString(),
      aaguid: 'aaaa-bbbb'
    });
  });
});

describe("createPasskeyHandlers — registrationVerify names a passkey under the rename's rule", () => {
  /** A verify that will reach `create` unless the name is refused first. */
  const verifying = () =>
    mockedVerify.mockResolvedValue({
      credentialId: 'cred-xyz',
      publicKey: new Uint8Array([1, 2, 3]),
      publicKeyAlg: -7,
      counter: 0,
      transports: ['internal'],
      aaguid: 'aaaa-bbbb'
    });

  // Registration is the second writer of a passkey label. Left unchecked it
  // could store a name PATCH refuses — and that name comes back in every
  // `list` response afterwards, so the bound would depend on which door the
  // value came through.
  it.each([
    ['300 characters', 'x'.repeat(300)],
    ['whitespace only', '   '],
    ['an empty string', ''],
    ['a non-string', 42],
    ['100 KB', 'x'.repeat(100_000)]
  ])('refuses %s with 400 and stores nothing', async (_label, name) => {
    verifying();
    const passkey = mockPasskeyRepo({ create: vi.fn() });
    const deps = makeDeps(passkey);

    const res = await passkeyHandlers(deps).registrationVerify.POST(
      await authedEvent(deps, { credential: { id: 'c' }, name })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('validation_error');
    expect(passkey.create).not.toHaveBeenCalled();
  });

  it('stores the trimmed name, exactly as the rename does', async () => {
    verifying();
    const passkey = mockPasskeyRepo({ create: vi.fn().mockResolvedValue(mkPasskey()) });
    const deps = makeDeps(passkey);

    await passkeyHandlers(deps).registrationVerify.POST(
      await authedEvent(deps, { credential: { id: 'c' }, name: '  My Laptop  ' })
    );

    expect(passkey.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: 'My Laptop' })
    );
  });

  // The panel registers without a name and lets the adapter default stand, so
  // an absent one must keep reaching `create` untouched.
  it.each([
    ['absent', undefined],
    ['null', null]
  ])('passes a %s name through, leaving the adapter default to apply', async (_label, name) => {
    verifying();
    const passkey = mockPasskeyRepo({ create: vi.fn().mockResolvedValue(mkPasskey()) });
    const deps = makeDeps(passkey);

    const body: Record<string, unknown> = { credential: { id: 'c' } };
    if (name !== undefined) body.name = name;
    const res = await passkeyHandlers(deps).registrationVerify.POST(await authedEvent(deps, body));

    expect(res.status).toBe(201);
    expect(passkey.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: undefined })
    );
  });
});
