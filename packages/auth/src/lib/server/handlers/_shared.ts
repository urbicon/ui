import type { Cookies } from '@sveltejs/kit';
import type { JwtConfig } from '../../types.js';
import type { FullAuthUser, UserRepository } from '../adapters/types.js';
import { verifyPasswordWithMigration } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { getSessionFromCookie } from '../session.js';

/**
 * Resolve the authenticated user behind the request's session cookie, or
 * `null` when there is no valid session. This is the shared building block for
 * every authenticated handler (`me`, account management, sessions, 2FA): it
 * performs the exact three checks `me` established —
 *
 *   1. a session cookie is present and its JWT verifies,
 *   2. the referenced user still exists,
 *   3. the cookie's `tokenVersion` still equals the row's (server-side
 *      invalidation: a bumped version refuses an otherwise-valid access cookie).
 *
 * Returns the **full** user row (password hash + security columns) so a caller
 * that needs to re-authenticate ({@link verifyCurrentPassword}) or mutate the
 * account has it without a second read. Always run the result through
 * `sanitizeUser` before returning anything to the client.
 *
 * The parameter type is structurally minimal (`config.jwt` + `repos.user`)
 * rather than the full `AuthDeps`, so handler families with narrower deps —
 * the passkey handlers carry `authConfig` + a passkey/user repo pair — can
 * share this single resolution path instead of reading `locals.user`, whose
 * shape a consumer's `transformUser` hook may change arbitrarily.
 */
export async function requireSessionUser<R extends string>(
  deps: { config: { jwt: JwtConfig }; repos: { user: UserRepository<R> } },
  cookies: Cookies
): Promise<FullAuthUser<R> | null> {
  const session = await getSessionFromCookie<R>(cookies, deps.config.jwt);
  if (!session) return null;

  const user = await deps.repos.user.findById(session.userId);
  if (!user) return null;

  // Strict inequality, not directional: a cookie minted before a password
  // reset / "log out everywhere" (behind the row) and a forged cookie ahead of
  // the row must both be refused.
  if (user.tokenVersion !== session.tokenVersion) return null;

  return user;
}

/**
 * Re-authenticate a known user by their current password — the gate for
 * security-critical actions (change-email, delete-account, 2FA-disable). It
 * reuses the same `verifyPasswordWithMigration` path as login, so a legacy
 * bcrypt hash still verifies, but unlike login it performs **no** side effects:
 * it neither transparently rehashes nor records a failed attempt. Keeping it a
 * pure check means a caller that is about to delete the account — or set a
 * brand-new hash anyway — doesn't trigger a pointless write. Returns `true`
 * iff `password` matches `user.passwordHash`.
 *
 * Passkey-only accounts are out of scope for now: every user created through
 * this package has a password set at registration, so a password re-auth always
 * applies. Passkey-based re-auth is noted as a later iteration in the roadmap.
 */
export async function verifyCurrentPassword<R extends string>(
  user: FullAuthUser<R>,
  password: string,
  deps: AuthDeps<R>
): Promise<boolean> {
  const result = await verifyPasswordWithMigration(
    password,
    user.passwordHash,
    deps.config.password
  );
  return result.valid;
}
