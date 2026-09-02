import type { AuthConfig, RateLimitConfig } from '../types.js';
import { authError } from './handlers/errors.js';
import { type RateLimitKey, rateLimitFor } from './security-defaults.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Storage interface for the rate-limiter. Implementations may be synchronous
 * (default in-memory Map) or asynchronous (Redis, Prisma, Upstash, etc.).
 *
 * Methods are permitted to return plain values or Promises; `createRateLimiter`
 * awaits the result regardless, so an in-memory store stays on the fast path
 * while a remote store stays correct.
 */
export interface RateLimitStore {
  get(key: string): RateLimitEntry | undefined | Promise<RateLimitEntry | undefined>;
  set(key: string, entry: RateLimitEntry): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}

/**
 * Public rate-limiter interface. `check` and `reset` may return synchronously
 * or asynchronously depending on the underlying store — callers should `await`
 * the result either way.
 */
export interface RateLimiter {
  check(identifier: string): RateLimitResult | Promise<RateLimitResult>;
  /**
   * Hand back `amount` slots (default 1) that `check` took in the current
   * window — a success returning exactly what its own request cost. Clamps at
   * zero and does nothing once the window has rolled. On an atomic store that
   * means it can never buy budget that was not taken; on an async store it is
   * a read-modify-write like `check` and shares its interleaving caveat (see
   * `createRateLimiter`).
   */
  refund(identifier: string, amount?: number): void | Promise<void>;
  reset(identifier: string): void | Promise<void>;
}

/**
 * Default in-memory rate-limit store. Uses a Map and periodically prunes
 * expired entries. Intended for single-process deployments; switch to a
 * persistent adapter for multi-instance setups.
 */
export function createInMemoryRateLimitStore(options?: {
  cleanupIntervalMs?: number;
}): RateLimitStore {
  const store = new Map<string, RateLimitEntry>();
  const interval = options?.cleanupIntervalMs ?? 60_000;

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, interval);
  timer.unref?.();

  return {
    get: (key) => store.get(key),
    set: (key, entry) => void store.set(key, entry),
    delete: (key) => void store.delete(key)
  };
}

/**
 * Build a rate-limiter for the given config. Uses `config.store` when
 * provided (e.g. a Prisma- or Redis-backed implementation) and falls back
 * to the in-memory store for the single-process default.
 *
 * **Atomicity caveat:** `check()` and `refund()` are read-modify-writes (`get`
 * → increment / decrement → `set`). With the default single-process in-memory
 * store this is atomic — there is no await between read and write that another
 * request can interleave through. With an **async/remote** store (Redis, Prisma,
 * Upstash) the get and set are two round-trips, so concurrent requests can each
 * read the same count and under-count the limit by the in-flight concurrency —
 * and a `refund` racing a `check` can land a count of 1 where 2 were taken. For
 * a strict limit under multi-instance load, back the store with a server-side
 * atomic increment (e.g. Redis `INCR` + `EXPIRE`) and have `get`/`set` reflect
 * it, rather than relying on this read-modify-write.
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const store = config.store ?? createInMemoryRateLimitStore();

  return {
    async check(identifier: string): Promise<RateLimitResult> {
      const now = Date.now();
      const current = await Promise.resolve(store.get(identifier));
      const entry: RateLimitEntry =
        !current || current.resetAt <= now ? { count: 0, resetAt: now + config.windowMs } : current;

      entry.count++;
      await Promise.resolve(store.set(identifier, entry));

      if (entry.count > config.max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: entry.resetAt - now
        };
      }

      return {
        allowed: true,
        remaining: config.max - entry.count,
        retryAfterMs: 0
      };
    },

    async refund(identifier: string, amount = 1): Promise<void> {
      const now = Date.now();
      const current = await Promise.resolve(store.get(identifier));
      // A rolled window has nothing to give back: `check` discards an entry
      // whose `resetAt` has passed, so the only effect of writing it would be
      // one wasted round-trip to the store.
      if (!current || current.resetAt <= now) return;
      current.count = Math.max(0, current.count - amount);
      await Promise.resolve(store.set(identifier, current));
    },

    async reset(identifier: string): Promise<void> {
      await Promise.resolve(store.delete(identifier));
    }
  };
}

/**
 * Build a rate-limiter from an optional config slice, or `null` when the slice
 * is absent. Lets handlers write `enforceRateLimit(makeRateLimiter(cfg), key)`
 * without repeating the ternary.
 */
export function makeRateLimiter(config: RateLimitConfig | undefined): RateLimiter | null {
  return config ? createRateLimiter(config) : null;
}

// One limiter per (config object, rate-limit key), for the whole process.
//
// Without this, every handler factory building a limiter from the same key gets
// its own `Map` and the consumer's configured budget is multiplied by the number
// of factories reading that key: measured 6 accepted requests across
// verify-email + verify-email-change for a configured `verifyEmail.max` of 3.
// A persistent `config.store` shares server-side regardless; this is what fixes
// the in-memory default.
//
// **The constraint this buys is object identity.** The bucket lives exactly as
// long as the `AuthConfig` object handed in — which is the object `createAuthDeps`
// *returns*, and it returns a new one per call even from the same input literal.
// So the rule is "call createAuthDeps once, at module scope", not "build the
// config literal once": measured, one `createAuthDeps` lets 5 of 20 requests
// through at max 5, while calling it per request lets 20 of 20 through. That
// path also leaks the in-memory store's cleanup `setInterval` per (config, key) —
// unref'd, so it does not hold the process open, but it is a live GC root for as
// long as the config is reachable.
//
// Keyed on the whole `AuthConfig` rather than the `RateLimitConfig` slice because
// the slice can be a shared module-level default object (`RATE_LIMIT_DEFAULTS`),
// which would put unrelated apps — and unrelated tests — on one counter.
const limiterCache = new WeakMap<object, Map<RateLimitKey, RateLimiter | null>>();

/**
 * The rate-limiter for one endpoint key, shared by every handler factory built
 * from the same config object. Handlers use this instead of
 * `makeRateLimiter(config.rateLimit?.key)`: it applies the secure default (see
 * `rateLimitFor`) and it puts two factories reading one key on one counter.
 */
export function sharedLimiter<R extends string>(
  config: AuthConfig<R>,
  key: RateLimitKey
): RateLimiter | null {
  let byKey = limiterCache.get(config);
  if (!byKey) {
    byKey = new Map();
    limiterCache.set(config, byKey);
  }
  if (!byKey.has(key)) byKey.set(key, makeRateLimiter(rateLimitFor(config, key)));
  return byKey.get(key) ?? null;
}

/**
 * Enforce a rate limit at the top of a handler. Returns a ready-to-return 429
 * `Response` (with a `Retry-After` header) when the limit is exceeded, or
 * `null` when the request may proceed (including when `limiter` is `null`,
 * i.e. limiting is disabled). Consolidates the identical 429 block that was
 * duplicated across login/register/forgot-password.
 */
export async function enforceRateLimit(
  limiter: RateLimiter | null,
  key: string,
  message = 'Too many requests. Please try again later.'
): Promise<Response | null> {
  if (!limiter) return null;
  const limit = await limiter.check(key);
  if (limit.allowed) return null;
  return authError('rate_limited', {
    message,
    headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) }
  });
}
