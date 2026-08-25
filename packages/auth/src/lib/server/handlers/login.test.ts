import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryRefreshTokenRepository } from '../adapters/in-memory.js';
import type { UserRepository } from '../adapters/types.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword } from '../password.js';
import {
  createMockInvitationRepository,
  createMockUser,
  createMockUserRepository
} from '../test-utils.js';
import { createLoginHandler } from './login.js';

function createMockDeps<R extends string>(
  userOverrides: Partial<UserRepository<R>> = {}
): AuthDeps<R> {
  return {
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '1h' }
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    repos: {
      user: createMockUserRepository<R>(userOverrides),
      invitation: createMockInvitationRepository()
    },
    email: { send: vi.fn() }
  };
}

function mockRequestEvent(body: Record<string, unknown>) {
  const cookieStore = new Map<string, string>();
  return {
    request: new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    cookies: {
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string) => cookieStore.set(name, value),
      delete: (name: string) => cookieStore.delete(name),
      getAll: () => [],
      serialize: () => ''
    },
    _cookieStore: cookieStore,
    getClientAddress: () => '127.0.0.1',
    url: new URL('http://localhost:3000/api/auth/login'),
    params: {},
    locals: {},
    platform: undefined,
    route: { id: '/api/auth/login' },
    isDataRequest: false,
    isSubRequest: false
  };
}

describe('createLoginHandler', () => {
  it('should return 400 if email or password missing', async () => {
    const deps = createMockDeps();
    const handler = createLoginHandler(deps);
    const event = mockRequestEvent({ email: '' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(400);
  });

  it('should return 400 (not 500) for a malformed JSON body', async () => {
    const deps = createMockDeps();
    const handler = createLoginHandler(deps);
    // A non-JSON body would make request.json() throw a SyntaxError; readJsonBody
    // turns that into a clean 400 via the field validators rather than a 500.
    const event = {
      request: new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' }
      }),
      getClientAddress: () => '127.0.0.1',
      cookies: { get: () => undefined, set: () => {}, delete: () => {} },
      locals: {}
    };

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(400);
  });

  it('should return 401 if user not found', async () => {
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(null)
    });
    const handler = createLoginHandler(deps);
    const event = mockRequestEvent({ email: 'nope@test.com', password: 'pass' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(401);
    // Machine code + English prose both present (Issue #18).
    const body = await response.json();
    expect(body.error).toBe('Invalid email or password.');
    expect(body.code).toBe('invalid_credentials');
  });

  it('should return 401 if password is wrong', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw }))
    });
    const handler = createLoginHandler(deps);
    const event = mockRequestEvent({ email: 'test@test.com', password: 'wrong' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(401);
    expect(deps.repos.user.recordFailedLogin).toHaveBeenCalledWith('user-1', undefined);
  });

  it('should login successfully with correct credentials', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw }))
    });
    const handler = createLoginHandler(deps);
    const event = mockRequestEvent({ email: 'test@test.com', password: 'correct' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.user.id).toBe('user-1');
    expect(data.user.email).toBe('test@test.com');
    expect(data.user).not.toHaveProperty('passwordHash');
    expect(deps.repos.user.resetFailedLogins).toHaveBeenCalledWith('user-1');
  });

  it('keeps a completed login a 200 when the onLoginSuccess hook throws', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw }))
    });
    deps.config.hooks = {
      onLoginSuccess: vi.fn().mockRejectedValue(new Error('consumer hook exploded'))
    };
    const event = mockRequestEvent({ email: 'test@test.com', password: 'correct' });

    const res = await createLoginHandler(deps).POST(event as unknown as RequestEvent);

    // The session cookie is already set and the failure counter already reset.
    expect(res.status).toBe(200);
    expect(event._cookieStore.get('session')).toBeTruthy();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('onLoginSuccess'),
      expect.any(Error)
    );
  });

  it('still answers 401 for an unknown email when the onLoginFailed hook throws', async () => {
    const deps = createMockDeps({ findByEmail: vi.fn().mockResolvedValue(null) });
    deps.config.hooks = {
      onLoginFailed: vi.fn().mockRejectedValue(new Error('audit sink down'))
    };
    const event = mockRequestEvent({ email: 'nobody@test.com', password: 'whatever' });

    const res = await createLoginHandler(deps).POST(event as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('invalid_credentials');
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('onLoginFailed'),
      expect.any(Error)
    );
  });

  it('a throwing onLoginFailed hook neither hides the rejection nor stalls the lockout', async () => {
    const pw = await hashPassword('correct');
    let failed = 0;
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw })),
      recordFailedLogin: vi.fn(async () => {
        failed += 1;
      }),
      getFailedLoginAttempts: vi.fn(async () => ({
        count: failed,
        lockedUntil: failed >= 3 ? new Date(Date.now() + 60_000) : null,
        lastFailedAt: null
      }))
    });
    deps.config.lockout = { maxAttempts: 3, durationMinutes: 15 };
    deps.config.hooks = {
      onLoginFailed: vi.fn().mockRejectedValue(new Error('audit sink down'))
    };
    const handler = createLoginHandler(deps);

    // recordFailedLogin runs before the hook, so every attempt counts whether
    // or not the audit sink is up. The user must still be told *why* each one
    // was rejected — a 500 reads as a server glitch worth retrying, and the
    // retries walk straight into the lock.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await handler.POST(
        mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
      );
      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe('invalid_credentials');
    }
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('onLoginFailed'),
      expect.any(Error)
    );

    const locked = await handler.POST(
      mockRequestEvent({ email: 'test@test.com', password: 'correct' }) as unknown as RequestEvent
    );
    expect(locked.status).toBe(423);
  });

  it('gates on 2FA: sets a pending cookie, no session, returns twoFactorRequired', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi
        .fn()
        .mockResolvedValue(createMockUser({ passwordHash: pw, totpEnabled: true }))
    });
    deps.config.twoFactor = { encryptionKey: 'test-key' };
    const event = mockRequestEvent({ email: 'test@test.com', password: 'correct' });

    const res = await createLoginHandler(deps).POST(event as unknown as RequestEvent);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ twoFactorRequired: true });
    // No session yet — only the short-lived pending-2FA cookie.
    expect(event._cookieStore.get('session')).toBeUndefined();
    expect([...event._cookieStore.keys()].some((k) => k.includes('urbicon_2fa'))).toBe(true);
    // The password step still succeeded, so the failed-login counter is reset.
    expect(deps.repos.user.resetFailedLogins).toHaveBeenCalledWith('user-1');
  });

  it('gates on 2FA even when config.twoFactor is absent (fail-closed, no bypass)', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi
        .fn()
        .mockResolvedValue(createMockUser({ passwordHash: pw, totpEnabled: true }))
    });
    // deps.config.twoFactor intentionally NOT set — a misconfigured consumer
    // must never let an enrolled user in on the password step.
    const event = mockRequestEvent({ email: 'test@test.com', password: 'correct' });

    const res = await createLoginHandler(deps).POST(event as unknown as RequestEvent);
    expect(await res.json()).toEqual({ twoFactorRequired: true });
    expect(event._cookieStore.get('session')).toBeUndefined();
  });

  it('issues a refresh cookie when refresh-token rotation is configured', async () => {
    const pw = await hashPassword('correct');
    const refreshRepo = createInMemoryRefreshTokenRepository();
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw }))
    });
    deps.config.refreshToken = { accessTokenTtl: '15m', refreshTokenTtl: '30d' };
    deps.repos.refreshToken = refreshRepo;

    const handler = createLoginHandler(deps);
    const event = mockRequestEvent({ email: 'test@test.com', password: 'correct' });

    const response = await handler.POST(event as unknown as RequestEvent);
    expect(response.status).toBe(200);
    expect(
      (event as { _cookieStore: Map<string, string> })._cookieStore.get('session')
    ).toBeDefined();
    expect(
      (event as { _cookieStore: Map<string, string> })._cookieStore.get('refresh')
    ).toBeDefined();
  });

  it('tags the issued refresh token with the request user-agent (ip off by default)', async () => {
    const pw = await hashPassword('correct');
    const refreshRepo = createInMemoryRefreshTokenRepository();
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u-ua', passwordHash: pw }))
    });
    deps.config.refreshToken = {};
    deps.repos.refreshToken = refreshRepo;

    const cookieStore = new Map<string, string>();
    const event = {
      request: new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'correct' }),
        headers: { 'Content-Type': 'application/json', 'user-agent': 'Cluster-C-UA/1.0' }
      }),
      cookies: {
        get: (n: string) => cookieStore.get(n),
        set: (n: string, v: string) => cookieStore.set(n, v),
        delete: (n: string) => cookieStore.delete(n),
        getAll: () => [],
        serialize: () => ''
      },
      getClientAddress: () => '127.0.0.1',
      url: new URL('http://localhost/api/auth/login'),
      locals: {}
    };

    const res = await createLoginHandler(deps).POST(event as unknown as RequestEvent);
    expect(res.status).toBe(200);
    const active = await refreshRepo.listActiveByUser('u-ua');
    expect(active).toHaveLength(1);
    expect(active[0].userAgent).toBe('Cluster-C-UA/1.0');
    // storeIp defaults to false, so no IP is persisted.
    expect(active[0].ip).toBeNull();
  });

  it('does not issue a refresh cookie without refresh-token config', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw }))
    });
    const handler = createLoginHandler(deps);
    const event = mockRequestEvent({ email: 'test@test.com', password: 'correct' });

    await handler.POST(event as unknown as RequestEvent);
    expect(
      (event as { _cookieStore: Map<string, string> })._cookieStore.get('refresh')
    ).toBeUndefined();
  });

  // Cluster J: the rate-limit and lockout branches were previously untested
  // because the mock always returned { count: 0, lockedUntil: null }.
  it('returns 429 with a Retry-After header once the rate limit is exceeded', async () => {
    const pw = await hashPassword('correct');
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw }))
    });
    deps.config.rateLimit = { login: { windowMs: 60_000, max: 2 } };
    const handler = createLoginHandler(deps);
    const body = { email: 'test@test.com', password: 'correct' };

    expect((await handler.POST(mockRequestEvent(body) as unknown as RequestEvent)).status).toBe(
      200
    );
    expect((await handler.POST(mockRequestEvent(body) as unknown as RequestEvent)).status).toBe(
      200
    );
    const limited = await handler.POST(mockRequestEvent(body) as unknown as RequestEvent);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('returns 423 and skips password verification when the account is locked', async () => {
    const pw = await hashPassword('correct');
    const recordFailedLogin = vi.fn();
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw })),
      getFailedLoginAttempts: vi.fn().mockResolvedValue({
        count: 5,
        lockedUntil: new Date(Date.now() + 60_000),
        lastFailedAt: new Date()
      }),
      recordFailedLogin
    });
    deps.config.lockout = { maxAttempts: 5, durationMinutes: 15 };
    const handler = createLoginHandler(deps);

    // Even with the WRONG password, a locked account is refused with 423 before
    // the PBKDF2 verify runs (so it doesn't count as another failed attempt).
    const res = await handler.POST(
      mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
    );
    expect(res.status).toBe(423);
    expect(recordFailedLogin).not.toHaveBeenCalled();
  });

  it('records a failed attempt with the lockout config when the password is wrong', async () => {
    const pw = await hashPassword('correct');
    const recordFailedLogin = vi.fn();
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw })),
      recordFailedLogin
    });
    deps.config.lockout = { maxAttempts: 5, durationMinutes: 15 };
    const handler = createLoginHandler(deps);

    const res = await handler.POST(
      mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
    );
    expect(res.status).toBe(401);
    expect(recordFailedLogin).toHaveBeenCalledWith('user-1', {
      maxAttempts: 5,
      durationMinutes: 15
    });
  });

  // Cluster G.2 (Finding M6): a "user not found" reject must still pay the
  // PBKDF2 cost, otherwise an attacker distinguishes registered emails by
  // response time. We assert the property deterministically — a real key
  // derivation runs — rather than measuring wall-clock time (flaky).
  it('runs a real PBKDF2 verify even when the account does not exist (timing equalization)', async () => {
    const deps = createMockDeps({ findByEmail: vi.fn().mockResolvedValue(null) });
    const handler = createLoginHandler(deps);
    const deriveSpy = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      const first = await handler.POST(
        mockRequestEvent({ email: 'ghost@test.com', password: 'x' }) as unknown as RequestEvent
      );
      expect(first.status).toBe(401);
      // First miss: one derivation to BUILD the lazy dummy hash + one to VERIFY
      // the submitted password against it. The verify (the 2nd derivation) is
      // what proves the equalization actually runs — not just the hash build.
      expect(deriveSpy).toHaveBeenCalledTimes(2);

      const second = await handler.POST(
        mockRequestEvent({ email: 'ghost2@test.com', password: 'x' }) as unknown as RequestEvent
      );
      expect(second.status).toBe(401);
      // Second miss: the dummy hash is memoized (no rebuild), but the verify
      // still runs → exactly one more derivation.
      expect(deriveSpy).toHaveBeenCalledTimes(3);
    } finally {
      deriveSpy.mockRestore();
    }
  });
});
