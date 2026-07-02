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
  /**
   * Allow unauthenticated SvelteKit Remote Functions
   * (`kit.experimental.remoteFunctions`) to pass the route guard.
   *
   * Remote functions can't be guarded by `publicRoutes` — a caller controls the
   * pathname the guard sees, via either of two transports:
   * - `/_app/remote/…` (query / command / JS-enhanced form): SvelteKit rewrites
   *   `event.url.pathname` from the client-controlled `x-sveltekit-pathname`
   *   header before this hook runs.
   * - the no-JS `<form action="?/remote=…">` fallback: dispatched through the
   *   page pipeline from the `/remote` search param, decoupled from the
   *   pathname, with `event.isRemoteRequest` left `false`.
   *
   * Either way a spoofed public route (e.g. `/auth/login`) would slip an
   * unauthenticated remote call past a path-only check, so the guard
   * default-denies (`401`) both — keyed on the unspoofable
   * `event.isRemoteRequest` and, for the fallback, a `POST` carrying a truthy
   * `/remote` action param.
   *
   * Set this to `true` only if your app deliberately exposes public remote
   * functions — you are then responsible for authorizing each remote function
   * yourself (check `event.locals.user` inside it). Authenticated remote
   * requests are unaffected either way.
   *
   * @default false
   */
  allowUnauthenticatedRemote?: boolean;
}

const DEFAULT_PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/api/auth/'
];

const jsonUnauthorized = () =>
  new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });

export function createAuthHandle<R extends string>(options: AuthHandleOptions<R>): Handle {
  const { config, repos } = options;
  const publicRoutes = options.publicRoutes ?? DEFAULT_PUBLIC_ROUTES;
  const allowUnauthenticatedRemote = options.allowUnauthenticatedRemote ?? false;
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

    // 3. Route guard.
    const user = (event.locals as Record<string, unknown>).user;

    // A remote-function call reaches this hook via one of two transports, both
    // of which let a caller present a public pathname the path guard (3b) would
    // wave through — so neither may be gated on the path:
    //   - /_app/remote/… (query / command / JS-enhanced form): SvelteKit
    //     rewrites event.url.pathname from the client-controlled
    //     x-sveltekit-pathname header before this hook runs. Detected via the
    //     unspoofable event.isRemoteRequest (from the real /_app/remote/… path).
    //   - the no-JS <form action="?/remote=…"> fallback: SvelteKit dispatches it
    //     through the page pipeline (render_page → is_action_request →
    //     get_remote_action) purely from the /remote search param, decoupled
    //     from the pathname, and intentionally leaves event.isRemoteRequest
    //     false. Detected via a POST carrying a truthy /remote action param —
    //     mirroring SvelteKit's own dispatch gate (`if (remote_id)`); a normal
    //     action named "remote" serializes to an empty ?/remote and is falsy,
    //     so it correctly stays on the path guard.
    const isRemoteFormPost =
      event.request.method === 'POST' && Boolean(event.url.searchParams.get('/remote'));

    if (event.isRemoteRequest || isRemoteFormPost) {
      // 3a. Default-deny unauthenticated remote calls. Apps that deliberately
      // expose public remote functions opt out via allowUnauthenticatedRemote
      // and must then guard those functions themselves. Authenticated remote
      // requests fall through unchanged.
      if (!user && !allowUnauthenticatedRemote) {
        return jsonUnauthorized();
      }
    } else {
      // 3b. Path-based guard for normal requests: redirect unauthenticated
      // users to login (401 for API routes).
      const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));
      const isApiRoute = event.url.pathname.startsWith('/api/');

      if (!user && !isPublic) {
        if (isApiRoute) {
          return jsonUnauthorized();
        }
        throw redirect(302, loginPage);
      }
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
