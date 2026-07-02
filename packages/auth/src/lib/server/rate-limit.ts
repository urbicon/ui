import type { RateLimitConfig } from '../types.js';
import { authError } from './handlers/errors.js';

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
 * **Atomicity caveat:** `check()` is a read-modify-write (`get` → increment →
 * `set`). With the default single-process in-memory store this is atomic —
 * there is no await between read and write that another request can interleave
 * through. With an **async/remote** store (Redis, Prisma, Upstash) the get and
 * set are two round-trips, so concurrent requests can each read the same count
 * and under-count the limit by the in-flight concurrency. For a strict limit
 * under multi-instance load, back the store with a server-side atomic
 * increment (e.g. Redis `INCR` + `EXPIRE`) and have `get`/`set` reflect it,
 * rather than relying on this read-modify-write.
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
  return authError('rate_limited', 429, {
    message,
    headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) }
  });
}

/**
 * Lower-level sync helper for callers that already hold a `Map` directly.
 *
 * @deprecated No longer used anywhere in the package. Prefer
 * {@link createRateLimiter} with a `RateLimitStore` (works with sync in-memory
 * **and** async Redis/Prisma stores), or {@link enforceRateLimit} to return the
 * 429 directly. Scheduled for removal in v6 — see the breaking-change list in
 * `docs/AUTH-HARDENING.md`. Kept now only to avoid breaking any consumer that
 * imported it.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  store: Map<string, RateLimitEntry>
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(identifier);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(identifier, entry);
  }

  entry.count++;

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
}
