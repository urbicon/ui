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
import { setSessionCookie } from '../session.js';
import { createMockUser, createMockUserRepository } from '../test-utils.js';
import {
  createPasskeyRegistrationOptionsHandler,
  createPasskeyRegistrationVerifyHandler,
  type PasskeyHandlerDeps
} from './handlers.js';
import { createInMemoryChallengeStore, verifyRegistration, WebAuthnError } from './webauthn.js';

const mockedVerify = vi.mocked(verifyRegistration);

function mockPasskeyRepo(overrides: Partial<PasskeyRepository> = {}): PasskeyRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByCredentialId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateCounter: vi.fn(),
    updateLastUsed: vi.fn(),
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

function makeDeps(passkey: PasskeyRepository = mockPasskeyRepo()): PasskeyHandlerDeps {
  return {
    webauthn: {
      rpId: 'app.test',
      rpName: 'Test',
      origin: 'https://app.test',
      challengeStore: createInMemoryChallengeStore()
    },
    authConfig: { appUrl: 'https://app.test', jwt: { secret: 's' } },
    repos: { passkey, user: createMockUserRepository() }
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

async function authedEvent(deps: PasskeyHandlerDeps, body: unknown): Promise<RequestEvent> {
  const jar = makeCookieJar();
  vi.mocked(deps.repos.user.findById).mockResolvedValue(SESSION_USER);
  await setSessionCookie(
    jar.cookies,
    {
      userId: SESSION_USER.id,
      email: SESSION_USER.email,
      role: SESSION_USER.role,
      tokenVersion: SESSION_USER.tokenVersion
    },
    deps.authConfig.jwt
  );
  return event(body, jar);
}

beforeEach(() => {
  mockedVerify.mockReset();
});

describe('createPasskeyRegistrationOptionsHandler', () => {
  it('returns 401 when there is no authenticated user', async () => {
    const res = await createPasskeyRegistrationOptionsHandler(makeDeps()).POST(event({}));
    expect(res.status).toBe(401);
  });

  it('returns options scoped to the user and excludes already-registered credentials', async () => {
    const passkey = mockPasskeyRepo({
      findByUserId: vi
        .fn()
        .mockResolvedValue([mkPasskey({ credentialId: 'c1' }), mkPasskey({ credentialId: 'c2' })])
    });
    const deps = makeDeps(passkey);

    const res = await createPasskeyRegistrationOptionsHandler(deps).POST(
      await authedEvent(deps, {})
    );
    expect(res.status).toBe(200);
    const { options } = await res.json();

    // The ceremony is scoped to the session user (id/email/displayName)…
    expect(options.user.name).toBe('user@test.com');
    expect(options.user.displayName).toBe('Test User');
    // …and the user's existing keys are excluded so they can't double-register.
    expect(options.excludeCredentials.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2']);
    expect(passkey.findByUserId).toHaveBeenCalledWith('user-1');
  });
});

describe('createPasskeyRegistrationVerifyHandler', () => {
  it('returns 401 when there is no authenticated user', async () => {
    const res = await createPasskeyRegistrationVerifyHandler(makeDeps()).POST(
      event({ credential: {} })
    );
    expect(res.status).toBe(401);
    // The auth gate short-circuits before any verification runs.
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('returns 400 when the credential is missing from the body', async () => {
    const deps = makeDeps();
    const res = await createPasskeyRegistrationVerifyHandler(deps).POST(
      await authedEvent(deps, {})
    );
    expect(res.status).toBe(400);
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('maps a WebAuthnError to a 400 (bad attestation is a client error, not a 500)', async () => {
    mockedVerify.mockRejectedValue(new WebAuthnError('Invalid attestation'));
    const deps = makeDeps();
    const res = await createPasskeyRegistrationVerifyHandler(deps).POST(
      await authedEvent(deps, { credential: { id: 'x' } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid attestation');
  });

  it('re-throws a non-WebAuthn error so the framework surfaces it as a 500', async () => {
    mockedVerify.mockRejectedValue(new Error('database is down'));
    const deps = makeDeps();
    await expect(
      createPasskeyRegistrationVerifyHandler(deps).POST(
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

    const res = await createPasskeyRegistrationVerifyHandler(deps).POST(
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
