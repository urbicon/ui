import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthDeps } from '../deps.js';
import { hashPassword, validatePasswordStrength } from '../password.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { validateChangePasswordInput } from '../validation.js';
import { notifyHook, parseBody, requireSessionUser, verifyCurrentPassword } from './_shared.js';
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

      const body = await parseBody(request, validateChangePasswordInput);
      if (body instanceof Response) return body;
      const { currentPassword, newPassword } = body.data;

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

      // Post-commit: the password is already changed and every other session
      // already dropped.
      await notifyHook(
        deps,
        { site: 'change-password', subject: user.id },
        'onPasswordChanged',
        user.id
      );

      return json({ success: true });
    }
  };
}
