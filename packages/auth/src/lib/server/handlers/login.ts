import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword, verifyPasswordWithMigration } from '../password.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { createPending2faToken, setPending2faCookie } from '../two-factor.js';
import { validateLoginInput } from '../validation.js';
import { notifyHook, parseBody } from './_shared.js';
import { authError } from './errors.js';

// A throwaway password used only to build the dummy hash for timing
// equalization. Its value is irrelevant — the verify result is always
// discarded — it just needs to be valid input to `hashPassword`.
const DUMMY_VERIFY_PASSWORD = 'urbicon-auth-timing-equalization-dummy';

export function createLoginHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.login);

  // Lazily built once per handler: a PBKDF2 hash at the configured work factor
  // that a "user not found" request verifies against, so a missing account
  // costs the same CPU as a wrong password. Without it, an attacker can tell
  // registered emails apart by timing (no-PBKDF2 ≈ instant vs a real
  // ~600k-iteration verify). The first !user request pays a one-time extra hash
  // to build it; every later one matches a real verify's cost.
  let dummyHashPromise: Promise<string> | undefined;
  const dummyHash = () =>
    (dummyHashPromise ??= hashPassword(DUMMY_VERIFY_PASSWORD, deps.config.password));

  return {
    POST: async (event) => {
      const { request, cookies, getClientAddress } = event;
      const limited = await enforceRateLimit(
        rateLimiter,
        getClientAddress(),
        'Too many login attempts. Please try again later.'
      );
      if (limited) return limited;

      const body = await parseBody(request, validateLoginInput);
      if (body instanceof Response) return body;
      const { email, password } = body.data;

      const user = await deps.repos.user.findByEmail(email);
      if (!user) {
        // Timing equalization (Finding M6): run a real PBKDF2 verify against a
        // throwaway hash and discard the result, so a non-existent account
        // isn't measurably faster to reject than a wrong password. This closes
        // the dominant channel (the ~600k-iteration PBKDF2, tens of ms).
        //
        // A second-order residual remains: the existing-user path also does the
        // lockout read (getFailedLoginAttempts) and a recordFailedLogin write,
        // which have no counterpart here. Those are sub-millisecond indexed ops
        // dwarfed by the PBKDF2 cost and network jitter, and the login rate
        // limiter (default 5 / 15 min) throttles sampling — fully faking DB ops
        // for a non-existent row would add fragility for no real gain, so we
        // accept this deliberately.
        await verifyPasswordWithMigration(password, await dummyHash(), deps.config.password);
        await deps.config.hooks?.onLoginFailed?.(email, 'user_not_found');
        return authError('invalid_credentials', 401);
      }

      // Lockout check (refuse before doing the expensive PBKDF2 verify).
      // Normalize the explicit-opt-out null to undefined for the repo call.
      const lockout = deps.config.lockout ?? undefined;
      if (lockout) {
        const attempts = await deps.repos.user.getFailedLoginAttempts(user.id);
        if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
          return authError('account_locked', 423);
        }
      }

      const result = await verifyPasswordWithMigration(
        password,
        user.passwordHash,
        deps.config.password
      );
      if (!result.valid) {
        await deps.repos.user.recordFailedLogin(user.id, lockout);
        await deps.config.hooks?.onLoginFailed?.(email, 'invalid_password');
        return authError('invalid_credentials', 401);
      }

      // Transparent rehash: bcrypt → PBKDF2, or upgrade iteration count
      if (result.needsRehash) {
        const newHash = await hashPassword(password, deps.config.password);
        await deps.repos.user.updatePassword(user.id, newHash);
      }

      // Reset failed login attempts on success
      await deps.repos.user.resetFailedLogins(user.id);

      // 2FA gate: the password is correct, but if the account has TOTP enabled
      // we must NOT establish a session yet. Gate on `totpEnabled` ALONE (not on
      // config.twoFactor): a user who enrolled must never be let in on the
      // password step even if the consumer later misconfigured `twoFactor`
      // (fail-closed — no 2FA bypass). Issue a short-lived pending cookie and
      // ask the client to POST the code to the verify handler. No session
      // cookie, no refresh cookie, and onLoginSuccess fires only after verify.
      if (user.totpEnabled) {
        const pendingToken = await createPending2faToken(user.id, deps.config);
        setPending2faCookie(cookies, pendingToken, deps.config);
        return json({ twoFactorRequired: true });
      }

      // Access token (short-lived when refreshToken config is set) +
      // optional rotating refresh cookie, tagged with the device metadata so
      // the session shows up recognisably in the session list.
      await establishSession(
        cookies,
        user,
        deps.config,
        deps.repos,
        resolveSessionMeta(event, deps.config)
      );

      const safeUser = sanitizeUser(user);
      // Post-commit: the session cookie is set and the failure counter reset.
      await notifyHook(deps, 'login', 'onLoginSuccess', safeUser);

      return json({ user: safeUser });
    }
  };
}
