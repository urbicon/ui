import { type Handle, type RequestEvent, redirect } from '@sveltejs/kit';
import type { AuthConfig, AuthUser } from '../types.js';
import type { FullAuthUser, Repositories } from './adapters/types.js';
import { sanitizeUser } from './auth.js';
import { ensureCsrfCookie, validateCsrf } from './csrf.js';
import { assertReposMatchConfig, shieldLogger } from './deps.js';
import { authError } from './handlers/errors.js';
import { assertJwtConfigValid } from './jwt.js';
import { readRefreshCookie, rotateRefreshToken } from './refresh-token.js';
import { applySecurityHeaders } from './security-headers.js';
import { applyRotationOutcome, clearSessionCookie, getSessionFromCookie } from './session.js';

export interface AuthHandleOptions<R extends string = string> {
  config: AuthConfig<R>;
  repos: Repositories<R>;
  /**
   * Route prefixes exempt from the auth guard, matched with `startsWith`.
   *
   * **The list REPLACES the defaults; it does not extend them.** The defaults
   * are {@link DEFAULT_PUBLIC_ROUTES}, exported so an app that only wants to
   * add its own public pages can spread them:
   * `[...DEFAULT_PUBLIC_ROUTES, '/pricing']`.
   *
   * Dropping `'/api/auth/'` locks out the app's own sign-in: every auth
   * endpoint is then guarded, so an unauthenticated `POST /api/auth/login`
   * gets `401 not_authenticated` instead of a session. Replacing wholesale is
   * the right mode only for a handle scoped to routes that mount no auth
   * endpoints at all.
   *
   * Entries are prefixes, never exact matches: `'/api/auth/'` exempts every
   * `/api/auth/*` sub-route, and `'/'` exempts the entire app — there is no
   * way to publish a bare landing page without publishing everything under it.
   *
   * Read once, at construction: mutating the array afterwards does not move
   * the guard.
   *
   * @default DEFAULT_PUBLIC_ROUTES
   */
  publicRoutes?: readonly string[];
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

/**
 * The route prefixes `createAuthHandle` exempts from the guard when
 * `publicRoutes` is omitted. Spread it to extend rather than replace (see
 * {@link AuthHandleOptions.publicRoutes}). Frozen because it is exported: one
 * array backs every handle that omits the option, so a `push` into it would
 * widen the guard for all of them at once.
 */
export const DEFAULT_PUBLIC_ROUTES: readonly string[] = Object.freeze([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/api/auth/'
]);

const jsonUnauthorized = () => authError('not_authenticated', 401);

export function createAuthHandle<R extends string>(options: AuthHandleOptions<R>): Handle {
  const { config, repos } = options;
  // Fail loud if refresh rotation is configured without its repo — otherwise the
  // 2a rotation branch below would be silently skipped. Independent of
  // createAuthDeps, which wires the handler bundle (this wires the hook).
  assertReposMatchConfig(config, repos);
  const logger = shieldLogger(config.logger ?? console);
  // Fail loud on an unusable JWT config (ES256 without a signing key, …) at
  // wiring time — mirrored in createAuthDeps; hook and handler bundle are
  // wired independently, so both entry points must check.
  assertJwtConfigValid(config.jwt, logger);
  // Snapshot: the array stays the caller's, and a later push into it must not
  // silently widen this handle's guard.
  const publicRoutes = [...(options.publicRoutes ?? DEFAULT_PUBLIC_ROUTES)];
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
    logger.warn(
      '[auth] csrf.useHostPrefix forces a Secure __Host- cookie, but this deployment looks non-HTTPS (jwt.cookieSecure or csrf.cookieSecure is false). Browsers drop a Secure cookie over HTTP, so double-submit will 403 every mutating request — enable useHostPrefix only over HTTPS.'
    );
  }

  // The object exposed on event.locals.user: the sanitized user, optionally
  // run through the consumer's transformUser seam (awaited — its return value
  // becomes locals.user). Defined once so the main session path and both
  // refresh-rotation paths stay in sync.
  const transformUser = config.hooks?.transformUser;
  const resolveLocalsUser = async (e: RequestEvent, user: FullAuthUser<R>): Promise<unknown> => {
    const base: AuthUser<R> = sanitizeUser(user);
    return transformUser ? transformUser(base, e) : base;
  };

  return async ({ event, resolve }) => {
    // 1. CSRF check for mutating requests. The package's own Origin gate,
    // covering only requests that reach this hook; SvelteKit's kernel CSRF
    // gate runs earlier and still gates handle-bypassed routes. Interplay +
    // the off-switch (`kit.csrf.trustedOrigins: ['*']`, resolved at build
    // time): docs/AUTH.md → Known Limitations.
    if (
      !validateCsrf(event.request, event.url, {
        doubleSubmit: csrfDoubleSubmit,
        cookies: event.cookies,
        cookieName: csrfConfig?.cookieName,
        headerName: csrfConfig?.headerName,
        hostPrefix: csrfHostPrefix
      })
    ) {
      return authError('csrf_failed', 403);
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
    const session = await getSessionFromCookie<R>(event.cookies, config.jwt, logger);

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
      // authenticated. Cookie effects per outcome (incl. the race_ok
      // don't-touch-the-refresh-cookie rule) live in applyRotationOutcome,
      // shared with the explicit refresh endpoint.
      const raw = readRefreshCookie(event.cookies, config.refreshToken);
      if (raw) {
        const outcome = await rotateRefreshToken(
          repos.refreshToken,
          raw,
          (id) => repos.user.findById(id),
          config.refreshToken
        );
        const rotatedUser = await applyRotationOutcome(event.cookies, outcome, config);
        (event.locals as Record<string, unknown>).user = rotatedUser
          ? await resolveLocalsUser(event, rotatedUser)
          : null;
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
        // Preserve the deep link: append the requested path so the login flow
        // can send the user back after signing in. GET/HEAD only — re-issuing
        // a guarded POST target as a post-login GET navigation would be wrong.
        // Consumers MUST pass the param through `sanitizeRedirect` before
        // navigating (it is attacker-writable, like any query param).
        let target = loginPage;
        if (event.request.method === 'GET' || event.request.method === 'HEAD') {
          const requested = event.url.pathname + event.url.search;
          target += `${loginPage.includes('?') ? '&' : '?'}redirectTo=${encodeURIComponent(requested)}`;
        }
        throw redirect(302, target);
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
