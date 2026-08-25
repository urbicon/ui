// Pending-challenge storage for the WebAuthn ceremonies: the store contract,
// the in-memory default and the store/consume primitives. Split out of the
// former webauthn.ts god-file.

import { base64UrlEncode } from '../encoding.js';

export interface ChallengeEntry {
  challenge: string;
  expires: number;
}

/**
 * Storage interface for pending WebAuthn challenges. Implementations may be
 * synchronous (default in-memory Map) or asynchronous (Redis/Prisma/etc).
 * Methods may return plain values or Promises; callers always await the
 * result.
 *
 * **Atomicity:** for remote/shared backends, implement `take` so that the
 * read-and-delete happens in a single round-trip (Redis `GETDEL`, Prisma
 * `delete returning`, etc.). Without it, `consumeChallenge` falls back to
 * `get`+`delete` which can allow a challenge to be consumed twice under a
 * concurrent-request race. The default in-memory store provides `take`.
 */
export interface ChallengeStore {
  get(key: string): ChallengeEntry | undefined | Promise<ChallengeEntry | undefined>;
  set(key: string, entry: ChallengeEntry): void | Promise<void>;
  delete(key: string): void | Promise<void>;
  /** Atomic read-and-delete. Preferred over `get`+`delete` for replay safety. */
  take?(key: string): ChallengeEntry | undefined | Promise<ChallengeEntry | undefined>;
}

export function generateChallenge(): string {
  // WebAuthn requires cryptographically strong randomness for challenges.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Default in-memory challenge store factory. Creates a new Map-backed store
 * with a periodic cleanup timer. Consumers that need multi-instance support
 * supply their own `ChallengeStore` implementation via
 * `WebAuthnConfig.challengeStore` instead of this default.
 */
export function createInMemoryChallengeStore(options?: {
  cleanupIntervalMs?: number;
}): ChallengeStore {
  const store = new Map<string, ChallengeEntry>();
  const interval = options?.cleanupIntervalMs ?? 60_000;

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expires) store.delete(key);
    }
  }, interval);
  timer.unref?.();

  return {
    get: (key) => store.get(key),
    set: (key, entry) => void store.set(key, entry),
    delete: (key) => void store.delete(key),
    take: (key) => {
      const entry = store.get(key);
      store.delete(key);
      return entry;
    }
  };
}

// Lazy process-wide default so single-process deployments work without any
// configuration. Multi-instance deployments should provide their own store
// via `WebAuthnConfig.challengeStore` — in that case this default is not
// even instantiated.
let defaultChallengeStore: ChallengeStore | undefined;
function getDefaultChallengeStore(): ChallengeStore {
  if (!defaultChallengeStore) {
    defaultChallengeStore = createInMemoryChallengeStore();
  }
  return defaultChallengeStore;
}

// Structural parameter (rather than the full WebAuthnConfig) so this module
// stays independent of the ceremony types in webauthn.ts.
export function resolveChallengeStore(config: { challengeStore?: ChallengeStore }): ChallengeStore {
  return config.challengeStore ?? getDefaultChallengeStore();
}

/** 5 minutes. See {@link resolveChallengeTimeoutMs}. */
const DEFAULT_CHALLENGE_TIMEOUT_MS = 300_000;

/**
 * The lifetime of one WebAuthn ceremony, in ms.
 *
 * Four things expire on it — the store entry, the `timeout` the browser is
 * given for registration and for assertion, and the `maxAge` of the cookie that
 * carries the ceremony handle — and they only agree while they read one value:
 * a cookie that outlives its challenge sends the verify step to a challenge
 * that is gone, a challenge that outlives its cookie is unreachable.
 */
export function resolveChallengeTimeoutMs(config: { challengeTimeout?: number }): number {
  return config.challengeTimeout ?? DEFAULT_CHALLENGE_TIMEOUT_MS;
}

/**
 * The same lifetime in whole seconds, rounded up — the unit `cookies.set` takes
 * for `maxAge`. Here rather than at the cookie so the conversion has one site.
 */
export function resolveChallengeTimeoutSeconds(config: { challengeTimeout?: number }): number {
  return Math.ceil(resolveChallengeTimeoutMs(config) / 1000);
}

// `key` is the challenge-store key — a user id for registration, a per-ceremony
// handle for discoverable authentication (see `generateAuthenticationOptions`).
// Kept generic because both callers route through here.
export async function storeChallenge(
  store: ChallengeStore,
  key: string,
  challenge: string,
  timeoutMs: number = DEFAULT_CHALLENGE_TIMEOUT_MS
): Promise<void> {
  await Promise.resolve(store.set(key, { challenge, expires: Date.now() + timeoutMs }));
}

export async function consumeChallenge(store: ChallengeStore, key: string): Promise<string | null> {
  // Prefer atomic take() when the store provides it — otherwise a concurrent
  // request race can consume the same challenge twice (TOCTOU on get+delete).
  if (store.take) {
    const entry = await Promise.resolve(store.take(key));
    if (!entry) return null;
    if (Date.now() > entry.expires) return null;
    return entry.challenge;
  }
  const entry = await Promise.resolve(store.get(key));
  if (!entry) return null;
  // Expiry check BEFORE delete — a delete failure on a stale entry is
  // harmless (cleanup timer picks it up), and a delete failure on a valid
  // entry still lets this request succeed while logging the problem loudly.
  const expired = Date.now() > entry.expires;
  try {
    await Promise.resolve(store.delete(key));
  } catch (err) {
    console.error(
      '[auth] consumeChallenge: store.delete failed — challenge may be replayable until TTL.',
      err
    );
  }
  if (expired) return null;
  return entry.challenge;
}
