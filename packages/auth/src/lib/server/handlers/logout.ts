import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthDeps } from '../deps.js';
import { revokeRefreshFromCookie } from '../refresh-token.js';
import { endSession } from '../session.js';
import { privateEndpoints, requireSessionUser } from './_shared.js';

export interface LogoutHandlerOptions {
  /**
   * Make logout reach the access tokens this account already holds, instead of
   * only the cookies in this browser.
   *
   * Off by default, and that default is the behaviour of a stateless JWT: the
   * handler clears the cookies, so the browser is signed out, while a copy of
   * the access token taken before the request stays verifiable until its `exp`
   * — up to `jwt.expiresIn`. Turn this on for the product where "log out" has
   * to mean the session is over: a shared device, a single-user tool, a kiosk.
   *
   * What it does is the teardown `reset-password` performs, minus the password:
   * `tokenVersion` is incremented — which refuses every access token issued to
   * this account, on **every** device — and every refresh-token family is
   * revoked, because a family that survived would re-read the row and mint a
   * session on the *new* version, undoing the bump on the next rotation.
   *
   * So this signs the account out **everywhere**, which is why it is opt-in and
   * why `createSessionsHandlers`' `revokeOthers` remains the way to end the
   * other sessions and keep this one. It costs one write to the user row plus
   * one to the refresh-token store per logout.
   *
   * It needs a resolvable session to act on: after the access token has already
   * expired there is no user to bump, and the response reports that as
   * `invalidated: false` rather than implying it happened. A federated consumer
   * app (`createFederatedAuthHandle`) never sees the bump either — it cannot
   * read the IdP's `tokenVersion` — so bound that window with `maxTokenAge`
   * there. See docs/AUTH.md → Logout.
   *
   * @default false
   */
  invalidateAccessTokens?: boolean;
}

/**
 * Sign the current browser out: revoke the refresh token it carries, then clear
 * both cookies. With `invalidateAccessTokens` it additionally ends every
 * session this account holds — see {@link LogoutHandlerOptions}.
 *
 * Answers `{ success: true, invalidated }`, where `invalidated` says whether the
 * account-wide teardown completed. It is `false` whenever the option is off,
 * and also when the option is on but there was no session left to resolve or a
 * repository write failed — never a claim that the tokens are dead when they
 * are not.
 */
export function createLogoutHandler<R extends string>(
  deps: AuthDeps<R>,
  options: LogoutHandlerOptions = {}
): { POST: RequestHandler } {
  const invalidateAccessTokens = options.invalidateAccessTokens === true;

  return privateEndpoints({
    POST: async ({ cookies }) => {
      // Two guarded steps, in this order and not nested: the account-wide
      // teardown is the one a copied token outlives, so it goes first and a
      // failure in it must not skip the cookie-scoped revoke below (nor the
      // reverse). Repo errors are logged, not propagated — from the user's
      // perspective logout has already happened once the cookies are gone, and
      // a 500 here would leave them looking signed in.
      const invalidated = invalidateAccessTokens ? await endEverySession(deps, cookies) : false;

      try {
        if (deps.config.refreshToken && deps.repos.refreshToken) {
          await revokeRefreshFromCookie(cookies, deps.repos.refreshToken, deps.config.refreshToken);
        }
      } catch (err) {
        deps.logger.error('[auth] logout: refresh-token revoke failed', err);
      } finally {
        endSession(cookies, deps.config);
      }

      return json({ success: true, invalidated });
    }
  });
}

/**
 * The `invalidateAccessTokens` half: resolve the account behind the session
 * cookie and end every session it has. Reports whether that ran to completion —
 * a bump whose family revoke then failed is reported as `false`, because the
 * account is only signed out everywhere once both landed.
 */
async function endEverySession<R extends string>(
  deps: AuthDeps<R>,
  cookies: Cookies
): Promise<boolean> {
  try {
    // From the cookie, not `locals.user`: a `transformUser` hook may reshape
    // locals into anything, and this needs the row's id.
    const user = await requireSessionUser(deps, cookies);
    if (!user) return false;

    await deps.repos.user.incrementTokenVersion(user.id);
    await deps.repos.refreshToken?.revokeAllForUser(user.id);
    return true;
  } catch (err) {
    deps.logger.error('[auth] logout: account-wide token invalidation failed', err);
    return false;
  }
}
