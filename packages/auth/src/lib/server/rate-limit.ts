import type { AuthConfig, RateLimitConfig } from '../types.js';
import { authError } from './handlers/errors.js';
import { assertJwtSecret, fingerprint, limiterFor } from './secret-registry.js';
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

// One in-memory limiter per (`jwt.secret` fingerprint, rate-limit key,
// resolved `windowMs`, resolved `max`), for the whole process, registered in
// `secret-registry.ts` — which hands out one stable wrapper per key, so that
// `resetRateLimiters` reaches a handler built before the reset (a factory
// captures its limiter once). Keyed on the secret rather than on the config object
// so that every bundle a consumer builds for one secret — `createAuthDeps` per
// request included — reads the same counter and the same in-memory store: one
// cleanup `setInterval` per key, not one per call. Two factories reading one
// key (verify-email + verify-email-change on `verifyEmail`) share it the same
// way.
//
// The resolved values are part of the key so that a bundle configuring a key
// differently counts on its own, under its own limits, and nothing depends on
// which bundle read the key first. Two things are therefore never registered:
// an opt-out (`rateLimitFor` → undefined), because a `null` under the key would
// switch off the limit a later bundle configures for it; and a limit with a
// persistent `store`, because its counters live in the store — two wrappers on
// one store share them already — and the wrapper itself holds no state and no
// interval. Only the in-memory default keeps its counters in the limiter, so
// only that is worth sharing.
//
// The registry outlives every config: its entries are the distinct (secret,
// key, values) triples the process has ever built, so a rotated-away secret or
// a retuned limit leaves its limiter behind. Under `vite dev` it survives a hot
// reload of the consumer's files, which re-executes those and not this module
// — whether Vite serves the package through its SSR module graph (measured: a
// comment edit to the file calling `createAuthDeps` kept a spent `login`
// counter at 429, an edit of `rateLimit.login.max` counted afresh under the new
// values on the next bundle, no restart) or externalizes it to Node's module
// cache.

/**
 * The rate-limiter for one endpoint key, shared by every handler factory built
 * for the same `jwt.secret` and the same resolved limit. Handlers use this
 * instead of `makeRateLimiter(config.rateLimit?.key)`: it applies the secure
 * default (see `rateLimitFor`) and it puts two factories reading one key on
 * one counter.
 */
export function sharedLimiter<R extends string>(
  config: AuthConfig<R>,
  key: RateLimitKey
): RateLimiter | null {
  // A hand-built `AuthDeps` never passed `assertAuthConfigValid`, so this is
  // where it meets the wiring error; `jwt` itself can be absent on that path.
  const secret: unknown = config.jwt?.secret;
  assertJwtSecret(secret);
  const limit = rateLimitFor(config, key);
  if (!limit) return null;
  if (limit.store) return createRateLimiter(limit);
  // Every value field of `RateLimitConfig` belongs in the key, and the
  // compiler keeps it so: a field added to the type lands in `rest`, which no
  // longer assigns to `never` until the key below carries it.
  const { windowMs, max, store: _store, ...rest } = limit;
  const _exhaustive: Record<string, never> = rest;
  return limiterFor(`${fingerprint(secret)}|${key}|${windowMs}|${max}`, () =>
    createRateLimiter(limit)
  );
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
