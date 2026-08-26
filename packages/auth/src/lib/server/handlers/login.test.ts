import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LockoutConfig } from '../../types.js';
import {
  createInMemoryRefreshTokenRepository,
  createInMemoryRepos
} from '../adapters/in-memory.js';
import type { UserRepository } from '../adapters/types.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword } from '../password.js';
import { failedLoginLock, lockoutFor } from '../security-defaults.js';
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

    vi.useFakeTimers({ now: new Date('2026-08-26T10:00:00Z') });
    try {
      const response = await handler.POST(event as unknown as RequestEvent);
      expect(response.status).toBe(401);
      // The hand-built deps here configured no brute-force policy at all, and
      // the lockout accessor defaults it — the same value createAuthDeps would
      // inject — already resolved into the lock the adapter stores: 5 attempts,
      // and an instant 15 minutes out.
      expect(deps.repos.user.recordFailedLogin).toHaveBeenCalledWith('user-1', {
        maxAttempts: 5,
        lockedUntil: new Date('2026-08-26T10:15:00Z')
      });
    } finally {
      vi.useRealTimers();
    }
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

  it('records a failed attempt with the configured lock when the password is wrong', async () => {
    const pw = await hashPassword('correct');
    const recordFailedLogin = vi.fn();
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw })),
      recordFailedLogin
    });
    // Off the defaults on both fields, so the values the adapter receives are
    // provably the configured ones: threshold as-is, duration turned into the
    // instant the account stays locked until.
    deps.config.lockout = { maxAttempts: 3, durationMinutes: 20 };
    const handler = createLoginHandler(deps);

    vi.useFakeTimers({ now: new Date('2026-08-26T10:00:00Z') });
    try {
      const res = await handler.POST(
        mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
      );
      expect(res.status).toBe(401);
      expect(recordFailedLogin).toHaveBeenCalledWith('user-1', {
        maxAttempts: 3,
        lockedUntil: new Date('2026-08-26T10:20:00Z')
      });
    } finally {
      vi.useRealTimers();
    }
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

// #288: `failedLoginAttempts` falls on a successful sign-in and on nothing else,
// so a count that never decayed turned `maxAttempts` typos spread over any
// timespan at all into a lockout. The handler resets a count whose
// `lastFailedAt` is older than `lockout.decayMinutes` before recording into it.
describe('createLoginHandler — failed-attempt decay', () => {
  const lockout = { maxAttempts: 5, durationMinutes: 15 };
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

  /** A wrong-password login against a repo reporting `attempts`. */
  async function loginWith(
    attempts: { count: number; lockedUntil: Date | null; lastFailedAt: Date | null },
    lockoutConfig: typeof lockout & { decayMinutes?: number } = lockout
  ) {
    const pw = await hashPassword('correct');
    const resetFailedLogins = vi.fn();
    const recordFailedLogin = vi.fn();
    const deps = createMockDeps({
      findByEmail: vi.fn().mockResolvedValue(createMockUser({ passwordHash: pw })),
      getFailedLoginAttempts: vi.fn().mockResolvedValue(attempts),
      recordFailedLogin,
      resetFailedLogins
    });
    deps.config.lockout = lockoutConfig;
    const res = await createLoginHandler(deps).POST(
      mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
    );
    return { res, resetFailedLogins, recordFailedLogin };
  }

  it('clears a count whose last failure predates the window, before recording the next one', async () => {
    const { res, resetFailedLogins, recordFailedLogin } = await loginWith({
      count: 4,
      lockedUntil: null,
      lastFailedAt: minutesAgo(61)
    });

    expect(res.status).toBe(401);
    expect(resetFailedLogins).toHaveBeenCalledWith('user-1');
    // Order matters: reset first, then count this attempt as the new first one.
    expect(resetFailedLogins.mock.invocationCallOrder[0]).toBeLessThan(
      recordFailedLogin.mock.invocationCallOrder[0]
    );
  });

  it('leaves a count whose last failure is inside the window alone', async () => {
    const { resetFailedLogins, recordFailedLogin } = await loginWith({
      count: 4,
      lockedUntil: null,
      lastFailedAt: minutesAgo(59)
    });

    expect(resetFailedLogins).not.toHaveBeenCalled();
    expect(recordFailedLogin).toHaveBeenCalledOnce();
  });

  it('honours a configured decayMinutes in both directions', async () => {
    const short = { ...lockout, decayMinutes: 5 };
    expect(
      (await loginWith({ count: 4, lockedUntil: null, lastFailedAt: minutesAgo(6) }, short))
        .resetFailedLogins
    ).toHaveBeenCalledWith('user-1');
    expect(
      (await loginWith({ count: 4, lockedUntil: null, lastFailedAt: minutesAgo(4) }, short))
        .resetFailedLogins
    ).not.toHaveBeenCalled();
    // Control on the default: six minutes is far inside the one-hour default,
    // so the same fixture decays only because decayMinutes was set.
    expect(
      (await loginWith({ count: 4, lockedUntil: null, lastFailedAt: minutesAgo(6) }))
        .resetFailedLogins
    ).not.toHaveBeenCalled();
  });

  it('does not decay when the adapter reports no lastFailedAt (fail-safe, not fail-open)', async () => {
    // `null` — an adapter that does not keep the column.
    expect(
      (await loginWith({ count: 4, lockedUntil: null, lastFailedAt: null })).resetFailedLogins
    ).not.toHaveBeenCalled();
    // `undefined` — one that omits the key entirely. Same answer: the count
    // keeps its pre-decay meaning rather than being discarded.
    expect(
      (
        await loginWith({ count: 4, lockedUntil: null } as unknown as {
          count: number;
          lockedUntil: Date | null;
          lastFailedAt: Date | null;
        })
      ).resetFailedLogins
    ).not.toHaveBeenCalled();
  });

  it('never resets while a lock is live — resetFailedLogins would end it early', async () => {
    // decayMinutes below durationMinutes is the reachable case: the count is
    // stale by the decay window while the lock it produced still stands.
    const { res, resetFailedLogins, recordFailedLogin } = await loginWith(
      { count: 5, lockedUntil: new Date(Date.now() + 10 * 60_000), lastFailedAt: minutesAgo(6) },
      { ...lockout, decayMinutes: 5 }
    );

    expect(res.status).toBe(423);
    expect(resetFailedLogins).not.toHaveBeenCalled();
    expect(recordFailedLogin).not.toHaveBeenCalled();
  });

  it('does not write when there is nothing to decay (count 0)', async () => {
    const { resetFailedLogins } = await loginWith({
      count: 0,
      lockedUntil: null,
      lastFailedAt: minutesAgo(61)
    });
    expect(resetFailedLogins).not.toHaveBeenCalled();
  });
});

// The property a user feels, driven through the real in-memory adapter rather
// than a mocked counter: four old typos plus one today must not lock, five
// typos in one sitting must.
describe('createLoginHandler — decay against the in-memory adapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A low work factor keeps the multi-attempt simulations below in the
  // millisecond range. Nothing here asserts anything about hashing cost, and
  // verification reads the iteration count from the stored hash.
  const FAST_PASSWORD = { pbkdf2Iterations: 1000 };
  const DEFAULT_POLICY: LockoutConfig = { maxAttempts: 5, durationMinutes: 15 };

  async function seed(lockout: LockoutConfig | null = DEFAULT_POLICY) {
    const user = createInMemoryRepos().user;
    await user.create({
      email: 'test@test.com',
      name: 'Aya',
      passwordHash: await hashPassword('correct', FAST_PASSWORD),
      role: 'admin'
    });
    const deps = createMockDeps();
    deps.repos.user = user;
    deps.config.password = FAST_PASSWORD;
    deps.config.lockout = lockout;
    // The lockout is under test, not the login limiter — which every deps now
    // carries by default and would answer 429 on the attempt the lock is due.
    deps.config.rateLimit = { login: null };
    const id = (await user.findByEmail('test@test.com'))!.id;
    return { user, deps, id };
  }

  const wrongLogin = (deps: AuthDeps<string>) =>
    createLoginHandler(deps).POST(
      mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
    );

  it('four failures an hour ago plus one now leave the account open', async () => {
    const { user, deps, id } = await seed();
    for (let i = 0; i < 4; i++)
      await user.recordFailedLogin(id, failedLoginLock(lockoutFor(deps.config)!));

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 60_000);
    expect((await wrongLogin(deps)).status).toBe(401);

    const after = await user.getFailedLoginAttempts(id);
    expect(after.count).toBe(1);
    expect(after.lockedUntil).toBeNull();
  });

  it('the same five failures in one sitting still lock the account', async () => {
    const { user, deps, id } = await seed();
    for (let i = 0; i < 4; i++)
      await user.recordFailedLogin(id, failedLoginLock(lockoutFor(deps.config)!));

    expect((await wrongLogin(deps)).status).toBe(401);

    const after = await user.getFailedLoginAttempts(id);
    expect(after.count).toBe(5);
    expect(after.lockedUntil).not.toBeNull();
    // …and the next request is refused before any verify runs.
    expect((await wrongLogin(deps)).status).toBe(423);
  });

  // A decay window of zero reads as "every attempt is old enough", which resets
  // the counter before every increment and switches the lockout off — the exact
  // opposite of what an operator writing `decayMinutes: 0` means. The window is
  // the lockout knob with the largest swing, so it is refused where it is set.
  describe('lockout value validation', () => {
    it.each([
      { label: '0', decayMinutes: 0 },
      { label: '-5', decayMinutes: -5 },
      { label: 'NaN', decayMinutes: Number.NaN },
      { label: 'Infinity', decayMinutes: Number.POSITIVE_INFINITY }
    ])(
      'refuses decayMinutes $label at wiring time rather than at 3am',
      async ({ decayMinutes }) => {
        const { deps } = await seed({ ...DEFAULT_POLICY, decayMinutes });
        expect(() => createLoginHandler(deps)).toThrow(
          /decayMinutes must be a positive finite number/
        );
      }
    );

    // Same class, other two fields — measured through the handler before the
    // guard: `durationMinutes` 0 / -5 / NaN and `maxAttempts` NaN each gave 30
    // wrong passwords 30 × 401 and never a 423 (a lock already expired, an
    // `Invalid Date`, a threshold never reached).
    it.each([
      { label: 'durationMinutes 0', lockout: { durationMinutes: 0 } },
      { label: 'durationMinutes -5', lockout: { durationMinutes: -5 } },
      { label: 'durationMinutes NaN', lockout: { durationMinutes: Number.NaN } },
      { label: 'durationMinutes Infinity', lockout: { durationMinutes: Number.POSITIVE_INFINITY } },
      { label: 'maxAttempts NaN', lockout: { maxAttempts: Number.NaN } },
      { label: 'maxAttempts 0', lockout: { maxAttempts: 0 } },
      { label: 'maxAttempts 2.5', lockout: { maxAttempts: 2.5 } }
    ])('refuses $label at wiring time', async ({ lockout }) => {
      const { deps } = await seed(lockout);
      expect(() => createLoginHandler(deps)).toThrow(
        /lockout\.(durationMinutes must be a positive finite number|maxAttempts must be a positive integer)/
      );
    });

    // The guard must not be stricter than the policy: an off-default pair still
    // wires, and locks exactly at its own threshold.
    it('still constructs { maxAttempts: 3, durationMinutes: 20 } and locks on the fourth attempt', async () => {
      const { user, deps, id } = await seed({ maxAttempts: 3, durationMinutes: 20 });
      const handler = createLoginHandler(deps);
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        statuses.push(
          (
            await handler.POST(
              mockRequestEvent({
                email: 'test@test.com',
                password: 'wrong'
              }) as unknown as RequestEvent
            )
          ).status
        );
      }
      expect(statuses).toEqual([401, 401, 401, 423]);
      expect((await user.getFailedLoginAttempts(id)).count).toBe(3);
    });

    // The control on the other side of that guard: every window it does admit
    // still locks the account on the fifth consecutive failure, and the counter
    // stops there rather than running on.
    it.each([
      { label: 'an unset window (the 60-minute default)', decayMinutes: undefined },
      { label: 'a 60-minute window', decayMinutes: 60 },
      { label: 'a 15-minute window', decayMinutes: 15 },
      { label: 'a 1-minute window', decayMinutes: 1 }
    ])('$label still locks on the fifth consecutive failure', async ({ decayMinutes }) => {
      const { user, deps, id } = await seed({ ...DEFAULT_POLICY, decayMinutes });
      const handler = createLoginHandler(deps);
      let lockedAtAttempt: number | null = null;
      for (let i = 1; i <= 30; i++) {
        const res = await handler.POST(
          mockRequestEvent({
            email: 'test@test.com',
            password: 'wrong'
          }) as unknown as RequestEvent
        );
        if (res.status === 423 && lockedAtAttempt === null) lockedAtAttempt = i;
      }
      expect(lockedAtAttempt).toBe(6);
      expect((await user.getFailedLoginAttempts(id)).count).toBe(5);
    });
  });

  // Where the decay sits relative to the PBKDF2 verify decides whether a burst
  // against a stale counter is counted or swallowed: each request's reset must
  // land before its own increment. With the reset in the failure branch instead,
  // every request wipes what the previous ones recorded — measured as 1 counted
  // failure out of 12, and an account left unlocked.
  it('counts every failure of a 12-fold burst against a stale counter', async () => {
    const { user, deps, id } = await seed();
    for (let i = 0; i < 4; i++)
      await user.recordFailedLogin(id, failedLoginLock(lockoutFor(deps.config)!));

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 60_000);
    const handler = createLoginHandler(deps);
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        handler.POST(
          mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
        )
      )
    );

    // The burst itself is not what the lockout bounds — it bounds what comes
    // after — so every one of the twelve gets its password checked.
    expect(responses.every((r) => r.status === 401)).toBe(true);
    const after = await user.getFailedLoginAttempts(id);
    expect(after.count).toBe(12);
    expect(after.lockedUntil).not.toBeNull();
  });
});

// The window is also the budget an attacker gets for waiting, and that number is
// the reason the default is not `durationMinutes`. Simulated against the real
// handler + adapter on a 12-hour clock: a strategy is a loop, not a formula, and
// only attempts that reached the password check (401) count as guesses.
describe('createLoginHandler — sustained guess rate per decay window', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const FAST_PASSWORD = { pbkdf2Iterations: 1000 };
  const HOURS = 12;

  async function guessesPerHour(
    decayMinutes: number,
    strategy: 'relentless' | { waitMinutes: number }
  ) {
    const user = createInMemoryRepos().user;
    await user.create({
      email: 'test@test.com',
      name: 'Aya',
      passwordHash: await hashPassword('correct', FAST_PASSWORD),
      role: 'admin'
    });
    const deps = createMockDeps();
    deps.repos.user = user;
    deps.config.password = FAST_PASSWORD;
    deps.config.lockout = { maxAttempts: 5, durationMinutes: 15, decayMinutes };
    // The lockout is under test, not the login limiter — which every deps now
    // carries by default and would answer 429 on the attempt the lock is due.
    deps.config.rateLimit = { login: null };
    const handler = createLoginHandler(deps);

    vi.useFakeTimers();
    const end = Date.now() + HOURS * 3_600_000;
    let guesses = 0;
    const attempt = async () => {
      const res = await handler.POST(
        mockRequestEvent({ email: 'test@test.com', password: 'wrong' }) as unknown as RequestEvent
      );
      if (res.status !== 401) return false; // 423: refused before the verify
      guesses++;
      return true;
    };

    if (strategy === 'relentless') {
      while (Date.now() < end) {
        await attempt();
        vi.setSystemTime(Date.now() + 60_000);
      }
    } else {
      while (Date.now() < end) {
        vi.setSystemTime(Date.now() + strategy.waitMinutes * 60_000);
        let burst = 0;
        while (await attempt()) {
          // A burst that is never refused would mean the lockout stopped
          // working; fail loudly instead of looping forever.
          if (++burst > 5 * HOURS) throw new Error('the lockout never refused a burst');
        }
      }
    }
    vi.useRealTimers();
    return guesses / HOURS;
  }

  // A year-long window is "no decay" in everything but name: it is the pre-decay
  // behaviour, and the baseline the other two are measured against.
  const NO_DECAY = 60 * 24 * 365;

  it('without decay, the counter stuck at the threshold allows 4.33 guesses/h', async () => {
    expect(await guessesPerHour(NO_DECAY, 'relentless')).toBeCloseTo(4.333, 2);
    // Waiting buys nothing when nothing expires — it only wastes the attacker's
    // clock, which is why the pre-decay ceiling is the relentless number.
    expect(await guessesPerHour(NO_DECAY, { waitMinutes: 60 })).toBeCloseTo(1.333, 2);
  });

  it('a 60-minute window raises the ceiling to 5 guesses/h', async () => {
    expect(await guessesPerHour(60, { waitMinutes: 60 })).toBeCloseTo(5, 5);
    // Not by making the relentless strategy better — that one never waits long
    // enough to decay anything.
    expect(await guessesPerHour(60, 'relentless')).toBeCloseTo(4.333, 2);
  });

  it('a window equal to durationMinutes quadruples it to 20 guesses/h', async () => {
    expect(await guessesPerHour(15, { waitMinutes: 15 })).toBeCloseTo(20, 5);
  });
});
