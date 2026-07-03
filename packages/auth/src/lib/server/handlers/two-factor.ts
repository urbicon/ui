import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import {
  buildOtpauthUri,
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  verifyTotp
} from '../totp.js';
import {
  clearPending2faCookie,
  generateBackupCodes,
  hashBackupCode,
  readPending2faCookie,
  resolveBackupCodeCount,
  resolveIssuer,
  resolveTotpOptions,
  verifyPending2faToken
} from '../two-factor.js';
import { validateDisable2faInput, validateTotpInput } from '../validation.js';
import { NO_STORE, parseBody, requireSessionUser, verifyCurrentPassword } from './_shared.js';
import { authError } from './errors.js';

/**
 * The TOTP two-factor route group — one bundled factory (the package's
 * multi-route convention). Mount the groups on the paths the client components
 * call (`<TwoFactorManager>` talks to `setup`/`enable`/`disable` under its
 * `apiPath`, default `/api/auth/account/2fa`; the auth store's login flow
 * posts to `verify`):
 *
 * ```ts
 * const twoFactor = createTwoFactorHandlers(deps);
 * // …/2fa/setup/+server.ts   → export const POST = twoFactor.setup.POST;
 * // …/2fa/enable/+server.ts  → export const POST = twoFactor.enable.POST;
 * // …/2fa/disable/+server.ts → export const POST = twoFactor.disable.POST;
 * // …/2fa/verify/+server.ts  → export const POST = twoFactor.verify.POST;
 * ```
 *
 * - `setup` (authenticated) — begin enrolment: stage an **encrypted** secret
 *   (2FA not yet active) and return the `otpauth://` URI + Base32 secret.
 *   Refuses when already enabled, so a hijacked session can't silently
 *   re-enrol a new device.
 * - `enable` (authenticated) — `{ code }` proves possession against the staged
 *   secret, flips `totpEnabled` on and returns the backup codes (**once**, in
 *   plaintext). The old code set is cleared first.
 * - `disable` (authenticated, re-auth) — `{ currentPassword }` gates turning
 *   2FA off; clears the secret + every backup code. Rate-limited by default
 *   (`rateLimit.twoFactorDisable`) — success removes the second factor.
 * - `verify` (UNauthenticated) — the second login step: reads the short-lived
 *   pending-2FA cookie set by the login handler, accepts a TOTP **or** backup
 *   code, and establishes the real session. Strictly rate-limited.
 */
export function createTwoFactorHandlers<R extends string>(
  deps: AuthDeps<R>
): {
  setup: { POST: RequestHandler };
  enable: { POST: RequestHandler };
  disable: { POST: RequestHandler };
  verify: { POST: RequestHandler };
} {
  return {
    setup: setupHandler(deps),
    enable: enableHandler(deps),
    disable: disableHandler(deps),
    verify: verifyHandler(deps)
  };
}

function setupHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const { config, repos } = deps;
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return authError('not_authenticated', 401, { headers: NO_STORE });

      if (!config.twoFactor) {
        return authError('feature_unavailable', 400, {
          message: 'Two-factor is not available.',
          headers: NO_STORE
        });
      }
      if (user.totpEnabled) {
        return authError('two_factor_already_enabled', 400, { headers: NO_STORE });
      }

      const secret = generateTotpSecret();
      await repos.user.setTotpSecret(
        user.id,
        await encryptSecret(secret, config.twoFactor.encryptionKey)
      );

      const otpauthUri = buildOtpauthUri({
        issuer: resolveIssuer(config),
        label: user.email,
        secret,
        ...resolveTotpOptions(config.twoFactor)
      });

      return json({ secret, otpauthUri }, { headers: NO_STORE });
    }
  };
}

function enableHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const { config, repos } = deps;
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return authError('not_authenticated', 401, { headers: NO_STORE });

      if (!config.twoFactor || !repos.backupCode) {
        return authError('feature_unavailable', 400, {
          message: 'Two-factor is not available.',
          headers: NO_STORE
        });
      }
      if (user.totpEnabled) {
        return authError('two_factor_already_enabled', 400, { headers: NO_STORE });
      }
      if (!user.totpSecret) {
        return authError('two_factor_setup_required', 400, { headers: NO_STORE });
      }

      const body = await parseBody(event.request, validateTotpInput, { headers: NO_STORE });
      if (body instanceof Response) return body;

      const secret = await decryptSecret(user.totpSecret, config.twoFactor.encryptionKey);
      if (secret === null) {
        // The stored secret can't be decrypted (encryptionKey changed since
        // setup, or corruption) — a server-side fault, not a bad code.
        return authError('totp_secret_unreadable', 500, { headers: NO_STORE });
      }

      const valid = await verifyTotp(secret, body.data.code, resolveTotpOptions(config.twoFactor));
      if (!valid) {
        return authError('invalid_code', 400, { headers: NO_STORE });
      }

      // Issue backup codes BEFORE flipping the flag: if the flag write fails the
      // user simply re-enables (deleteAll clears these first). Clearing first
      // guarantees no stale, still-redeemable codes survive a re-enrol.
      const { plain, hashes } = generateBackupCodes(resolveBackupCodeCount(config.twoFactor));
      await repos.backupCode.deleteAll(user.id);
      await repos.backupCode.createMany(user.id, hashes);
      await repos.user.enableTotp(user.id);

      return json({ backupCodes: plain }, { headers: NO_STORE });
    }
  };
}

function disableHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  // Re-auth endpoints are credential-accepting: without a limiter a hijacked
  // session could brute-force the current password here — at the most valuable
  // target of all, since success removes the second factor (review R4).
  // `createAuthDeps` injects a strict default; explicit config tunes it.
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.twoFactorDisable);

  return {
    POST: async (event) => {
      const { repos } = deps;
      const limited = await enforceRateLimit(rateLimiter, event.getClientAddress());
      if (limited) return limited;

      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return authError('not_authenticated', 401);

      const body = await parseBody(event.request, validateDisable2faInput);
      if (body instanceof Response) return body;

      // Re-auth before removing a security factor.
      if (!(await verifyCurrentPassword(user, body.data.currentPassword, deps))) {
        return authError('current_password_incorrect', 403);
      }

      // Disable first (the security-relevant write), then clear backup codes.
      // If the code cleanup fails the codes are orphaned but unredeemable — the
      // verify path is gated on totpEnabled — so log and still report success.
      await repos.user.disableTotp(user.id);
      try {
        await repos.backupCode?.deleteAll(user.id);
      } catch (err) {
        deps.logger.error(
          `[auth] 2fa-disable: failed to clear backup codes (user ${user.id})`,
          err
        );
      }

      return json({ success: true });
    }
  };
}

// A wrong code does NOT consume the pending cookie (the user retries within
// the TTL); a correct one does (single-use).
function verifyHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.twoFactor);

  return {
    POST: async (event) => {
      const { config, repos } = deps;
      const { cookies, getClientAddress } = event;

      // Rate-limit FIRST — this is the brute-force surface.
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      if (!config.twoFactor || !repos.backupCode) {
        return authError('feature_unavailable', 400, { message: 'Two-factor is not available.' });
      }

      const pending = readPending2faCookie(cookies, config);
      if (!pending) {
        return authError('no_2fa_challenge', 400);
      }

      const userId = await verifyPending2faToken(pending, config);
      if (!userId) {
        // Expired or forged — drop the dead cookie so the client restarts login.
        clearPending2faCookie(cookies, config);
        return authError('two_factor_challenge_expired', 400);
      }

      const user = await repos.user.findById(userId);
      if (!user?.totpEnabled || !user.totpSecret) {
        // The user vanished or 2FA was disabled since the password step — the
        // pending cookie is meaningless now.
        clearPending2faCookie(cookies, config);
        return authError('two_factor_challenge_expired', 400);
      }

      const body = await parseBody(event.request, validateTotpInput);
      if (body instanceof Response) return body;
      const code = body.data.code;

      const secret = await decryptSecret(user.totpSecret, config.twoFactor.encryptionKey);
      if (secret === null) {
        return authError('totp_secret_unreadable', 500);
      }

      // Try the TOTP code first; a non-numeric/wrong code falls through to a
      // single-use backup-code redemption (atomic, owner-scoped). A wrong TOTP
      // can never accidentally burn a backup code — its hash won't match one.
      let verified = await verifyTotp(secret, code, resolveTotpOptions(config.twoFactor));
      if (!verified) {
        verified = await repos.backupCode.consumeIfUnused(user.id, hashBackupCode(code));
      }
      if (!verified) {
        // Leave the pending cookie in place: the user may retry within the TTL,
        // and the rate limiter (not cookie invalidation) bounds brute force.
        return authError('invalid_code', 401);
      }

      // Success: consume the single-use pending cookie and start the real
      // session (tagged with device metadata for the session list).
      clearPending2faCookie(cookies, config);
      await establishSession(cookies, user, config, repos, resolveSessionMeta(event, config));

      const safeUser = sanitizeUser(user);
      await config.hooks?.onLoginSuccess?.(safeUser);

      return json({ user: safeUser });
    }
  };
}
