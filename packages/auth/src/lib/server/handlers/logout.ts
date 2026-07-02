import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthDeps } from '../deps.js';
import { revokeRefreshFromCookie } from '../refresh-token.js';
import { endSession } from '../session.js';

export function createLogoutHandler<R extends string>(deps: AuthDeps<R>): { POST: RequestHandler } {
  return {
    POST: async ({ cookies }) => {
      // Revoke first (cookies still carry the token), then clear in a finally
      // so a transient repo failure cannot leave the client with a valid
      // refresh cookie. Repo errors are logged but not propagated — from the
      // user's perspective logout has already happened once cookies are gone.
      try {
        if (deps.config.refreshToken && deps.repos.refreshToken) {
          await revokeRefreshFromCookie(cookies, deps.repos.refreshToken, deps.config.refreshToken);
        }
      } catch (err) {
        deps.logger.error('[auth] logout: refresh-token revoke failed', err);
      } finally {
        endSession(cookies, deps.config);
      }
      return json({ success: true });
    }
  };
}
