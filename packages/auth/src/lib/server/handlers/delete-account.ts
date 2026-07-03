import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { endSession } from '../session.js';
import { validateDeleteAccountInput } from '../validation.js';
import { parseBody, requireSessionUser, verifyCurrentPassword } from './_shared.js';
import { authError } from './errors.js';

/**
 * Self-service account deletion (GDPR erasure, hard-delete). Re-auth gated. The
 * `onBeforeAccountDelete` hook fires *before* the row is removed so the consumer can
 * archive; a throwing hook aborts the deletion (fail-closed).
 */
export function createDeleteAccountHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.deleteAccount);

  return {
    POST: async ({ request, cookies, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const user = await requireSessionUser(deps, cookies);
      if (!user) return authError('not_authenticated', 401);

      const body = await parseBody(request, validateDeleteAccountInput);
      if (body instanceof Response) return body;
      const { currentPassword } = body.data;

      // Re-auth before an irreversible delete.
      if (!(await verifyCurrentPassword(user, currentPassword, deps))) {
        return authError('current_password_incorrect', 403);
      }

      // Archive hook BEFORE the row is gone. A throw aborts the deletion
      // (fail-closed: don't erase if the consumer's archiving failed). The hook
      // and the delete are NOT one transaction — if the hook succeeds but the
      // delete then throws, the request 500s with the row intact and the hook
      // re-runs on retry, so the consumer's handler must be idempotent (see the
      // onBeforeAccountDelete contract in AuthConfig).
      await deps.config.hooks?.onBeforeAccountDelete?.(sanitizeUser(user));

      await deps.repos.user.delete(user.id);

      // Clear this device's cookies. Every other session dies on its next
      // request — the handle hook / `me` load the (now-missing) user row and
      // 401 — and orphaned refresh tokens can't rotate (rotation rejects a token
      // whose user is gone), so no explicit family revoke is needed here.
      endSession(cookies, deps.config);

      return json({ success: true });
    }
  };
}
