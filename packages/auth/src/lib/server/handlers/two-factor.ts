import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
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
import {
  NO_STORE,
  notifyHook,
  parseBody,
  requireSessionUser,
  verifyCurrentPassword
} from './_shared.js';
import { authError } from './errors.js';

// Users whose unreadable staged secret has been reported. `enable` carries no
// rate limiter (unlike `verify` and `disable`), so one authenticated caller
// would otherwise write into the operator's sink without bound — measured:
// 50 POSTs, 50 lines, no 429. The key is the **user id**, so the cap holds
// however the consumer assembles its config: a set keyed on the config object
// caps nothing for a deployment that rebuilds it per request, and one keyed on
// `encryptionKey` would park key material in a module global for the life of
// the process. One line per affected user caps each caller at one and leaves
// the line count equal to the number of users the rotation reached.
const staleKeyReported = new Set<string>();

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
        // A server-side fault (twoFactor.encryptionKey changed since setup, or
        // corruption), not a bad code — and one nothing else records: authError
        // *returns* a Response instead of throwing `error()`, so SvelteKit's
        // `handleError` never fires and no Sentry event, log line or stack
        // trace exists apart from this call.
        if (!staleKeyReported.has(user.id)) {
          staleKeyReported.add(user.id);
          deps.logger.error(
            `[auth] 2fa-enable: the staged TOTP secret could not be decrypted (user ${user.id}) — twoFactor.encryptionKey does not match the key it was staged with. Further attempts by this user are not logged.`
          );
        }
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
  // target of all, since success removes the second factor.
  // `createAuthDeps` injects a strict default; explicit config tunes it.
  const rateLimiter = sharedLimiter(deps.config, 'twoFactorDisable');

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
  const rateLimiter = sharedLimiter(deps.config, 'twoFactor');

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

      // Report every occurrence here, and do not end the request. Per-occurrence
      // is bounded on this endpoint — it is rate-limited by default and sits
      // behind a valid signed pending-2FA cookie, so a caller reaches at most
      // 10 lines per IP per 15 min before the 429 (measured against the limiter
      // `createAuthDeps` injects). And it must not end the request:
      // a backup code is hashed on its own row and needs no TOTP secret, so an
      // unreadable secret is exactly when the recovery path has to stay open.
      const secret = await decryptSecret(user.totpSecret, config.twoFactor.encryptionKey);
      if (secret === null) {
        deps.logger.error(
          `[auth] 2fa-verify: the stored TOTP secret could not be decrypted (user ${user.id}) — twoFactor.encryptionKey does not match the key it was enrolled with. TOTP codes cannot be checked until that key is restored; backup codes still redeem.`
        );
      }

      // Try the TOTP code first; a non-numeric/wrong code falls through to a
      // single-use backup-code redemption (atomic, owner-scoped). A wrong TOTP
      // can never accidentally burn a backup code — its hash won't match one.
      let verified =
        secret !== null && (await verifyTotp(secret, code, resolveTotpOptions(config.twoFactor)));
      if (!verified) {
        verified = await repos.backupCode.consumeIfUnused(user.id, hashBackupCode(code));
      }
      if (!verified) {
        // An unreadable secret keeps its 500 once the backup code missed too:
        // answering `invalid_code` would tell a user holding a correct TOTP
        // code that the code is wrong, and would hide the fault entirely.
        if (secret === null) return authError('totp_secret_unreadable', 500);
        // Leave the pending cookie in place: the user may retry within the TTL,
        // and the rate limiter (not cookie invalidation) bounds brute force.
        return authError('invalid_code', 401);
      }

      // Success: consume the single-use pending cookie and start the real
      // session (tagged with device metadata for the session list).
      clearPending2faCookie(cookies, config);
      await establishSession(cookies, user, config, repos, resolveSessionMeta(event, config));

      const safeUser = sanitizeUser(user);
      // Post-commit: the session is established and the single-use pending
      // cookie is spent — there is no second attempt to fall back to.
      await notifyHook(deps, { site: 'two-factor', subject: user.id }, 'onLoginSuccess', safeUser);

      return json({ user: safeUser });
    }
  };
}
