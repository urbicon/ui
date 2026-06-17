import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInMemoryRateLimitStore,
  createRateLimiter,
  enforceRateLimit,
  makeRateLimiter,
  type RateLimitEntry,
  type RateLimitStore
} from './rate-limit.js';

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
    expect((await res!.json()).error).toBe('Custom limit message.');
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
    await limiter.reset('x');

    expect(log).toEqual(['get:x', 'set:x:1', 'get:x', 'set:x:2', 'delete:x']);
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
