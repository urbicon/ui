import { DEFAULT_PASSWORD_POLICY, isValidMinLength } from '../password-policy.js';
import type { AuthConfig, AuthLogger } from '../types.js';
import type {
  BackupCodeRepository,
  InvitationRepository,
  PasskeyRepository,
  RefreshTokenRepository,
  UserRepository
} from './adapters/types.js';
import {
  assertCookieSameSiteSecure,
  describeCookieSecureDisagreement,
  isSecureDeployment
} from './cookie-policy.js';
import type { EmailTransport } from './email/types.js';
import { assertJwtConfigValid } from './jwt.js';
import { shieldLogger } from './logger.js';
import { lockoutFor, resolveRateLimits } from './security-defaults.js';

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
   * of hard-coding `console`. Three package internals sit outside a deps bundle
   * by design and take the sink as an optional argument instead: `validateCsrf`
   * (a standalone export a federated consumer calls from its own hook) and
   * `consumeChallenge` (in the deps-free WebAuthn core), both handed it by the
   * handle hook and the passkey factory; and the Prisma repository factories,
   * which run *before* any bundle exists — those default to `console`, the same
   * sink `config.logger ?? console` resolves to, so they only need
   * `createPrismaRepos(prisma, { logger })` when the app configures its own.
   */
  logger: AuthLogger;
}

// Floor below which an explicitly configured PBKDF2 work factor is treated as
// dangerously weak. The secure default (600k, see auth.ts) is well above this;
// this only catches a consumer deliberately lowering it in production.
const MIN_SAFE_PBKDF2_ITERATIONS = 100_000;

/**
 * Fill in secure brute-force defaults and warn on unsafe production configs.
 *
 * The defaults themselves live in `security-defaults.ts` and are applied by the
 * same accessors the handlers read through, so this function decides nothing a
 * handler could disagree with — it materializes the resolved values onto the
 * config (so a consumer can inspect what they got) and emits the warnings that
 * need a logger and a single wiring moment.
 *
 * - **Rate limits**: every key in `AuthConfig.rateLimit` gets a default unless
 *   explicitly configured. `rateLimit: null` is the deliberate opt-out and is
 *   warned about in a production config. A `rateLimit` object that configures
 *   *some* endpoints is a merge, never a replacement — the trap where
 *   `rateLimit: { register }` left login completely unprotected.
 * - **Lockout** (account-level, carries a lock-out-DoS trade-off): defaulted
 *   only when the consumer engaged with brute-force config *not at all* (no
 *   `rateLimit` **and** no `lockout`). A consumer who configured rate-limiting
 *   has clearly engaged with the defense, so we respect an omitted lockout
 *   rather than imposing the DoS-prone mechanism on them.
 * - Either field set explicitly to `null` → honoured as opt-out and warned
 *   about in a production config. A rate-limit opt-out is kept as `null` on the
 *   resolved config (see `resolveRateLimits` on why that one has to be); the
 *   lockout keeps `undefined`.
 * - A production config that still ends up with no login protection at all
 *   (only reachable via `rateLimit: null`) is warned about loudly.
 *
 * Returns a new config object — the caller's input is not mutated.
 */
function resolveSecurityDefaults<R extends string>(
  config: AuthConfig<R>,
  logger: AuthLogger
): AuthConfig<R> {
  const isProduction = isSecureDeployment(config);
  const resolved: AuthConfig<R> = {
    ...config,
    rateLimit: resolveRateLimits(config),
    lockout: lockoutFor(config)
  };

  if (isProduction && config.rateLimit === null) {
    logger.warn(
      '[auth] config.rateLimit is explicitly null in a production config (no cookieSecure: false anywhere) — auth handlers are not rate-limited. Set config.rateLimit.login or accept this opt-out deliberately.'
    );
  }
  if (isProduction && config.lockout === null) {
    logger.warn(
      '[auth] config.lockout is explicitly null in a production config — repeated failed logins will not lock the account.'
    );
  }

  if (isProduction && !resolved.rateLimit?.login && !resolved.lockout) {
    logger.warn(
      '[auth] No login rate-limit or lockout is active in a production config — login is exposed to brute force. Configure config.rateLimit.login and/or config.lockout.'
    );
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

  const minLength = config.password?.minLength;
  if (minLength !== undefined && !isValidMinLength(minLength)) {
    // `resolvePasswordPolicy` corrects it to the default so the server check
    // and the client checklist stay in step; say so, or the correction is
    // silent and the deployment believes it configured something.
    logger.warn(
      `[auth] config.password.minLength is ${String(minLength)} — not a finite, non-negative number. Falling back to ${DEFAULT_PASSWORD_POLICY.minLength}.`
    );
  }

  return resolved;
}

/**
 * Fail loud at wiring time when a feature is configured but its backing
 * repository is absent, instead of degrading silently at request time. The case
 * it covers is refresh-token rotation: with `config.refreshToken` set but
 * `repos.refreshToken` missing, `establishSession` would skip the refresh cookie
 * and the handle hook would decline to rotate — both without a trace, quietly
 * downgrading every session to access-token-only. Throwing here mirrors
 * `createPasskeyHandlers` (throws on a missing `repos.passkey`) and follows the
 * fail-loud-over-silent-fallback line.
 *
 * Reached from three call paths: both wiring entry points via
 * {@link assertAuthConfigValid}, and `establishSession` itself, which a consumer
 * can call directly with a hand-built `AuthDeps`.
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
 * Every wiring-time config check, in one call. `createAuthDeps` (the handler
 * bundle) and `createAuthHandle` (the hook) are wired independently and either
 * can be reached first, so both must validate — and each additional check used
 * to have to be remembered in both places. One door instead of three per entry
 * point: a new check is added here and both paths get it.
 *
 * Fails fast — the first throwing check wins, so a config with several problems
 * surfaces them one deploy at a time.
 */
export function assertAuthConfigValid<R extends string>(
  config: AuthConfig<R>,
  repos: { refreshToken?: RefreshTokenRepository },
  logger: AuthLogger
): void {
  assertReposMatchConfig(config, repos);
  assertJwtConfigValid(config.jwt, logger);
  // The other two writable cookies' SameSite/Secure pair. The session cookie's
  // is checked inside assertJwtConfigValid; these have no JwtConfig to ride on.
  // `useHostPrefix` force-sets Secure on the CSRF cookie, so it is passed as the
  // effective value (see ensureCsrfCookie).
  if (config.csrf) {
    assertCookieSameSiteSecure(
      'csrf',
      config.csrf.cookieSameSite,
      config.csrf.useHostPrefix === true ? true : config.csrf.cookieSecure
    );
  }
  if (config.refreshToken) {
    assertCookieSameSiteSecure(
      'refreshToken',
      config.refreshToken.cookieSameSite,
      config.refreshToken.cookieSecure
    );
  }
  const disagreement = describeCookieSecureDisagreement(config);
  if (disagreement) logger.warn(disagreement);
}

/**
 * Assemble the auth dependency bundle, applying secure brute-force defaults to
 * the config (see {@link resolveSecurityDefaults}). The returned `config`
 * carries the resolved values — pass it on to `createAuthHandle` and the
 * handler factories so the whole app shares one resolved config.
 */
export function createAuthDeps<R extends string>(deps: Omit<AuthDeps<R>, 'logger'>): AuthDeps<R> {
  // One source for the sink: `config.logger`. The resolved field on the deps
  // bundle is what handlers use, so none of them re-defaults to console.
  const logger = shieldLogger(deps.config.logger ?? console);
  assertAuthConfigValid(deps.config, deps.repos, logger);
  return { ...deps, logger, config: resolveSecurityDefaults(deps.config, logger) };
}
