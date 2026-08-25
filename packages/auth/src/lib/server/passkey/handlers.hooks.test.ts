import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { PasskeyRepository } from '../adapters/types.js';
import type { AuthDeps } from '../deps.js';
import { createMockAuthDeps, createMockUser } from '../test-utils.js';
import { WebAuthnError } from './errors.js';
import { createPasskeyHandlers } from './handlers.js';
import { verifyAssertion, type WebAuthnConfig } from './webauthn.js';

type TestDeps = AuthDeps & {
  webauthn: WebAuthnConfig;
  repos: AuthDeps['repos'] & { passkey: PasskeyRepository };
};
const passkeyHandlers = (d: TestDeps) => createPasskeyHandlers(d, d.webauthn);

/**
 * R10 audit-seam parity: the passkey login must fire the same
 * onLoginSuccess/onLoginFailed hooks as the password login, or a consumer
 * audit log systematically misses every passkey login. `verifyAssertion` is
 * mocked (partial module mock) so the success path is reachable without a
 * real authenticator — everything else (session establishment, hooks, repo
 * calls) runs for real.
 */

vi.mock('./webauthn.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./webauthn.js')>();
  return { ...actual, verifyAssertion: vi.fn() };
});

function mockPasskeyRepo(): PasskeyRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByCredentialId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateCounter: vi.fn().mockResolvedValue(true),
    delete: vi.fn(),
    rename: vi.fn()
  };
}

function makeDeps(): TestDeps & {
  hooks: { onLoginSuccess: ReturnType<typeof vi.fn>; onLoginFailed: ReturnType<typeof vi.fn> };
} {
  const hooks = { onLoginSuccess: vi.fn(), onLoginFailed: vi.fn() };
  const base = createMockAuthDeps({ config: { jwt: { secret: 's' }, hooks } });
  return {
    ...base,
    repos: { ...base.repos, passkey: mockPasskeyRepo() },
    hooks,
    webauthn: { rpId: 'app.test', rpName: 'Test', origin: 'https://app.test' }
  };
}

function makeCookieJar(withCeremony = true) {
  const store = new Map<string, string>();
  if (withCeremony) store.set('__Host-urbicon_webauthn_auth', 'ceremony-1');
  return {
    store,
    cookies: {
      get: (name: string) => store.get(name),
      set: (name: string, value: string) => void store.set(name, value),
      delete: (name: string) => void store.delete(name),
      getAll: () => [],
      serialize: () => ''
    } as unknown as Cookies
  };
}

function event(body: unknown, jar: ReturnType<typeof makeCookieJar>): RequestEvent {
  return {
    request: new Request('http://localhost/api/auth/passkey/authentication-verify', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    cookies: jar.cookies,
    getClientAddress: () => '1.2.3.4'
  } as unknown as RequestEvent;
}

const credentialBody = {
  credential: {
    id: 'cred-abc',
    rawId: 'cred-abc',
    type: 'public-key',
    response: { clientDataJSON: 'AA', authenticatorData: 'AA', signature: 'AA' }
  }
};

describe('passkey login hooks (R10)', () => {
  it('fires onLoginSuccess with the sanitized user on a successful assertion', async () => {
    const deps = makeDeps();
    const user = createMockUser({ id: 'u-1', email: 'owner@test.dev' });
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue({
      credentialId: 'cred-abc',
      userId: 'u-1',
      publicKey: new Uint8Array(0),
      publicKeyAlg: -7,
      counter: 0,
      transports: [],
      aaguid: 'a',
      name: 'k',
      createdAt: new Date(),
      lastUsedAt: null
    });
    vi.mocked(deps.repos.user.findById).mockResolvedValue(user);
    vi.mocked(verifyAssertion).mockResolvedValue({ credentialId: 'cred-abc', newCounter: 1 });

    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );

    expect(res.status).toBe(200);
    expect(deps.hooks.onLoginSuccess).toHaveBeenCalledTimes(1);
    const auditedUser = deps.hooks.onLoginSuccess.mock.calls[0][0];
    expect(auditedUser.email).toBe('owner@test.dev');
    // Sanitized: no credential material in the audit payload.
    expect(auditedUser.passwordHash).toBeUndefined();
    expect(deps.hooks.onLoginFailed).not.toHaveBeenCalled();
  });

  it("fires onLoginFailed('', 'invalid_assertion') when the assertion is rejected", async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue({
      credentialId: 'cred-abc',
      userId: 'u-1',
      publicKey: new Uint8Array(0),
      publicKeyAlg: -7,
      counter: 0,
      transports: [],
      aaguid: 'a',
      name: 'k',
      createdAt: new Date(),
      lastUsedAt: null
    });
    vi.mocked(verifyAssertion).mockRejectedValue(new WebAuthnError('Signature mismatch'));

    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );

    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'invalid_assertion');
    expect(deps.hooks.onLoginSuccess).not.toHaveBeenCalled();
  });

  it("fires onLoginFailed('', 'unknown_credential') for an unknown credential", async () => {
    const deps = makeDeps();
    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );

    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'unknown_credential');
  });

  it("fires onLoginFailed('', 'counter_regression') when the CAS update loses", async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue({
      credentialId: 'cred-abc',
      userId: 'u-1',
      publicKey: new Uint8Array(0),
      publicKeyAlg: -7,
      counter: 0,
      transports: [],
      aaguid: 'a',
      name: 'k',
      createdAt: new Date(),
      lastUsedAt: null
    });
    vi.mocked(verifyAssertion).mockResolvedValue({ credentialId: 'cred-abc', newCounter: 1 });
    vi.mocked(deps.repos.passkey.updateCounter).mockResolvedValue(false);

    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );

    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'counter_regression');
    // The clone warning is an operator signal: it goes to the log and the audit
    // hook, never onto the wire, where an end user would read it as an
    // accusation they can do nothing about.
    expect((await res.json()).error).not.toMatch(/clon/i);
    expect(vi.mocked(deps.logger.warn).mock.calls.flat().join(' ')).toMatch(
      /possible cloned authenticator/i
    );
  });

  it("fires onLoginFailed('', 'credential_deleted') when the passkey is deleted mid-login (CAS lost + gone on re-query)", async () => {
    const deps = makeDeps();
    const storedCred = {
      credentialId: 'cred-abc',
      userId: 'u-1',
      publicKey: new Uint8Array(0),
      publicKeyAlg: -7,
      counter: 0,
      transports: [],
      aaguid: 'a',
      name: 'k',
      createdAt: new Date(),
      lastUsedAt: null
    };
    // Present on the initial lookup, gone on the post-CAS re-query → a benign
    // delete-race, not a cloned authenticator.
    vi.mocked(deps.repos.passkey.findByCredentialId)
      .mockResolvedValueOnce(storedCred)
      .mockResolvedValueOnce(null);
    vi.mocked(verifyAssertion).mockResolvedValue({ credentialId: 'cred-abc', newCounter: 1 });
    vi.mocked(deps.repos.passkey.updateCounter).mockResolvedValue(false);

    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );

    // Still fail-closed (identical rejection), only the audit reason differs.
    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'credential_deleted');
    expect(deps.hooks.onLoginFailed).not.toHaveBeenCalledWith('', 'counter_regression');
  });

  it("fires onLoginFailed('', 'challenge_missing') without a ceremony cookie", async () => {
    const deps = makeDeps();
    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar(false))
    );

    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'challenge_missing');
  });
});

describe('passkey login hooks — remaining terminal outcomes', () => {
  const storedPasskey = {
    credentialId: 'cred-abc',
    userId: 'u-1',
    publicKey: new Uint8Array(0),
    publicKeyAlg: -7,
    counter: 0,
    transports: [],
    aaguid: 'a',
    name: 'k',
    createdAt: new Date(),
    lastUsedAt: null
  };

  it("fires onLoginFailed('', 'user_handle_mismatch') when the handle names another user", async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue(storedPasskey);
    vi.mocked(verifyAssertion).mockResolvedValue({
      credentialId: 'cred-abc',
      newCounter: 1,
      // base64url(utf8('someone-else')) — not the stored owner u-1.
      userHandle: btoa('someone-else').replace(/=+$/, '')
    });

    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );
    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'user_handle_mismatch');
  });

  it("fires onLoginFailed('', 'user_not_found') when the credential's owner row is gone", async () => {
    const deps = makeDeps();
    vi.mocked(deps.repos.passkey.findByCredentialId).mockResolvedValue(storedPasskey);
    vi.mocked(deps.repos.user.findById).mockResolvedValue(null);
    vi.mocked(verifyAssertion).mockResolvedValue({ credentialId: 'cred-abc', newCounter: 1 });

    const res = await passkeyHandlers(deps).authenticationVerify.POST(
      event(credentialBody, makeCookieJar())
    );
    expect(res.status).toBe(400);
    expect(deps.hooks.onLoginFailed).toHaveBeenCalledWith('', 'user_not_found');
  });
});
