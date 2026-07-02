import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { readRefreshCookie, rotateRefreshToken } from '../refresh-token.js';
import { applyRotationOutcome } from '../session.js';
import { NO_STORE } from './_shared.js';
import { authError } from './errors.js';

/**
 * Explicit refresh endpoint. The handle hook already rotates transparently
 * on regular requests; this handler exists for clients that want to force
 * a rotation (e.g. before a long-running operation) or that disable the
 * handle-hook auto-refresh and manage the cycle themselves.
 *
 * Returns `401` whenever the refresh token is missing, expired, revoked,
 * or reused. On success the new access- and refresh-cookies are set and
 * the sanitized user is returned.
 */
export function createRefreshHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.refresh);

  return {
    POST: async ({ cookies, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const refreshConfig = deps.config.refreshToken;
      const refreshRepo = deps.repos.refreshToken;

      if (!refreshConfig || !refreshRepo) {
        return authError('feature_unavailable', 400, {
          message: 'Refresh tokens are not enabled.'
        });
      }

      const raw = readRefreshCookie(cookies, refreshConfig);
      if (!raw) return authError('missing_refresh_token', 401);

      const outcome = await rotateRefreshToken(
        refreshRepo,
        raw,
        (id) => deps.repos.user.findById(id),
        refreshConfig
      );

      // Cookie effects per outcome (rotated/race_ok/terminal) are the same
      // policy the handle hook applies — see applyRotationOutcome.
      const user = await applyRotationOutcome(cookies, outcome, deps.config);
      if (!user) {
        return authError('invalid_refresh_token', 401, { headers: NO_STORE });
      }
      return json({ user: sanitizeUser(user) }, { headers: NO_STORE });
    }
  };
}
