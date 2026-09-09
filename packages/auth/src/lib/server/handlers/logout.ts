import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthDeps } from '../deps.js';
import { revokeRefreshFromCookie } from '../refresh-token.js';
import { endSession } from '../session.js';
import { privateEndpoints, requireSessionUser } from './_shared.js';

export interface LogoutHandlerOptions {
  /**
   * End **every** session of the account on logout, not just this browser's:
   * bump the user's `tokenVersion`, so the generation check `createAuthHandle`
   * runs on each request refuses every access token minted before it, and —
   * with `config.refreshToken` configured — revoke every refresh family, so
   * nothing can rotate back in.
   *
   * Without it, logout revokes the refresh token the cookie carries and clears
   * both cookies — which ends the session in *this* browser, while a copy of
   * the access JWT taken beforehand (a `curl` session, a shared machine) keeps
   * verifying until `jwt.expiresIn` elapses. Nothing about that token is stored
   * server-side, so nothing local can refuse it.
   *
   * The price is that both writes are per user, not per session. Another
   * device's API client keeps seeing `401` on the same stale cookie until its
   * access token expires (`accessTokenTtl`, 15 minutes by default) or its next
   * page navigation, which clears that cookie and sends it to the login — the
   * guard answers an API request without resolving, and SvelteKit writes a
   * cookie a hook staged only on the paths that resolve or redirect. Sign a
   * *specific* device out with `createSessionsHandlers`' `revoke` /
   * `revokeOthers` instead; that path leaves `tokenVersion` alone.
   *
   * Defaults to `false`: no write beyond this browser's own refresh token.
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
 * `{ invalidateAccessTokens: true }` to end every session of the account
 * instead, at the price of signing the user's other devices out. See
 * docs/AUTH.md → Logout.
 */
export function createLogoutHandler<R extends string>(
  deps: AuthDeps<R>,
  options: LogoutHandlerOptions = {}
): { POST: RequestHandler } {
  return privateEndpoints({
    POST: async ({ cookies }) => {
      // Resolves the user from the session cookie, so this runs before the
      // `finally` below clears it. Both writes are best-effort and reported
      // separately: an operator has to be able to tell a bump that landed
      // without its family revoke — access tokens dead everywhere, refresh
      // families alive, so every other device rotates back in on its next page
      // navigation — from a logout that invalidated nothing.
      if (options.invalidateAccessTokens) {
        let userId: string | null = null;
        try {
          const user = await requireSessionUser(deps, cookies);
          userId = user?.id ?? null;
          if (user) await deps.repos.user.incrementTokenVersion(user.id);
        } catch (err) {
          deps.logger.error('[auth] logout: token-version bump failed', err);
        }
        if (userId && deps.config.refreshToken && deps.repos.refreshToken) {
          try {
            await deps.repos.refreshToken.revokeAllForUser(userId);
          } catch (err) {
            deps.logger.error('[auth] logout: refresh-family revoke failed', err);
          }
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
