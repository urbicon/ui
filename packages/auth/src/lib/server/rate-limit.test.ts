import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../types.js';
import { createLoginHandler } from './handlers/login.js';
import {
  createInMemoryRateLimitStore,
  createRateLimiter,
  enforceRateLimit,
  makeRateLimiter,
  type RateLimitEntry,
  type RateLimiter,
  type RateLimitStore,
  sharedLimiter
} from './rate-limit.js';
import { resetRateLimiters } from './secret-registry.js';
import { createMockAuthDeps, mockPostEvent } from './test-utils.js';

describe('makeRateLimiter', () => {
  it('returns null when no config is provided', () => {
    expect(makeRateLimiter(undefined)).toBeNull();
  });
  it('returns a limiter when a config is provided', () => {
    expect(makeRateLimiter({ windowMs: 1000, max: 5 })).not.toBeNull();
  });
});

describe('enforceRateLimit', () => {
  it('returns null (proceed) when the limiter is null', async () => {
    expect(await enforceRateLimit(null, 'ip')).toBeNull();
  });

  it('returns null while under the limit', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    expect(await enforceRateLimit(limiter, 'ip')).toBeNull();
    expect(await enforceRateLimit(limiter, 'ip')).toBeNull();
  });

  it('returns a 429 with Retry-After once exceeded', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    await enforceRateLimit(limiter, 'ip');
    const res = await enforceRateLimit(limiter, 'ip', 'Custom limit message.');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(Number(res!.headers.get('Retry-After'))).toBeGreaterThan(0);
    const body = await res!.json();
    expect(body.error).toBe('Custom limit message.');
    expect(body.code, 'the shared 429 helper carries the machine code').toBe('rate_limited');
  });

  it('keys separately per identifier', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    await enforceRateLimit(limiter, 'ip-a');
    // A different IP has its own budget.
    expect(await enforceRateLimit(limiter, 'ip-b')).toBeNull();
  });
});

describe('createRateLimiter (default in-memory store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limit', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect((await limiter.check('user-1')).allowed).toBe(true);
    expect((await limiter.check('user-1')).allowed).toBe(true);
    expect((await limiter.check('user-1')).allowed).toBe(true);
  });

  it('blocks requests exceeding limit', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    await limiter.check('user-1');
    await limiter.check('user-1');
    const result = await limiter.check('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks remaining count', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect((await limiter.check('user-1')).remaining).toBe(2);
    expect((await limiter.check('user-1')).remaining).toBe(1);
    expect((await limiter.check('user-1')).remaining).toBe(0);
  });

  it('resets after window expires', async () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1 });
    await limiter.check('user-1');
    expect((await limiter.check('user-1')).allowed).toBe(false);

    vi.advanceTimersByTime(10_001);
    expect((await limiter.check('user-1')).allowed).toBe(true);
  });

  it('tracks different identifiers independently', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect((await limiter.check('user-1')).allowed).toBe(true);
    expect((await limiter.check('user-2')).allowed).toBe(true);
    expect((await limiter.check('user-1')).allowed).toBe(false);
    expect((await limiter.check('user-2')).allowed).toBe(false);
  });

  it('refund hands back one slot, and never more than were taken', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    await limiter.check('k');
    await limiter.check('k');
    expect((await limiter.check('k')).allowed).toBe(false);
    // Count is 3 (a refused check counts too). One back → 2, and the check
    // that follows makes it 3 again: still over.
    await limiter.refund('k');
    expect((await limiter.check('k')).allowed).toBe(false);
    // Two back → 1; the next check is the second of the window and fits, the
    // one after it does not.
    await limiter.refund('k', 2);
    expect((await limiter.check('k')).allowed).toBe(true);
    expect((await limiter.check('k')).allowed).toBe(false);
  });

  it('refund clamps at zero and is a no-op for an unknown or expired key', async () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
      await limiter.refund('never-seen');
      await limiter.check('k');
      await limiter.refund('k', 5);
      // Clamped at 0, not -4: the next check is the first of the window.
      expect((await limiter.check('k')).allowed).toBe(true);
      expect((await limiter.check('k')).allowed).toBe(false);
      // Past the window a refund has nothing to give back and must not
      // resurrect the old entry.
      vi.advanceTimersByTime(60_001);
      await limiter.refund('k');
      expect((await limiter.check('k')).allowed).toBe(true);
      expect((await limiter.check('k')).allowed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows requests again after manual reset', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    await limiter.check('user-1');
    expect((await limiter.check('user-1')).allowed).toBe(false);

    await limiter.reset('user-1');
    expect((await limiter.check('user-1')).allowed).toBe(true);
  });
});

describe('createInMemoryRateLimitStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('round-trips entries through get/set/delete', async () => {
    const store = createInMemoryRateLimitStore();
    const entry: RateLimitEntry = { count: 1, resetAt: Date.now() + 1000 };

    expect(await store.get('k')).toBeUndefined();
    await store.set('k', entry);
    expect(await store.get('k')).toEqual(entry);

    await store.delete('k');
    expect(await store.get('k')).toBeUndefined();
  });

  it('periodically prunes expired entries', () => {
    const store = createInMemoryRateLimitStore({ cleanupIntervalMs: 1000 });
    // advance clock past the entry's resetAt
    const expired: RateLimitEntry = { count: 1, resetAt: Date.now() + 100 };
    store.set('gone', expired);
    vi.advanceTimersByTime(2000);
    // Pruning runs on the interval; after advancing we expect the key to be gone.
    expect(store.get('gone')).toBeUndefined();
  });
});

describe('createRateLimiter (injected custom store)', () => {
  it('delegates reads and writes to the provided store', async () => {
    const log: string[] = [];
    const map = new Map<string, RateLimitEntry>();
    const store: RateLimitStore = {
      get: (key) => {
        log.push(`get:${key}`);
        return map.get(key);
      },
      set: (key, entry) => {
        log.push(`set:${key}:${entry.count}`);
        map.set(key, entry);
      },
      delete: (key) => {
        log.push(`delete:${key}`);
        map.delete(key);
      }
    };

    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, store });
    await limiter.check('x');
    await limiter.check('x');
    await limiter.refund('x');
    await limiter.reset('x');

    // refund is a read-modify-write on the store's own get/set — no new store
    // method, so a consumer's store implementation needs nothing for it.
    expect(log).toEqual(['get:x', 'set:x:1', 'get:x', 'set:x:2', 'get:x', 'set:x:1', 'delete:x']);
  });

  it('awaits a store that returns Promises', async () => {
    const map = new Map<string, RateLimitEntry>();
    const asyncStore: RateLimitStore = {
      get: async (key) => map.get(key),
      set: async (key, entry) => {
        map.set(key, entry);
      },
      delete: async (key) => {
        map.delete(key);
      }
    };

    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, store: asyncStore });
    const first = await limiter.check('y');
    const second = await limiter.check('y');

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.remaining).toBe(0);
  });

  it('honours the window per entry when reading an existing persisted entry', async () => {
    const map = new Map<string, RateLimitEntry>();
    const store: RateLimitStore = {
      get: (key) => map.get(key),
      set: (key, entry) => void map.set(key, entry),
      delete: (key) => void map.delete(key)
    };

    // Simulate a previous process having persisted state.
    map.set('z', { count: 2, resetAt: Date.now() + 5_000 });

    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, store });
    const res = await limiter.check('z');
    expect(res.allowed).toBe(true); // 3rd hit within the window = last allowed one
    expect(res.remaining).toBe(0);

    const blocked = await limiter.check('z');
    expect(blocked.allowed).toBe(false);
  });
});

describe('sharedLimiter', () => {
  // The registry is process-wide and keyed on the secret, and every config
  // here carries `secret: 's'`. The package's vitest-setup.ts resets it before
  // each test; without that the file would spend one budget across its tests,
  // in file order.
  const config = (rateLimit?: AuthConfig['rateLimit']) =>
    ({ appUrl: 'https://app.test', jwt: { secret: 's' }, rateLimit }) as AuthConfig;
  const withSecret = (secret: string) => ({ ...config(), jwt: { secret } }) as AuthConfig;
  const spend = async (limiter: RateLimiter | null, n: number) => {
    const allowed: boolean[] = [];
    for (let i = 0; i < n; i++) allowed.push((await limiter?.check('ip'))?.allowed ?? true);
    return allowed;
  };

  // Two factories reading one key used to allocate one in-memory Map each, so a
  // configured `max: 3` bought 3 requests at EACH endpoint.
  it('hands the same limiter to every caller of one key on one config', () => {
    const cfg = config({ verifyEmail: { windowMs: 60_000, max: 3 } });
    expect(sharedLimiter(cfg, 'verifyEmail')).toBe(sharedLimiter(cfg, 'verifyEmail'));
  });

  it('spends one budget across two callers of the same key', async () => {
    const cfg = config({ verifyEmail: { windowMs: 60_000, max: 3 } });
    const a = sharedLimiter(cfg, 'verifyEmail');
    const b = sharedLimiter(cfg, 'verifyEmail');
    expect([...(await spend(a, 2)), ...(await spend(b, 2))]).toEqual([true, true, true, false]);
  });

  it('keeps different keys on different counters', () => {
    const cfg = config();
    expect(sharedLimiter(cfg, 'login')).not.toBe(sharedLimiter(cfg, 'register'));
  });

  // The registry keys on the secret, not on the config object. The object
  // `createAuthDeps` returns is new per call, and a consumer calling it per
  // request used to get a fresh, empty counter with every request.
  it('hands the same limiter to every config object built for one secret', () => {
    expect(sharedLimiter(config(), 'login')).toBe(sharedLimiter(config(), 'login'));
  });

  it('spends one budget across config objects built for one secret', async () => {
    const limit = { verifyEmail: { windowMs: 60_000, max: 3 } };
    const a = sharedLimiter(config(limit), 'verifyEmail');
    const b = sharedLimiter(config(limit), 'verifyEmail');
    expect([...(await spend(a, 2)), ...(await spend(b, 2))]).toEqual([true, true, true, false]);
  });

  it('keeps two secrets on two counters', () => {
    expect(sharedLimiter(withSecret('a'), 'login')).not.toBe(
      sharedLimiter(withSecret('b'), 'login')
    );
  });

  // The configured values are part of the key: a bundle that configures a key
  // differently counts on its own, and nothing depends on which bundle read
  // the key first.
  it('a different config for one key gets its own counter under its own values', async () => {
    const first = sharedLimiter(config({ login: { windowMs: 60_000, max: 1 } }), 'login');
    const second = sharedLimiter(config({ login: { windowMs: 60_000, max: 2 } }), 'login');
    expect(second).not.toBe(first);
    expect(await spend(first, 2)).toEqual([true, false]);
    expect(await spend(second, 3)).toEqual([true, true, false]);
  });

  // An opt-out registers nothing under the key, so a bundle that opts out
  // cannot switch off the limit a later bundle configures for that key.
  it('a limit configured after an opt-out bundle read the same key still trips', async () => {
    expect(sharedLimiter(config(null), 'login')).toBeNull();
    const limiter = sharedLimiter(config({ login: { windowMs: 60_000, max: 5 } }), 'login');
    expect(limiter).not.toBeNull();
    expect(await spend(limiter, 6)).toEqual([true, true, true, true, true, false]);
  });

  // A persistent store holds the counters itself and the wrapper around it is
  // stateless, so nothing is registered and no cleanup interval is started.
  it('does not register a limiter that has its own store', async () => {
    const map = new Map<string, RateLimitEntry>();
    const store: RateLimitStore = {
      get: (key) => map.get(key),
      set: (key, entry) => void map.set(key, entry),
      delete: (key) => void map.delete(key)
    };
    vi.useFakeTimers();
    try {
      const a = sharedLimiter(config({ login: { windowMs: 60_000, max: 1, store } }), 'login');
      const b = sharedLimiter(config({ login: { windowMs: 60_000, max: 1, store } }), 'login');
      expect(a).not.toBe(b);
      expect(vi.getTimerCount()).toBe(0);
      // Both wrappers count in the one store.
      expect([...(await spend(a, 1)), ...(await spend(b, 1))]).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  // The in-memory store starts one cleanup `setInterval` per store, so the
  // timer count is the store count; a store is built on the first check.
  it('builds one in-memory store per (secret, key, values) for the process', async () => {
    vi.useFakeTimers();
    try {
      const a = sharedLimiter(config(), 'login');
      const b = sharedLimiter(config(), 'login');
      await a?.check('ip');
      await b?.check('ip');
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // A handler factory captures its limiter once (`const rateLimiter =
  // sharedLimiter(…)`), so the reset has to reach a limiter handed out before
  // it — a test file building its handlers at the top would otherwise reset
  // nothing and never notice.
  it('resetRateLimiters reaches a handler built before the reset', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { login: { windowMs: 60_000, max: 1 } } },
      user: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const login = createLoginHandler(deps);
    const post = async () =>
      (
        await login.POST(
          mockPostEvent({ email: 'a@b.test', password: 'wrong' }) as unknown as RequestEvent
        )
      ).status;
    expect(await post()).toBe(401);
    expect(await post()).toBe(429);
    resetRateLimiters();
    expect(await post()).toBe(401);
  });

  it('applies the secure default for an unconfigured key', async () => {
    const limiter = sharedLimiter(config(), 'resetPassword');
    expect(limiter).not.toBeNull();
    expect((await limiter?.check('ip'))?.remaining).toBe(9); // default max 10
  });

  it('returns null for the explicit rateLimit: null opt-out', () => {
    expect(sharedLimiter(config(null), 'login')).toBeNull();
  });

  // A hand-built AuthDeps never passed assertAuthConfigValid, so this is the
  // first reader of the secret; the wiring error is named here rather than
  // surfacing as a TypeError on `secret.length`.
  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['a non-string', 42]
  ])('refuses a jwt.secret that is %s with the wiring error', (_label, secret) => {
    const cfg = { ...config(), jwt: { secret } } as unknown as AuthConfig;
    expect(() => sharedLimiter(cfg, 'login')).toThrow(
      /\[auth\] jwt\.secret must be a non-empty string/
    );
  });

  it('refuses a config without a jwt block with the same wiring error', () => {
    const cfg = { appUrl: 'https://app.test' } as unknown as AuthConfig;
    expect(() => sharedLimiter(cfg, 'login')).toThrow(/jwt\.secret must be a non-empty string/);
  });
});
