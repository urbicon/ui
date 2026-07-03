import type { Cookies } from '@sveltejs/kit';
import type { AuthConfig, AuthSession, JwtConfig } from '../types.js';
import type { FullAuthUser, RefreshTokenRepository } from './adapters/types.js';
import { parseDurationSeconds } from './duration.js';
import { createSessionToken, verifySessionToken } from './jwt.js';
import {
  clearRefreshCookie,
  issueRefreshToken,
  type RotateOutcome,
  resolveJwtConfig,
  type SessionMeta,
  setRefreshCookie
} from './refresh-token.js';

/**
 * Build the per-session metadata (user-agent + optional IP) from a request
 * event. The IP is captured only when the consumer opts in via
 * `config.sessions.storeIp` (it's personal data). Pass the result to
 * {@link establishSession} so login/register/passkey sessions appear in the
 * session list with a recognisable device.
 */
export function resolveSessionMeta(
  event: { request: Request; getClientAddress: () => string },
  config: { sessions?: { storeIp?: boolean } }
): SessionMeta {
  return {
    userAgent: event.request.headers.get('user-agent') ?? undefined,
    ip: config.sessions?.storeIp ? event.getClientAddress() : undefined
  };
}

function cookieName(config: JwtConfig): string {
  return config.cookieName ?? 'session';
}

/**
 * Modern browsers reject `SameSite=None` cookies that aren't also `Secure`,
 * so the combination is a misconfiguration: the cookie just silently
 * disappears in some browsers and is accepted in others. Fail loudly.
 */
function resolveCookieSecure(
  cookieSecure: boolean | undefined,
  sameSite: 'lax' | 'strict' | 'none'
): boolean {
  const secure = cookieSecure ?? true;
  if (sameSite === 'none' && !secure) {
    throw new Error(
      '[auth] cookieSameSite: "none" requires cookieSecure: true — browsers reject SameSite=None without Secure.'
    );
  }
  return secure;
}

export async function setSessionCookie<R extends string>(
  cookies: Cookies,
  payload: AuthSession<R>,
  config: JwtConfig
): Promise<void> {
  const token = await createSessionToken(payload, config);
  const maxAge = parseDurationSeconds(config.expiresIn ?? '7d');
  const sameSite = config.cookieSameSite ?? 'lax';
  cookies.set(cookieName(config), token, {
    path: '/',
    httpOnly: true,
    secure: resolveCookieSecure(config.cookieSecure, sameSite),
    sameSite,
    maxAge
  });
}

export function clearSessionCookie(cookies: Cookies, config: JwtConfig): void {
  cookies.delete(cookieName(config), { path: '/' });
}

export async function getSessionFromCookie<R extends string>(
  cookies: Cookies,
  config: JwtConfig
): Promise<AuthSession<R> | null> {
  const token = cookies.get(cookieName(config));
  if (!token) return null;
  return verifySessionToken<R>(token, config);
}

/**
 * Build the JWT session payload from a user row. One copy on purpose — this
 * literal existed five times (handle hook ×2, refresh handler ×2, here): a
 * field drifting in one copy (say, a forgotten `tokenVersion`) would mint
 * sessions that bypass the "log out everywhere" revocation check (review R14).
 */
export function sessionPayload<R extends string>(
  user: Pick<FullAuthUser<R>, 'id' | 'email' | 'role' | 'tokenVersion'>
): AuthSession<R> {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion
  };
}

/**
 * Apply a refresh-rotation outcome to the response cookies — the single
 * policy shared by the transparent handle-hook path and the explicit refresh
 * endpoint (previously two full copies, review R14):
 *
 * - `'rotated'` — fresh access token AND the successor refresh cookie.
 * - `'race_ok'` — concurrent-rotation loser: fresh access token only. The
 *   winner's response is already writing the successor refresh cookie to the
 *   same browser jar; touching it here would clobber the winner's value.
 * - anything else (`reused`/`expired`/`not_found`/`revoked`) — drop both
 *   cookies.
 *
 * Returns the authenticated user (for `locals` / the response body), or
 * `null` when the outcome ended the session.
 */
export async function applyRotationOutcome<R extends string>(
  cookies: Cookies,
  outcome: RotateOutcome,
  config: AuthConfig<R>
): Promise<FullAuthUser | null> {
  if (outcome.kind === 'rotated') {
    // A rotation can only have happened with refresh tokens configured; fail
    // loud on a caller violating that rather than silently skipping the cookie.
    if (!config.refreshToken) {
      throw new Error('[auth] applyRotationOutcome: rotated outcome without config.refreshToken');
    }
    await setSessionCookie(cookies, sessionPayload(outcome.user), resolveJwtConfig(config));
    setRefreshCookie(cookies, outcome.token, config.refreshToken);
    return outcome.user;
  }
  if (outcome.kind === 'race_ok') {
    await setSessionCookie(cookies, sessionPayload(outcome.user), resolveJwtConfig(config));
    return outcome.user;
  }
  endSession(cookies, config);
  return null;
}

/**
 * Issue the full client-side session state after authentication: sets the
 * access-token cookie and — when refresh-token rotation is configured —
 * additionally issues and persists a fresh refresh token. Handlers should
 * prefer this over calling `setSessionCookie` directly so the refresh
 * semantics stay in one place.
 */
export async function establishSession<R extends string>(
  cookies: Cookies,
  user: FullAuthUser<R>,
  config: AuthConfig<R>,
  repos: { refreshToken?: RefreshTokenRepository },
  meta?: SessionMeta
): Promise<void> {
  await setSessionCookie(cookies, sessionPayload(user), resolveJwtConfig(config));

  if (config.refreshToken && repos.refreshToken) {
    const { token } = await issueRefreshToken(
      repos.refreshToken,
      user.id,
      config.refreshToken,
      meta
    );
    setRefreshCookie(cookies, token, config.refreshToken);
  }
}

/**
 * Tear down the full session: clears the access-token cookie and, when
 * refresh-token rotation is configured, additionally clears the refresh
 * cookie. Callers are responsible for revoking the matching `RefreshToken`
 * row if they want to invalidate server-side — see
 * `revokeRefreshFromCookie` for that.
 */
export function endSession<R extends string>(cookies: Cookies, config: AuthConfig<R>): void {
  clearSessionCookie(cookies, config.jwt);
  if (config.refreshToken) clearRefreshCookie(cookies, config.refreshToken);
}
