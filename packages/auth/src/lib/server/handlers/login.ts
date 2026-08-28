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
 * The instant a counted failure must be at or before to no longer count: a
 * count whose newest failure is older than `decayMinutes` describes a past
 * episode rather than an attack in progress.
 */
function decayCutoff(lockout: Required<LockoutConfig>, now: number): Date {
  return new Date(now - lockout.decayMinutes * 60_000);
}

/**
 * Whether the failed-login count has gone stale against `cutoff`.
 *
 * `lastFailedAt` is the only evidence for the count's age, so anything that is
 * not a usable date (an adapter that does not track the column, a cleared
 * counter) means "cannot tell" and answers `false`: no decay, the counter keeps
 * its pre-decay meaning. Reading it as decayed instead would discard the count
 * of every adapter that leaves the field null.
 */
function attemptsDecayed(lastFailedAt: Date | null, cutoff: Date): boolean {
  if (!(lastFailedAt instanceof Date)) return false;
  // An `Invalid Date` needs no branch of its own: its time is NaN, and every
  // comparison against NaN is false, so it lands on "cannot tell" as well.
  return lastFailedAt.getTime() <= cutoff.getTime();
}

export function createLoginHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'login');

  // Every lockout value that reads like a policy but switches the lockout off
  // is refused at wiring time, the way `invitationTtlMs` refuses a non-positive
  // TTL: running without a lockout is `lockout: null`, not a number.
  //
  // - A decay window of zero fails OPEN, and completely: `now - lastFailedAt
  //   >= 0` holds for every stored timestamp, so every attempt resets the
  //   counter before it is incremented (measured: 30 wrong passwords, no lock,
  //   counter back at 1). `0` is also what an operator writes to mean "no
  //   decay", so accepting it would turn a tightening into an opt-out.
  // - A duration of zero or less writes a lock that has already expired; NaN
  //   writes an `Invalid Date`. Both measured through the handler: 30 wrong
  //   passwords, 30 × 401, never a 423. The adapter cannot catch it — its
  //   contract is to store `lockedUntil` verbatim.
  // - A threshold of NaN is never reached (30 × 401); zero locks on the first
  //   failure; a fraction is met one attempt early or late.
  const configured = deps.config.lockout ?? {};
  const positiveFinite = (n: number | undefined) =>
    n === undefined || (Number.isFinite(n) && n > 0);
  const optOut = 'To run without a lockout, set config.lockout to null.';
  if (!positiveFinite(configured.decayMinutes)) {
    throw new Error(
      `[auth] lockout.decayMinutes must be a positive finite number of minutes, got ${configured.decayMinutes}. ` +
        'A zero, negative or non-finite window resets the failed-login counter on every attempt, ' +
        `which disables the lockout entirely. ${optOut}`
    );
  }
  if (!positiveFinite(configured.durationMinutes)) {
    throw new Error(
      `[auth] lockout.durationMinutes must be a positive finite number of minutes, got ${configured.durationMinutes}. ` +
        'A zero, negative or non-finite duration writes a lock that has already expired, ' +
        `which disables the lockout entirely. ${optOut}`
    );
  }
  if (
    configured.maxAttempts !== undefined &&
    !(Number.isInteger(configured.maxAttempts) && configured.maxAttempts > 0)
  ) {
    throw new Error(
      `[auth] lockout.maxAttempts must be a positive integer, got ${configured.maxAttempts}. ` +
        `A NaN threshold is never reached and a zero one locks on the first failure. ${optOut}`
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
      const clientAddress = getClientAddress();
      const limited = await enforceRateLimit(
        rateLimiter,
        clientAddress,
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
        // Both orderings are load-bearing. AFTER the lock check, because the
        // reset clears `lockedUntil` too and would end a live lock early
        // (reachable whenever `decayMinutes < durationMinutes`). BEFORE the
        // verify, because a request's own reset must precede its own
        // increment: over a 12-fold burst on a stale counter, 12 failures land
        // as 12 here and as 1 — with the account left unlocked — once the reset
        // sits in the failure branch below.
        //
        // The write is derived from a read that can be arbitrarily old by the
        // time it lands, which is why the reset is the guarded form: the store
        // applies it only where `lastFailedAt` is still at or before the cutoff,
        // so failures counted in between — and the lock they set — survive.
        const cutoff = decayCutoff(lockout, now);
        if (attempts.count > 0 && attemptsDecayed(attempts.lastFailedAt, cutoff)) {
          await deps.repos.user.resetFailedLoginsIfStale(user.id, cutoff);
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
      // The same rule on the IP axis: the limiter brakes attempts against a
      // password, not people, so a correct one hands back the slot its request
      // took. Counted at the top and refunded here, rather than counted only on
      // failure, because a count after the verify would let every request run
      // PBKDF2 before the brake. Refund, not reset: a reset would let anyone
      // holding one valid account — his own — clear the address's budget
      // between guesses at other accounts, and the per-account lockout does
      // not see a spray of one guess per account. Measured: twenty correct
      // logins behind one address are twenty 200s, and four failures plus a
      // success still leave one failure in the window (login.test.ts).
      await rateLimiter?.refund(clientAddress);

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
