import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { LockoutConfig } from '../../types.js';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword, verifyPasswordWithMigration } from '../password.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { failedLoginLock, lockoutFor } from '../security-defaults.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { createPending2faToken, setPending2faCookie } from '../two-factor.js';
import { validateLoginInput } from '../validation.js';
import { notifyHook, parseBody } from './_shared.js';
import { authError } from './errors.js';

// A throwaway password used only to build the dummy hash for timing
// equalization. Its value is irrelevant — the verify result is always
// discarded — it just needs to be valid input to `hashPassword`.
const DUMMY_VERIFY_PASSWORD = 'urbicon-auth-timing-equalization-dummy';

/**
 * Whether the failed-login count has gone stale — its last failure is at least
 * `decayMinutes` old, so it describes a past episode rather than an attack in
 * progress.
 *
 * `lastFailedAt` is the only evidence for the count's age, so anything that is
 * not a usable date (an adapter that does not track the column, a cleared
 * counter) means "cannot tell" and answers `false`: no decay, the counter keeps
 * its pre-decay meaning. Reading it as decayed instead would discard the count
 * of every adapter that leaves the field null.
 */
function attemptsDecayed(
  lastFailedAt: Date | null,
  lockout: Required<LockoutConfig>,
  now: number
): boolean {
  if (!(lastFailedAt instanceof Date)) return false;
  // An `Invalid Date` needs no branch of its own: its age is NaN, and every
  // comparison against NaN is false, so it lands on "cannot tell" as well.
  return now - lastFailedAt.getTime() >= lockout.decayMinutes * 60_000;
}

export function createLoginHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'login');

  // A decay window of zero fails OPEN, and completely: `now - lastFailedAt >= 0`
  // holds for every stored timestamp, so every attempt resets the counter before
  // it is incremented and the account never locks (measured: 30 wrong passwords
  // in a row, no lock, counter back at 1). `0` is also exactly what an operator
  // writes to mean "no decay", so accepting it silently would turn an attempt to
  // tighten the policy into switching the lockout off. Refuse it at wiring time,
  // the way `invitationTtlMs` refuses a non-positive TTL: "no decay" is not a
  // supported configuration, and running without a lockout is `lockout: null`.
  const decayMinutes = deps.config.lockout?.decayMinutes;
  if (decayMinutes !== undefined && (!Number.isFinite(decayMinutes) || decayMinutes <= 0)) {
    throw new Error(
      `[auth] lockout.decayMinutes must be a positive finite number of minutes, got ${decayMinutes}. ` +
        'A zero, negative or non-finite window resets the failed-login counter on every attempt, ' +
        'which disables the lockout entirely. To run without a lockout, set config.lockout to null.'
    );
  }

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
        // Audit-only, and the response is a rejection either way: a broken
        // sink must not turn the 401 into a 500 the user reads as retryable.
        await notifyHook(
          deps,
          { site: 'login', subject: null },
          'onLoginFailed',
          email,
          'user_not_found'
        );
        return authError('invalid_credentials', 401);
      }

      // Lockout check (refuse before doing the expensive PBKDF2 verify).
      // Read through the accessor, not off the config: a hand-built AuthDeps
      // never passed resolveSecurityDefaults, and this is the only brake it
      // would otherwise be missing.
      const lockout = lockoutFor(deps.config);
      if (lockout) {
        const attempts = await deps.repos.user.getFailedLoginAttempts(user.id);
        const now = Date.now();
        if (attempts.lockedUntil && attempts.lockedUntil > new Date(now)) {
          return authError('account_locked', 423);
        }
        // Decay: a count whose last failure predates the window starts over,
        // so `maxAttempts` typos spread over months no longer lock the account
        // (the counter otherwise falls only on a successful sign-in).
        //
        // Both orderings are load-bearing. AFTER the lock check, because
        // `resetFailedLogins` clears `lockedUntil` too and would end a live lock
        // early (reachable whenever `decayMinutes < durationMinutes`). BEFORE
        // the verify, because a request's own reset must precede its own
        // increment: measured over a 12-fold burst on a stale counter, 12
        // failures land as 12 here and as 1 — with the account left unlocked —
        // once the reset sits in the failure branch below.
        //
        // What this does not do is make the reset safe under concurrency. It is
        // an unconditional write derived from a read that can be arbitrarily old
        // by the time it lands: a reset delayed past other requests' writes
        // erases their increments AND their `lockedUntil` (measured: one held
        // reset wiped five counted failures and a live lock), which is the only
        // path where failing the password check clears a lock. Closing it needs
        // a conditional write — `… WHERE lastFailedLogin < cutoff` — i.e. a new
        // method every adapter author has to implement. Not paid here: the
        // lockout does not bound a simultaneous burst in the first place (every
        // request of one passes the lock check before any of them is counted,
        // pinned below at twelve), so what the race buys is one more burst
        // window, not unbounded guessing.
        if (attempts.count > 0 && attemptsDecayed(attempts.lastFailedAt, lockout, now)) {
          await deps.repos.user.resetFailedLogins(user.id);
        }
      }

      const result = await verifyPasswordWithMigration(
        password,
        user.passwordHash,
        deps.config.password
      );
      if (!result.valid) {
        // The threshold and the lock instant are resolved here, once; the
        // adapter compares and stores them (FailedLoginLock).
        await deps.repos.user.recordFailedLogin(user.id, lockout && failedLoginLock(lockout));
        // recordFailedLogin above has already counted this attempt, so a 500
        // here would spend lockout budget while hiding the reason for it.
        await notifyHook(
          deps,
          { site: 'login', subject: user.id },
          'onLoginFailed',
          email,
          'invalid_password'
        );
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
      await notifyHook(deps, { site: 'login', subject: user.id }, 'onLoginSuccess', safeUser);

      return json({ user: safeUser });
    }
  };
}
