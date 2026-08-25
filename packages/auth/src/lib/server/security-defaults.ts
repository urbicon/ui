import type { AuthConfig, LockoutConfig, RateLimitConfig } from '../types.js';

/**
 * Every key `AuthConfig.rateLimit` declares, derived from the interface rather
 * than listed again. {@link RATE_LIMIT_DEFAULTS} is typed `Record<RateLimitKey,
 * …>`, so adding a key in `types.ts` without a default is a compile error —
 * which is the whole point: the previous hand-maintained list had drifted to
 * cover 5 of 12 keys, and nothing reported the gap.
 */
export type RateLimitKey = keyof NonNullable<AuthConfig['rateLimit']>;

// Re-auth endpoints (change-password/-email, delete-account, 2FA-disable) all
// accept the account password, so they get login-strength protection: a
// hijacked session must not get a better brute-force budget than the login
// form — especially not at 2FA-disable, where success removes the second
// factor. Failed re-auths do not feed the lockout (verifyCurrentPassword is
// side-effect-free by design), making this limiter the only brake.
const REAUTH: RateLimitConfig = { windowMs: 15 * 60_000, max: 5 };

// Unauthenticated endpoints that act on a 256-bit single-use token
// (forgot-password mints one, the other three consume one). Guessing is not the
// threat — `generateSecureToken` is 32 random bytes claimed atomically — so the
// budget brakes what a request *costs*, not what it could discover. Deliberately
// more generous than login: the key is the client IP, so a tight cap misfires on
// a NAT/shared office address for an action a real user performs once, while 10
// / 15 min still caps an abuser hard.
const TOKEN_FLOW: RateLimitConfig = { windowMs: 15 * 60_000, max: 10 };

/**
 * The per-key brute-force defaults. Complete by construction (see
 * {@link RateLimitKey}) and applied through {@link rateLimitFor}, so no entry
 * point can carry a config that is missing one.
 */
export const RATE_LIMIT_DEFAULTS: Record<RateLimitKey, RateLimitConfig> = {
  // The security-critical limiter: the one endpoint where the secret being
  // offered is a human-chosen password.
  login: { windowMs: 15 * 60_000, max: 5 },

  // PBKDF2 runs only AFTER the invitation token, its used/expiry state and the
  // email match, so an un-invited request costs two indexed reads. The budget
  // therefore brakes account and mail creation, not CPU.
  register: TOKEN_FLOW,

  // Sends a mail on every hit for an existing account, so an unlimited endpoint
  // is a mail-bombing + delivery-cost vector. Not a credential oracle (the
  // handler equalizes timing and always returns success).
  forgotPassword: TOKEN_FLOW,

  // The expensive one: `hashPassword` runs BEFORE `consumeResetToken`, on
  // purpose, so the claim→write window stays closed — which means one
  // unauthenticated request with any garbage token costs a full PBKDF2 run.
  // Measured 55.2 ms per call at the default work factor (600k rounds), and
  // ~64 req/s saturates the libuv threadpool that login's hashing shares. This
  // cap holds one IP to 10 × 55.2 ms = 0.55 s of PBKDF2 per window, three
  // orders of magnitude below the ~57 600 requests/window that saturation
  // needs.
  resetPassword: TOKEN_FLOW,

  // One indexed conditional write per call. Shares its bucket with
  // verify-email-change (see `sharedLimiter`), so this is the budget across
  // both token-consume endpoints.
  verifyEmail: TOKEN_FLOW,

  // The one key where a 15-minute window would be wrong. The handle hook
  // rotates transparently WITHOUT this limiter; only the explicit
  // `createRefreshHandler` endpoint reads it, and a client needs it once per
  // access-token lifetime (default 15 min). The hazard is the shared IP: every
  // session behind one NAT address lands on one counter. A short window is the
  // protection — 30/min absorbs a 30-tab thundering herd at one instant and
  // forgets it a minute later, where a 15-minute window would lock the office
  // out for the rest of it. 50 users × 3 tabs = 150 rotations per 15 min = 10
  // per minute, a third of the cap.
  refresh: { windowMs: 60_000, max: 30 },

  // Two calls per ceremony (options + verify share one bucket), so 30 is 15
  // *completed* ceremonies per IP per window. The options half stores one
  // challenge entry per call, pruned only at the 5-minute TTL, and an abandoned
  // ceremony spends one call and leaves its entry — so the bound this cap puts
  // on the store is the full 30 live entries per IP, not 15.
  passkeyAuth: { windowMs: 15 * 60_000, max: 30 },

  changePassword: REAUTH,
  changeEmail: REAUTH,
  deleteAccount: REAUTH,
  twoFactorDisable: REAUTH,

  // A 6-digit code is 10^6 combinations, so the second factor is worthless
  // without a tight limiter. 10 / 15 min tolerates a few typos while making
  // online brute force hopeless. Defaulted even without `config.twoFactor`: the
  // limiter is only ever built by the 2FA handlers, and a condition here would
  // be a second hand-maintained list of exactly the kind this table removes.
  twoFactor: { windowMs: 15 * 60_000, max: 10 }
};

const RATE_LIMIT_KEYS = Object.keys(RATE_LIMIT_DEFAULTS) as RateLimitKey[];

/**
 * Account-lockout policy applied when the consumer engaged with brute-force
 * config not at all. Carries a lock-out-DoS trade-off (AUTH.md → Known
 * Limitations), which is why it is not imposed on a consumer who configured
 * rate-limiting themselves.
 */
/**
 * One hour. Exported because `createLoginHandler` needs the same number for a
 * lockout the consumer configured *partially* (`{ maxAttempts: 3 }`), which
 * never passes through `DEFAULT_LOCKOUT` — two copies would let the injected
 * default and the effective one disagree.
 */
export const DEFAULT_DECAY_MINUTES = 60;
export const DEFAULT_LOCKOUT: LockoutConfig = {
  maxAttempts: 5,
  durationMinutes: 15,
  decayMinutes: DEFAULT_DECAY_MINUTES
};

/**
 * The effective limit for one endpoint. Handlers read their limit through this
 * rather than off `config.rateLimit` directly, so a hand-built `AuthDeps` — an
 * exported type the package explicitly expects consumers to build
 * (`establishSession`'s defense-in-depth note) — gets the same protection as
 * one from `createAuthDeps`. Before, `resolveSecurityDefaults` ran only inside
 * `createAuthDeps` and the hand-built path arrived at the login endpoint with
 * no limiter and no lockout at all.
 *
 * `rateLimit: null` is the deliberate opt-out and is honoured here too.
 */
export function rateLimitFor<R extends string>(
  config: AuthConfig<R>,
  key: RateLimitKey
): RateLimitConfig | undefined {
  // Two scopes of opt-out, both explicit `null`: the whole object, or one key.
  // An *omitted* key is not an opt-out — that is the trap `rateLimit: { register }`
  // used to spring on `login`, so `??` must not treat absence as a decision.
  if (config.rateLimit === null) return undefined;
  const configured = config.rateLimit?.[key];
  if (configured === null) return undefined;
  return configured ?? RATE_LIMIT_DEFAULTS[key];
}

/**
 * The effective lockout policy. Defaulted only when the consumer set neither
 * `rateLimit` nor `lockout` — configuring rate-limiting is engagement with the
 * defense, so an omitted lockout is respected rather than overridden with the
 * DoS-prone mechanism.
 */
export function lockoutFor<R extends string>(config: AuthConfig<R>): LockoutConfig | undefined {
  if (config.lockout === null) return undefined;
  if (config.lockout !== undefined) return config.lockout;
  return config.rateLimit === undefined ? DEFAULT_LOCKOUT : undefined;
}

/**
 * The resolved `rateLimit` slice carried on `AuthDeps.config`: every key either
 * a limit or `null` (opted out), or `null` for the whole object.
 *
 * `null` rather than `undefined` for an opt-out is load-bearing **here**. Every
 * handler reads the resolved config back through {@link rateLimitFor}, so it has
 * to be a **fixed point**: normalizing an opt-out to `undefined` would make the
 * next read say "consumer configured nothing" and re-inject the default — the
 * opt-out would survive exactly one resolution.
 *
 * `lockout` needs no such treatment and keeps `undefined`, because
 * `resolveRateLimits` never yields `undefined`: {@link lockoutFor}'s defaulting
 * branch is gated on `config.rateLimit === undefined`, which is unreachable on
 * an already-resolved config. Measured stable across five successive
 * resolutions of every input shape.
 */
export function resolveRateLimits<R extends string>(
  config: AuthConfig<R>
): AuthConfig<R>['rateLimit'] {
  if (config.rateLimit === null) return null;
  const resolved = {} as Record<RateLimitKey, RateLimitConfig | null>;
  for (const key of RATE_LIMIT_KEYS) resolved[key] = rateLimitFor(config, key) ?? null;
  return resolved;
}
