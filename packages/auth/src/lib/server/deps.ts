import type { AuthConfig, LockoutConfig, RateLimitConfig } from '../types.js';
import type {
  BackupCodeRepository,
  InvitationRepository,
  RefreshTokenRepository,
  UserRepository
} from './adapters/types.js';
import type { EmailTransport } from './email/types.js';

export interface AuthDeps<R extends string = string> {
  config: AuthConfig<R>;
  repos: {
    user: UserRepository<R>;
    invitation: InvitationRepository;
    /**
     * Optional — required only when `config.refreshToken` is set. Pass the
     * Prisma adapter's `refreshToken` field, or an in-memory/Redis/Upstash
     * implementation via `createInMemoryRefreshTokenRepository` or a custom
     * `RefreshTokenRepository`.
     */
    refreshToken?: RefreshTokenRepository;
    /**
     * Optional — required only when `config.twoFactor` (TOTP 2FA) is wired. Pass
     * the adapter's `backupCode` field (in-memory/Prisma both ship one). Stores
     * the SHA-256-hashed recovery codes the 2FA flow issues at enable.
     */
    backupCode?: BackupCodeRepository;
  };
  email: EmailTransport;
}

// Brute-force defaults applied when a consumer configures neither rate-limiting
// nor lockout — secure-by-default rather than silently unprotected.
const DEFAULT_LOGIN_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, max: 5 };
const DEFAULT_LOCKOUT: LockoutConfig = { maxAttempts: 5, durationMinutes: 15 };
// Strict default for the 2FA verify step: a 6-digit code is only 10^6
// combinations, so the second factor is worthless without a tight limiter.
// 10 / 15 min tolerates a few typos while making online brute force hopeless.
const DEFAULT_TWO_FACTOR_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, max: 10 };

// Floor below which an explicitly configured PBKDF2 work factor is treated as
// dangerously weak. The secure default (600k, see auth.ts) is well above this;
// this only catches a consumer deliberately lowering it in production.
const MIN_SAFE_PBKDF2_ITERATIONS = 100_000;

/**
 * Fill in secure brute-force defaults and warn on unsafe production configs.
 * The two mechanisms are resolved **independently** so configuring one can
 * never silently drop the other:
 *
 * - **Login rate-limit** (per-IP, the security-critical limiter): ensured to be
 *   present unless explicitly opted out with `rateLimit: null`. A `rateLimit`
 *   object that configures *other* endpoints (register/refresh/…) but omits
 *   `login` is treated as an oversight, not an opt-out — the `login` default is
 *   injected and the other keys are passed through untouched. This closes the
 *   trap where `rateLimit: { register }` left login completely unprotected.
 * - **Lockout** (account-level, carries a lock-out-DoS trade-off): defaulted
 *   only when the consumer engaged with brute-force config *not at all* (no
 *   `rateLimit` **and** no `lockout`). A consumer who configured rate-limiting
 *   has clearly engaged with the defense, so we respect an omitted lockout
 *   rather than imposing the DoS-prone mechanism on them.
 * - Either field set explicitly to `null` → honoured as opt-out, normalized to
 *   `undefined` so handlers skip it, and warned about in a production config.
 * - A production config (`cookieSecure !== false`) that still ends up with no
 *   login protection at all (only reachable via `rateLimit: null`) is warned
 *   about loudly.
 *
 * Returns a new config object — the caller's input is not mutated.
 */
function resolveSecurityDefaults<R extends string>(config: AuthConfig<R>): AuthConfig<R> {
  const isProduction = config.jwt.cookieSecure !== false;
  const resolved: AuthConfig<R> = { ...config };

  // Login rate-limit: opt out only via explicit null; otherwise guarantee the
  // login limiter exists even when the consumer configured other endpoints.
  if (config.rateLimit === null) {
    if (isProduction) {
      console.warn(
        '[auth] config.rateLimit is explicitly null in a production config (jwt.cookieSecure !== false) — auth handlers are not rate-limited. Set config.rateLimit.login or accept this opt-out deliberately.'
      );
    }
    resolved.rateLimit = undefined;
  } else if (!config.rateLimit?.login) {
    resolved.rateLimit = { ...config.rateLimit, login: DEFAULT_LOGIN_RATE_LIMIT };
  }

  // Lockout: explicit null opts out; otherwise default it only when the
  // consumer touched no brute-force config at all.
  if (config.lockout === null) {
    if (isProduction) {
      console.warn(
        '[auth] config.lockout is explicitly null in a production config — repeated failed logins will not lock the account.'
      );
    }
    resolved.lockout = undefined;
  } else if (config.lockout === undefined && config.rateLimit === undefined) {
    resolved.lockout = DEFAULT_LOCKOUT;
  }

  if (isProduction && !resolved.rateLimit?.login && !resolved.lockout) {
    console.warn(
      '[auth] No login rate-limit or lockout is active in a production config — login is exposed to brute force. Configure config.rateLimit.login and/or config.lockout.'
    );
  }

  // Two-factor verify: brute-force critical (6-digit code). When 2FA is wired,
  // guarantee a strict limiter unless rate-limiting was explicitly opted out
  // (`rateLimit: null`, already warned about above). Operates on the
  // already-resolved rateLimit so the login default isn't clobbered.
  if (config.twoFactor && resolved.rateLimit && !resolved.rateLimit.twoFactor) {
    resolved.rateLimit = { ...resolved.rateLimit, twoFactor: DEFAULT_TWO_FACTOR_RATE_LIMIT };
  }
  if (isProduction && config.twoFactor && !resolved.rateLimit?.twoFactor) {
    console.warn(
      '[auth] config.twoFactor is set but the 2FA verify endpoint is not rate-limited (rateLimit: null) — a 6-digit code is brute-forceable. Configure config.rateLimit.twoFactor or drop the rateLimit opt-out.'
    );
  }

  const iterations = config.password?.pbkdf2Iterations;
  if (isProduction && typeof iterations === 'number' && iterations < MIN_SAFE_PBKDF2_ITERATIONS) {
    console.warn(
      `[auth] config.password.pbkdf2Iterations is ${iterations} in a production config — far below the OWASP recommendation (≥ 600,000 for PBKDF2-HMAC-SHA256). Raise it or omit it to use the secure default.`
    );
  }

  return resolved;
}

/**
 * Assemble the auth dependency bundle, applying secure brute-force defaults to
 * the config (see {@link resolveSecurityDefaults}). The returned `config`
 * carries the resolved values — pass it on to `createAuthHandle` and the
 * handler factories so the whole app shares one resolved config.
 */
export function createAuthDeps<R extends string>(deps: AuthDeps<R>): AuthDeps<R> {
  return { ...deps, config: resolveSecurityDefaults(deps.config) };
}
