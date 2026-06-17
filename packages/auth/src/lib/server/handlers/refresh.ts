import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  resolveJwtConfig,
  rotateRefreshToken,
  setRefreshCookie
} from '../refresh-token.js';
import { clearSessionCookie, setSessionCookie } from '../session.js';

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
// Responses carry session state (a freshly minted access token + sanitized
// user) and set new cookies — never let a shared cache store or replay them.
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

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
        return json({ error: 'Refresh tokens are not enabled.' }, { status: 400 });
      }

      const raw = readRefreshCookie(cookies, refreshConfig);
      if (!raw) return json({ error: 'Missing refresh token.' }, { status: 401 });

      const outcome = await rotateRefreshToken(
        refreshRepo,
        raw,
        (id) => deps.repos.user.findById(id),
        refreshConfig
      );

      if (outcome.kind === 'race_ok') {
        // Concurrent-rotation loser: issue a fresh access token but leave
        // the refresh cookie alone; the winner's response already carried
        // the successor cookie into the browser jar.
        const { user } = outcome;
        await setSessionCookie(
          cookies,
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: user.tokenVersion
          },
          resolveJwtConfig(deps.config)
        );
        return json({ user: sanitizeUser(user) }, { headers: NO_STORE });
      }

      if (outcome.kind !== 'rotated') {
        clearRefreshCookie(cookies, refreshConfig);
        clearSessionCookie(cookies, deps.config.jwt);
        return json({ error: 'Invalid refresh token.' }, { status: 401, headers: NO_STORE });
      }

      const { user, token } = outcome;

      await setSessionCookie(
        cookies,
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          tokenVersion: user.tokenVersion
        },
        resolveJwtConfig(deps.config)
      );
      setRefreshCookie(cookies, token, refreshConfig);

      return json({ user: sanitizeUser(user) }, { headers: NO_STORE });
    }
  };
}
