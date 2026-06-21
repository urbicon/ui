import { type Handle, type RequestEvent, redirect } from '@sveltejs/kit';
import type { AuthConfig, AuthUser } from '../types.js';
import type { FullAuthUser, Repositories } from './adapters/types.js';
import { sanitizeUser } from './auth.js';
import { ensureCsrfCookie, validateCsrf } from './csrf.js';
import {
  readRefreshCookie,
  resolveJwtConfig,
  rotateRefreshToken,
  setRefreshCookie
} from './refresh-token.js';
import { applySecurityHeaders } from './security-headers.js';
import {
  clearSessionCookie,
  endSession,
  getSessionFromCookie,
  setSessionCookie
} from './session.js';

export interface AuthHandleOptions<R extends string = string> {
  config: AuthConfig<R>;
  repos: Repositories<R>;
  publicRoutes?: string[];
}

const DEFAULT_PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/api/auth/'
];

export function createAuthHandle<R extends string>(options: AuthHandleOptions<R>): Handle {
  const { config, repos } = options;
  const publicRoutes = options.publicRoutes ?? DEFAULT_PUBLIC_ROUTES;
  const loginPage = config.routes?.loginPage ?? '/auth/login';

  const csrfConfig = config.csrf;
  const csrfDoubleSubmit = csrfConfig?.doubleSubmit === true;
  const csrfHostPrefix = csrfConfig?.useHostPrefix === true;

  // The `__Host-` prefix only works over HTTPS: the cookie is force-set Secure
  // (see ensureCsrfCookie), and a browser drops a Secure cookie over plain
  // HTTP → double-submit then 403s every mutating request. Treat an explicit
  // cookieSecure:false on EITHER the csrf cookie or the session cookie (the
  // package-wide "non-HTTPS dev deployment" signal, mirroring createAuthDeps)
  // as the trigger, so the common `jwt.cookieSecure:false` dev flag is caught.
  // Warn once at construction rather than failing silently per request.
  if (csrfHostPrefix && (csrfConfig?.cookieSecure === false || config.jwt.cookieSecure === false)) {
    console.warn(
      '[auth] csrf.useHostPrefix forces a Secure __Host- cookie, but this deployment looks non-HTTPS (jwt.cookieSecure or csrf.cookieSecure is false). Browsers drop a Secure cookie over HTTP, so double-submit will 403 every mutating request — enable useHostPrefix only over HTTPS.'
    );
  }

  // The object exposed on event.locals.user: the sanitized user, optionally
  // run through the consumer's transformUser seam (awaited — its return value
  // becomes locals.user). Defined once so the main session path and both
  // refresh-rotation paths stay in sync.
  const transformUser = config.hooks?.transformUser;
  const resolveLocalsUser = async (e: RequestEvent, user: FullAuthUser): Promise<unknown> => {
    // The refresh-rotation outcome widens the role to plain `string` (the
    // rotation helper is not generic over R); the value is the user's real
    // role, so restore the consumer's role type for the transform.
    const base = sanitizeUser(user) as AuthUser<R>;
    return transformUser ? transformUser(base, e) : base;
  };

  return async ({ event, resolve }) => {
    // 1. CSRF check for mutating requests.
    //
    // This is the package's own Origin gate and only covers requests that
    // reach this hook. It is independent of SvelteKit's built-in
    // `kit.csrf.checkOrigin`, which runs earlier in the request kernel
    // (before any hook) and so still applies to handle-bypassed routes — most
    // visibly a cross-origin, form-encoded POST such as an OAuth 2.1 token
    // endpoint, which that kernel check 403s ("Cross-site POST form
    // submissions are forbidden") before this ever runs, in production only.
    // A consumer exposing such an endpoint *outside* this handle must turn the
    // kernel check off (`kit.csrf.trustedOrigins: ['*']`) and rely on this
    // gate, which is stricter (all methods, all content types incl. JSON, no
    // allow-list). See docs/AUTH.md → Known Limitations & Security Gaps.
    if (
      !validateCsrf(event.request, event.url, {
        doubleSubmit: csrfDoubleSubmit,
        cookies: event.cookies,
        cookieName: csrfConfig?.cookieName,
        headerName: csrfConfig?.headerName,
        hostPrefix: csrfHostPrefix
      })
    ) {
      return new Response('CSRF validation failed', { status: 403 });
    }

    // 1a. Ensure the Double-Submit-Cookie exists for safe requests so the
    // next mutating request has a token to echo back.
    if (csrfDoubleSubmit) {
      ensureCsrfCookie(event.cookies, {
        cookieName: csrfConfig?.cookieName,
        secure: csrfConfig?.cookieSecure,
        sameSite: csrfConfig?.cookieSameSite,
        hostPrefix: csrfHostPrefix
      });
    }

    // 2. Session from cookie → load user → set event.locals.user
    const session = await getSessionFromCookie<R>(event.cookies, config.jwt);

    if (session) {
      const user = await repos.user.findById(session.userId);
      if (user && user.tokenVersion === session.tokenVersion) {
        (event.locals as Record<string, unknown>).user = await resolveLocalsUser(event, user);
      } else {
        // Invalid session — clear cookie
        clearSessionCookie(event.cookies, config.jwt);
        (event.locals as Record<string, unknown>).user = null;
      }
    } else if (config.refreshToken && repos.refreshToken) {
      // 2a. Access token missing/expired, but refresh rotation is opted in —
      // try to rotate transparently so the in-flight request can continue as
      // authenticated. Reuse and revocation outcomes clear both cookies.
      const raw = readRefreshCookie(event.cookies, config.refreshToken);
      if (raw) {
        const outcome = await rotateRefreshToken(
          repos.refreshToken,
          raw,
          (id) => repos.user.findById(id),
          config.refreshToken
        );
        if (outcome.kind === 'rotated') {
          const { user, token } = outcome;
          await setSessionCookie(
            event.cookies,
            {
              userId: user.id,
              email: user.email,
              role: user.role,
              tokenVersion: user.tokenVersion
            },
            resolveJwtConfig(config)
          );
          setRefreshCookie(event.cookies, token, config.refreshToken);
          (event.locals as Record<string, unknown>).user = await resolveLocalsUser(event, user);
        } else if (outcome.kind === 'race_ok') {
          // Concurrent-rotation loser: the winner's response is already
          // writing the successor refresh cookie to the same browser. Issue
          // a fresh access token for this in-flight request but do NOT
          // touch the refresh cookie — the browser will pick up the
          // winner's value.
          const { user } = outcome;
          await setSessionCookie(
            event.cookies,
            {
              userId: user.id,
              email: user.email,
              role: user.role,
              tokenVersion: user.tokenVersion
            },
            resolveJwtConfig(config)
          );
          (event.locals as Record<string, unknown>).user = await resolveLocalsUser(event, user);
        } else {
          // reused / expired / not_found / revoked — drop both cookies.
          endSession(event.cookies, config);
          (event.locals as Record<string, unknown>).user = null;
        }
      } else {
        (event.locals as Record<string, unknown>).user = null;
      }
    } else {
      (event.locals as Record<string, unknown>).user = null;
    }

    // 3. Route guard: redirect unauthenticated users to login
    const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));
    const isApiRoute = event.url.pathname.startsWith('/api/');
    const user = (event.locals as Record<string, unknown>).user;

    if (!user && !isPublic) {
      if (isApiRoute) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw redirect(302, loginPage);
    }

    // 4. Resolve and apply security headers. HSTS is gated on a secure
    // deployment (jwt.cookieSecure !== false) — same heuristic as the
    // brute-force-default warnings in createAuthDeps.
    const response = await resolve(event);
    return applySecurityHeaders(response, {
      ...config.securityHeaders,
      secure: config.jwt.cookieSecure !== false
    });
  };
}
