import type { RateLimiter } from './rate-limit.js';

// Process-wide state keyed on the `jwt.secret`, and the door every reader of
// that secret passes through. Two registries live here because both outlive
// every config object and neither may retain a secret the consumer has
// rotated away: the rate-limit counters (`sharedLimiter`) and the
// repeat-bundle warning (`createAuthDeps`).
//
// Imports nothing at runtime, deliberately. The package's vitest setup file
// loads this module before every test file, and whatever it pulls in is
// pinned in the module registry before any `vi.mock` in the file under test
// runs — an import of `rate-limit.ts` here would pin `handlers/errors.ts`,
// `@sveltejs/kit` and the i18n bundle with it, and a test mocking one of those
// would see the real module. `setup-file-imports.test.ts` is the control: it
// goes red the day this module or the setup file gains an import.
// (`import type` is erased.)

/**
 * The one check every reader of `jwt.secret` runs: `assertJwtConfigValid` at
 * wiring time, and `sharedLimiter` for a hand-built `AuthDeps` that never
 * passed it. The value itself is never echoed.
 */
export function assertJwtSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== 'string' || secret.length === 0) {
    const received =
      secret === undefined
        ? 'undefined — an unset environment variable?'
        : typeof secret === 'string'
          ? 'an empty string'
          : typeof secret;
    throw new Error(
      `[auth] jwt.secret must be a non-empty string (received: ${received}). It signs the session cookie under HS256 and the package's short-lived tokens under every algorithm — set config.jwt.secret from your secret store.`
    );
  }
}

/**
 * The key both registries use for one secret. The input is chosen by the
 * consumer, never by an attacker, so no cryptographic hash is needed — and
 * `crypto.subtle` would be async where neither caller is. Two 32-bit lanes
 * with different mixing, because either one alone degenerates: measured over
 * all 857 375 three-character ASCII strings the DJB lane collides 751 775
 * times and the FNV lane never, over 2 M random 32-byte secrets each lane
 * collides ~450 times and the pair never. A collision would put two tenants
 * on one counter, silently — the price of not hashing.
 */
export function fingerprint(secret: string): string {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < secret.length; i++) {
    const code = secret.charCodeAt(i);
    fnv = Math.imul(fnv ^ code, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  return `${(fnv >>> 0).toString(16)}:${(djb >>> 0).toString(16)}`;
}

// ── rate-limit counters ──────────────────────────────────────────────────────
// What the key is made of, and why only the in-memory default is registered:
// the block above `sharedLimiter` in rate-limit.ts.
//
// Two maps. `limiters` holds the entries with the counters and is what a reset
// empties. `wrappers` holds one stable `RateLimiter` per key that reads the
// current entry on every call and rebuilds it after a reset — a handler
// factory captures its limiter once (`const rateLimiter = sharedLimiter(…)`),
// so a reset that replaced the object a holder keeps would reach no handler
// built before it. Never cleared; its size is bounded like `limiters`, by the
// distinct keys the process has built.
const limiters = new Map<string, RateLimiter>();
const wrappers = new Map<string, RateLimiter>();

/**
 * The stable limiter for `key`. Its entry is built by `build` on the first
 * call that needs it — the first `check`, and the first after a reset.
 */
export function limiterFor(key: string, build: () => RateLimiter): RateLimiter {
  const known = wrappers.get(key);
  if (known) return known;
  const current = (): RateLimiter => {
    let limiter = limiters.get(key);
    if (!limiter) {
      limiter = build();
      limiters.set(key, limiter);
    }
    return limiter;
  };
  const wrapper: RateLimiter = {
    check: (identifier) => current().check(identifier),
    refund: (identifier, amount) => current().refund(identifier, amount),
    reset: (identifier) => current().reset(identifier)
  };
  wrappers.set(key, wrapper);
  return wrapper;
}

/**
 * Empty the process-wide rate-limit counters: every in-memory limiter starts
 * over, with a fresh store, on its next check — every handler's, whenever the
 * handler was built.
 *
 * For test suites that build real handlers from a literal secret. The
 * counters are per secret and per process, not per config object, so without
 * this every test in a file after the first inherits the budget its siblings
 * spent — a `max: 1` test meets a counter that is already at 1. Call it before
 * each test (docs/AUTH.md → Testing handlers). Limiters on a persistent
 * `store` are never registered here; their counters are the store's to clear.
 */
export function resetRateLimiters(): void {
  limiters.clear();
}

// ── repeat-bundle warning ────────────────────────────────────────────────────
const seenSecrets = new Map<string, boolean>();

/**
 * Whether the repeat warning is due for this secret: `false` on the first
 * sighting and after the warning has gone out, `true` exactly once — on the
 * second sighting.
 */
export function repeatWarningDue(secretFingerprint: string): boolean {
  const warned = seenSecrets.get(secretFingerprint);
  if (warned === undefined) {
    seenSecrets.set(secretFingerprint, false);
    return false;
  }
  if (warned) return false;
  seenSecrets.set(secretFingerprint, true);
  return true;
}

/**
 * Test seam for the repeat registry — not in the package's export map. The
 * package's vitest setup file calls it before each test; a suite building
 * many bundles from one literal secret would otherwise carry the warning from
 * test to test.
 */
export function __resetSeenSecretsForTests(): void {
  seenSecrets.clear();
}
