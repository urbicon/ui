import type { AuthConfig, AuthLogger, LockoutConfig, RateLimitConfig } from '../types.js';
import type {
  BackupCodeRepository,
  InvitationRepository,
  PasskeyRepository,
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
    /**
     * Optional — required only when the passkey route group
     * (`createPasskeyHandlers`) is mounted; that factory throws at wiring time
     * when it is missing. Pass the adapter's `passkey` field.
     */
    passkey?: PasskeyRepository;
  };
  email: EmailTransport;
  /**
   * Resolved log sink (`config.logger ?? console`) — `createAuthDeps` always
   * fills it, so handlers log operational failures through one seam instead
   * of hard-coding `console`.
   */
  logger: AuthLogger;
}

// Brute-force defaults applied when a consumer configures neither rate-limiting
// nor lockout — secure-by-default rather than silently unprotected.
const DEFAULT_LOGIN_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, max: 5 };
const DEFAULT_LOCKOUT: LockoutConfig = { maxAttempts: 5, durationMinutes: 15 };
// Strict default for the 2FA verify step: a 6-digit code is only 10^6
// combinations, so the second factor is worthless without a tight limiter.
// 10 / 15 min tolerates a few typos while making online brute force hopeless.
const DEFAULT_TWO_FACTOR_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, max: 10 };
// Re-auth endpoints (change-password/-email, delete-account, 2FA-disable) all
// accept the account password, so they get login-strength protection: a
// hijacked session must not get a better brute-force budget than the login
// form — especially not at 2FA-disable, where success removes the second
// factor. Failed re-auths do not feed the lockout (verifyCurrentPassword is
// side-effect-free by design), making this limiter the only brake.
const DEFAULT_REAUTH_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, max: 5 };
// Password-reset *request* endpoint (forgot-password): unauthenticated and
// sends an email on every hit for an existing account, so an unlimited endpoint
// is a mail-bombing + delivery-cost vector (flood a victim's inbox / burn the
// consumer's mail quota). Deliberately more generous than login (10 vs 5): the
// limit is keyed per-IP, so a tight cap risks NAT/shared-IP false positives for
// a request a legitimate user makes rarely — while 10 / 15 min still deckelt an
// abuser hard. Not a credential oracle (the handler equalizes timing and always
// returns success), so it needs no login-strength brake.
const DEFAULT_FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, max: 10 };

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
function resolveSecurityDefaults<R extends string>(
  config: AuthConfig<R>,
  logger: AuthLogger
): AuthConfig<R> {
  const isProduction = config.jwt.cookieSecure !== false;
  const resolved: AuthConfig<R> = { ...config };

  // Login rate-limit: opt out only via explicit null; otherwise guarantee the
  // login limiter exists even when the consumer configured other endpoints.
  if (config.rateLimit === null) {
    if (isProduction) {
      logger.warn(
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
      logger.warn(
        '[auth] config.lockout is explicitly null in a production config — repeated failed logins will not lock the account.'
      );
    }
    resolved.lockout = undefined;
  } else if (config.lockout === undefined && config.rateLimit === undefined) {
    resolved.lockout = DEFAULT_LOCKOUT;
  }

  if (isProduction && !resolved.rateLimit?.login && !resolved.lockout) {
    logger.warn(
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

  // Re-auth endpoints accept the account password from an existing session, so
  // an unlimited endpoint lets a hijacked session brute-force the password —
  // the config documents exactly this threat model on `changePassword`, and
  // `verifyCurrentPassword` deliberately records no failed attempt (no lockout
  // backstop). Guarantee a login-strength default on each unless explicitly
  // configured; the 2FA-disable one only when the endpoint can exist at all.
  if (resolved.rateLimit) {
    const reauthDefaults: Partial<NonNullable<AuthConfig<R>['rateLimit']>> = {};
    for (const key of ['changePassword', 'changeEmail', 'deleteAccount'] as const) {
      if (!resolved.rateLimit[key]) reauthDefaults[key] = DEFAULT_REAUTH_RATE_LIMIT;
    }
    if (config.twoFactor && !resolved.rateLimit.twoFactorDisable) {
      reauthDefaults.twoFactorDisable = DEFAULT_REAUTH_RATE_LIMIT;
    }
    if (Object.keys(reauthDefaults).length > 0) {
      resolved.rateLimit = { ...resolved.rateLimit, ...reauthDefaults };
    }
  }

  // Password-reset request endpoint: guarantee a (generous) per-IP limiter
  // unless rate-limiting was opted out (`rateLimit: null` → resolved.rateLimit
  // undefined). See DEFAULT_FORGOT_PASSWORD_RATE_LIMIT for the mail-bombing / NAT
  // trade-off. Runs on the already-resolved rateLimit so nothing above is
  // clobbered.
  if (resolved.rateLimit && !resolved.rateLimit.forgotPassword) {
    resolved.rateLimit = {
      ...resolved.rateLimit,
      forgotPassword: DEFAULT_FORGOT_PASSWORD_RATE_LIMIT
    };
  }

  if (isProduction && config.twoFactor && !resolved.rateLimit?.twoFactor) {
    logger.warn(
      '[auth] config.twoFactor is set but the 2FA verify endpoint is not rate-limited (rateLimit: null) — a 6-digit code is brute-forceable. Configure config.rateLimit.twoFactor or drop the rateLimit opt-out.'
    );
  }

  const iterations = config.password?.pbkdf2Iterations;
  if (isProduction && typeof iterations === 'number' && iterations < MIN_SAFE_PBKDF2_ITERATIONS) {
    logger.warn(
      `[auth] config.password.pbkdf2Iterations is ${iterations} in a production config — far below the OWASP recommendation (≥ 600,000 for PBKDF2-HMAC-SHA256). Raise it or omit it to use the secure default.`
    );
  }

  return resolved;
}

/**
 * Fail loud at wiring time when a feature is configured but its backing
 * repository is absent, instead of degrading silently at request time. The one
 * silent case today is refresh-token rotation: with `config.refreshToken` set
 * but `repos.refreshToken` missing, `establishSession` would skip the refresh
 * cookie and the handle hook would decline to rotate — both without a trace,
 * quietly downgrading every session to access-token-only. Throwing here mirrors
 * `createPasskeyHandlers` (throws on a missing `repos.passkey`) and follows the
 * fail-loud-over-silent-fallback line.
 *
 * Both entry points must call this — `createAuthDeps` (handler deps) and
 * `createAuthHandle` (the hook) build their bundles independently, so a check in
 * only one would leave the other's path silent.
 *
 * 2FA and passkeys are intentionally out of scope: 2FA already surfaces a
 * visible `feature_unavailable` 400 at request time when `repos.backupCode` is
 * absent, and the passkey factory already throws at wiring time — neither
 * degrades silently, so neither is the gap this closes.
 */
export function assertReposMatchConfig<R extends string>(
  config: AuthConfig<R>,
  repos: { refreshToken?: RefreshTokenRepository }
): void {
  if (config.refreshToken && !repos.refreshToken) {
    throw new Error(
      '[auth] config.refreshToken is set but repos.refreshToken is missing. ' +
        'Refresh-token rotation cannot work without its repository — pass the ' +
        "adapter's `refreshToken` field (or createInMemoryRefreshTokenRepository), " +
        'or remove config.refreshToken.'
    );
  }
}

/**
 * Assemble the auth dependency bundle, applying secure brute-force defaults to
 * the config (see {@link resolveSecurityDefaults}). The returned `config`
 * carries the resolved values — pass it on to `createAuthHandle` and the
 * handler factories so the whole app shares one resolved config.
 */
/**
 * Shield every log call from a throwing consumer sink. Several call sites log
 * inside detached fire-and-forget blocks (forgot-password, change-email) where
 * a throwing `logger.error` would become an unhandled promise rejection, and
 * others log after a security-relevant write already succeeded — a broken
 * logging transport must never break the auth flow it observes.
 */
export function shieldLogger(logger: AuthLogger): AuthLogger {
  return {
    warn(message, ...context) {
      try {
        logger.warn(message, ...context);
      } catch {
        /* a broken sink must not break auth */
      }
    },
    error(message, ...context) {
      try {
        logger.error(message, ...context);
      } catch {
        /* a broken sink must not break auth */
      }
    }
  };
}

export function createAuthDeps<R extends string>(deps: Omit<AuthDeps<R>, 'logger'>): AuthDeps<R> {
  assertReposMatchConfig(deps.config, deps.repos);
  // One source for the sink: `config.logger`. The resolved field on the deps
  // bundle is what handlers use, so none of them re-defaults to console.
  const logger = shieldLogger(deps.config.logger ?? console);
  return { ...deps, logger, config: resolveSecurityDefaults(deps.config, logger) };
}
