import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { hashPassword, validatePasswordStrength } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { readJsonBody, validateChangePasswordInput } from '../validation.js';
import { requireSessionUser, verifyCurrentPassword } from './_shared.js';
import { authError } from './errors.js';

/**
 * Authenticated password change. Re-auth (current password) is required, the
 * new password must pass the configured strength policy, and on success every
 * *other* session is invalidated while the current device stays signed in.
 */
export function createChangePasswordHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.changePassword);

  return {
    POST: async (event) => {
      const { request, cookies, getClientAddress } = event;
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const user = await requireSessionUser(deps, cookies);
      if (!user) return authError('not_authenticated', 401);

      const input = validateChangePasswordInput(await readJsonBody(request));
      if (!input.success) {
        return authError('validation_error', 400, {
          message: input.errors[0].message,
          extra: { errors: input.errors }
        });
      }
      const { currentPassword, newPassword } = input.data;

      // Re-auth: confirm the current password before allowing the change.
      if (!(await verifyCurrentPassword(user, currentPassword, deps))) {
        return authError('current_password_incorrect', 403);
      }

      const passwordErrors = validatePasswordStrength(newPassword, deps.config.password);
      if (passwordErrors.length > 0) {
        return authError('validation_error', 400, {
          message: passwordErrors[0],
          extra: { errors: passwordErrors }
        });
      }

      const newHash = await hashPassword(newPassword, deps.config.password);
      await deps.repos.user.updatePassword(user.id, newHash);

      // Invalidate every existing session: the tokenVersion bump refuses stale
      // access cookies and every refresh family is revoked, so a stolen
      // pre-change refresh cookie cannot mint fresh tokens. This is the same
      // teardown reset-password does — but because a voluntary change isn't a
      // compromise, we immediately re-establish THIS device's session with the
      // bumped version so the user stays signed in here while all others drop.
      await deps.repos.user.incrementTokenVersion(user.id);
      await deps.repos.refreshToken?.revokeAllForUser(user.id);

      // Re-read so establishSession mints the new access cookie with the bumped
      // tokenVersion (our local `user` snapshot still holds the pre-bump value).
      const refreshed = await deps.repos.user.findById(user.id);
      if (refreshed)
        await establishSession(
          cookies,
          refreshed,
          deps.config,
          deps.repos,
          resolveSessionMeta(event, deps.config)
        );

      // Post-commit notification: the password is already changed, so a throwing
      // hook must not turn a successful change into a 500. Catch and log.
      try {
        await deps.config.hooks?.onPasswordChanged?.(user.id);
      } catch (err) {
        deps.logger.error(
          `[auth] change-password: onPasswordChanged hook threw (user ${user.id})`,
          err
        );
      }

      return json({ success: true });
    }
  };
}
