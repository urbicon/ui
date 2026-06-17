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
import { readJsonBody, validateDisable2faInput, validateTotpInput } from '../validation.js';
import { requireSessionUser, verifyCurrentPassword } from './_shared.js';

// The 2FA setup/enable response carries the secret/codes the user must capture
// once — never let a shared cache store it (same rationale as the `me` endpoint).
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * POST — begin TOTP enrolment (authenticated). Generates a fresh secret, stores
 * it **encrypted** with `totpEnabled` still false, and returns the `otpauth://`
 * URI + Base32 secret for the user's authenticator app. 2FA is NOT active until
 * the user proves possession via {@link createTwoFactorEnableHandler}. Refuses
 * if 2FA is already enabled (disable first) so an attacker on a hijacked session
 * can't silently re-enrol a new device.
 */
export function createTwoFactorSetupHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const { config, repos } = deps;
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return json({ error: 'Not authenticated.' }, { status: 401, headers: NO_STORE });

      if (!config.twoFactor) {
        return json({ error: 'Two-factor is not available.' }, { status: 400, headers: NO_STORE });
      }
      if (user.totpEnabled) {
        return json(
          { error: 'Two-factor is already enabled.' },
          { status: 400, headers: NO_STORE }
        );
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

/**
 * POST `{ code }` — finish enrolment by verifying a code against the staged
 * secret, then flip `totpEnabled` on and issue backup codes (returned **once**,
 * in plaintext). Requires a prior setup. The old code set is cleared before the
 * new one is written so re-enabling never leaves redeemable stale codes.
 */
export function createTwoFactorEnableHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const { config, repos } = deps;
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return json({ error: 'Not authenticated.' }, { status: 401, headers: NO_STORE });

      if (!config.twoFactor || !repos.backupCode) {
        return json({ error: 'Two-factor is not available.' }, { status: 400, headers: NO_STORE });
      }
      if (user.totpEnabled) {
        return json(
          { error: 'Two-factor is already enabled.' },
          { status: 400, headers: NO_STORE }
        );
      }
      if (!user.totpSecret) {
        return json({ error: 'Start two-factor setup first.' }, { status: 400, headers: NO_STORE });
      }

      const input = validateTotpInput(await readJsonBody(event.request));
      if (!input.success) {
        return json(
          { error: input.errors[0].message, errors: input.errors },
          { status: 400, headers: NO_STORE }
        );
      }

      const secret = await decryptSecret(user.totpSecret, config.twoFactor.encryptionKey);
      if (secret === null) {
        // The stored secret can't be decrypted (encryptionKey changed since
        // setup, or corruption) — a server-side fault, not a bad code.
        return json(
          { error: 'Could not read the stored secret.' },
          { status: 500, headers: NO_STORE }
        );
      }

      const valid = await verifyTotp(secret, input.data.code, resolveTotpOptions(config.twoFactor));
      if (!valid) {
        return json({ error: 'Invalid code.' }, { status: 400, headers: NO_STORE });
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

/**
 * POST `{ currentPassword }` — turn 2FA off. Re-auth gated (password), then
 * clears the secret + every backup code. Idempotent: disabling when already off
 * still re-auths and no-ops the clears.
 */
export function createTwoFactorDisableHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const { repos } = deps;
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

      const input = validateDisable2faInput(await readJsonBody(event.request));
      if (!input.success) {
        return json({ error: input.errors[0].message, errors: input.errors }, { status: 400 });
      }

      // Re-auth before removing a security factor.
      if (!(await verifyCurrentPassword(user, input.data.currentPassword, deps))) {
        return json({ error: 'Current password is incorrect.' }, { status: 403 });
      }

      // Disable first (the security-relevant write), then clear backup codes.
      // If the code cleanup fails the codes are orphaned but unredeemable — the
      // verify path is gated on totpEnabled — so log and still report success.
      await repos.user.disableTotp(user.id);
      try {
        await repos.backupCode?.deleteAll(user.id);
      } catch (err) {
        console.error(`[auth] 2fa-disable: failed to clear backup codes (user ${user.id})`, err);
      }

      return json({ success: true });
    }
  };
}

/**
 * POST `{ code }` — the second login step. UNauthenticated: it reads the
 * short-lived pending-2FA cookie (set by the login handler), not a session. On a
 * valid TOTP **or** backup code it consumes the pending cookie and establishes
 * the real session. Strictly rate-limited — a 6-digit code is brute-forceable.
 * A wrong code does NOT consume the pending cookie (the user retries within the
 * TTL); a correct one does (single-use).
 */
export function createTwoFactorVerifyHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.twoFactor);

  return {
    POST: async (event) => {
      const { config, repos } = deps;
      const { cookies, getClientAddress } = event;

      // Rate-limit FIRST — this is the brute-force surface.
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      if (!config.twoFactor || !repos.backupCode) {
        return json({ error: 'Two-factor is not available.' }, { status: 400 });
      }

      const pending = readPending2faCookie(cookies, config);
      if (!pending) {
        return json({ error: 'No pending two-factor challenge.' }, { status: 400 });
      }

      const userId = await verifyPending2faToken(pending, config);
      if (!userId) {
        // Expired or forged — drop the dead cookie so the client restarts login.
        clearPending2faCookie(cookies, config);
        return json(
          { error: 'Two-factor challenge expired. Please sign in again.' },
          { status: 400 }
        );
      }

      const user = await repos.user.findById(userId);
      if (!user?.totpEnabled || !user.totpSecret) {
        // The user vanished or 2FA was disabled since the password step — the
        // pending cookie is meaningless now.
        clearPending2faCookie(cookies, config);
        return json(
          { error: 'Two-factor challenge expired. Please sign in again.' },
          { status: 400 }
        );
      }

      const input = validateTotpInput(await readJsonBody(event.request));
      if (!input.success) {
        return json({ error: input.errors[0].message, errors: input.errors }, { status: 400 });
      }
      const code = input.data.code;

      const secret = await decryptSecret(user.totpSecret, config.twoFactor.encryptionKey);
      if (secret === null) {
        return json({ error: 'Could not read the stored secret.' }, { status: 500 });
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
        return json({ error: 'Invalid code.' }, { status: 401 });
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
