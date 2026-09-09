import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthDeps } from '../deps.js';
import { revokeRefreshFromCookie } from '../refresh-token.js';
import { endSession } from '../session.js';
import { privateEndpoints, requireSessionUser } from './_shared.js';

export interface LogoutHandlerOptions {
  /**
   * Bump the user's `tokenVersion` on logout, so every access token minted
   * before it is refused by the generation check `createAuthHandle` runs on
   * each request.
   *
   * Without it, logout revokes the refresh token the cookie carries and clears
   * both cookies — which ends the session in *this* browser, while a copy of
   * the access JWT taken beforehand (a `curl` session, a shared machine) keeps
   * verifying until `jwt.expiresIn` elapses. Nothing about that token is stored
   * server-side, so nothing local can refuse it.
   *
   * The bump is per user, not per session: it refuses every device's access
   * token, and with `config.refreshToken` configured, a device whose refresh
   * cookie is still live rotates into a fresh session on its next request —
   * only the logging-out browser's refresh token is revoked. Sign a *specific*
   * device out with `createSessionsHandlers`' `revoke` / `revokeOthers`
   * instead.
   *
   * Defaults to `false`: no write on the user row, and no effect outside the
   * browser that called.
   */
  invalidateAccessTokens?: boolean;
}

/**
 * End the caller's session: revoke the refresh token their cookie carries
 * (when rotation is configured) and clear both cookies. It requires no valid
 * session — a request whose access token has already expired still answers
 * `{ success: true }` with the cookies dropped.
 *
 * What it cannot end is an access token that left the browser: pass
 * `{ invalidateAccessTokens: true }` to bump `tokenVersion` as well, at the
 * price of refusing every device's access token. See docs/AUTH.md → Logout.
 */
export function createLogoutHandler<R extends string>(
  deps: AuthDeps<R>,
  options: LogoutHandlerOptions = {}
): { POST: RequestHandler } {
  return privateEndpoints({
    POST: async ({ cookies }) => {
      // Resolves the user from the session cookie, so it has to run before the
      // `finally` below clears it. Best-effort like the revoke: a failed write
      // must not keep the cookies alive, and the user is out of this browser
      // either way.
      if (options.invalidateAccessTokens) {
        try {
          const user = await requireSessionUser(deps, cookies);
          if (user) await deps.repos.user.incrementTokenVersion(user.id);
        } catch (err) {
          deps.logger.error('[auth] logout: token-version bump failed', err);
        }
      }

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
  });
}
