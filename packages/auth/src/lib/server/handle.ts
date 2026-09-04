import { type Handle, type RequestEvent, redirect } from '@sveltejs/kit';
import type { AuthConfig, AuthLogger, AuthUser } from '../types.js';
import type { FullAuthUser, Repositories } from './adapters/types.js';
import { sanitizeUser } from './auth.js';
import { isSecureDeployment } from './cookie-policy.js';
import { ensureCsrfCookie, validateCsrf } from './csrf.js';
import { assertAuthConfigValid } from './deps.js';
import { authError } from './handlers/errors.js';
import { shieldLogger } from './logger.js';
import { compilePublicRoutes, type PublicRoute, type RouteListOption } from './public-routes.js';
import { readRefreshCookie, rotateRefreshToken } from './refresh-token.js';
import { applySecurityHeaders } from './security-headers.js';
import { applyRotationOutcome, clearSessionCookie, getSessionFromCookie } from './session.js';

export type { PublicRoute } from './public-routes.js';

export interface AuthHandleOptions<R extends string = string> {
  config: AuthConfig<R>;
  repos: Repositories<R>;
  /**
   * Routes exempt from the auth guard. A string entry is a pathname
   * **prefix** (`startsWith`); `{ path, exact: true }` exempts that pathname
   * alone (see {@link PublicRoute}).
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
   * A prefix grants more than its spelling suggests: `'/pricing'` also exempts
   * `/pricing-admin` and `/pricing/internal`, and a bare `'/'` exempts the
   * entire app — the handle warns about that one at construction. The landing
   * page alone is `{ path: '/', exact: true }`. A list held in a variable
   * first needs `as const` or the annotation `PublicRoute[]`: TypeScript
   * otherwise widens `exact: true` to `boolean` and the assignment is a type
   * error. An inline list needs nothing.
   *
   * Read once, at construction: mutating the array afterwards does not move
   * the guard.
   *
   * @default DEFAULT_PUBLIC_ROUTES
   */
  publicRoutes?: readonly PublicRoute[];
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
  /**
   * The package's own CSRF gate, step 1 of the hook. The cookie and header
   * knobs live on `config.csrf`; this is the exemption.
   */
  csrf?: {
    /**
     * Routes handled as **cookieless**: machine endpoints whose callers send
     * no `Origin` header and hold no session — a cron runner with a secret
     * header, an OAuth token endpoint, an API-key route. For a matching
     * request the hook reads no cookie and writes none: no Origin gate, no
     * session hydration (a valid session cookie still leaves `locals.user`
     * `null`), no refresh rotation, no CSRF cookie, no route guard. The
     * response gets the security headers and nothing else.
     *
     * **The route authenticates every request itself** (bearer token, secret
     * header, PKCE). A page or a cookie-authenticated API route listed here
     * loses its CSRF protection and sees every visitor as signed out.
     *
     * Same vocabulary as {@link publicRoutes}: a string is a pathname prefix,
     * `{ path, exact: true }` that pathname alone, a bare `'/'` warns at
     * construction. Or a synchronous predicate over the event for callers a
     * path does not identify — `(e) => e.request.headers.has('x-cron-secret')`.
     * Only a literal `true` exempts, so an async predicate (a Promise) exempts
     * nothing; a throw fails the request. Remote-function requests are never
     * exempt on either transport — their pathname is client-controlled and
     * their transport is cookie-authenticated by construction — and the
     * predicate is not consulted for them.
     *
     * SvelteKit's kernel CSRF gate runs before any hook and is unaffected: a
     * form-encoded cross-origin POST still needs `kit.csrf.trustedOrigins:
     * ['*']` in a built app. docs/AUTH.md → Machine callers.
     *
     * @default nothing is exempt
     */
    exempt?: readonly PublicRoute[] | ((event: RequestEvent) => boolean);
  };
}

const CSRF_EXEMPT_OPTION: RouteListOption = {
  name: 'csrf.exempt',
  bareSlash:
    'the CSRF gate is off and every request is handled as cookieless, so locals.user is null on every page. List the machine endpoints instead.'
};

/**
 * `csrf.exempt` as one predicate over the event. The list form goes through
 * the same compiler as `publicRoutes`; the function form is gated on a
 * literal `true` so that a Promise — an async predicate — exempts nothing.
 */
function compileCsrfExempt(
  exempt: NonNullable<AuthHandleOptions['csrf']>['exempt'],
  logger: AuthLogger
): (event: RequestEvent) => boolean {
  if (exempt === undefined) return () => false;
  if (typeof exempt === 'function') return (event) => exempt(event) === true;
  const matches = compilePublicRoutes(exempt, logger, CSRF_EXEMPT_OPTION);
  return (event) => matches(event.url.pathname);
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

const jsonUnauthorized = () => authError('not_authenticated');

export function createAuthHandle<R extends string>(options: AuthHandleOptions<R>): Handle {
  const { config, repos } = options;
  const logger = shieldLogger(config.logger ?? console);
  // Every wiring-time config check, mirrored in createAuthDeps: hook and handler
  // bundle are wired independently and either can be reached first.
  assertAuthConfigValid(config, repos, logger);
  const isPublicPath = compilePublicRoutes(options.publicRoutes ?? DEFAULT_PUBLIC_ROUTES, logger);
  const isCsrfExempt = compileCsrfExempt(options.csrf?.exempt, logger);
  const allowUnauthenticatedRemote = options.allowUnauthenticatedRemote ?? false;
  const loginPage = config.routes?.loginPage ?? '/auth/login';

  const csrfConfig = config.csrf;
  const csrfDoubleSubmit = csrfConfig?.doubleSubmit === true;
  const csrfHostPrefix = csrfConfig?.useHostPrefix === true;

  // The `__Host-` prefix only works over HTTPS: the cookie is force-set Secure
  // (see ensureCsrfCookie), and a browser drops a Secure cookie over plain
  // HTTP → double-submit then 403s every mutating request. `isSecureDeployment`
  // is the package-wide signal — the same one the 2FA and passkey cookies derive
  // their name from, so the warning and those names can no longer disagree.
  // Warn once at construction rather than failing silently per request.
  if (csrfHostPrefix && !isSecureDeployment(config)) {
    logger.warn(
      '[auth] csrf.useHostPrefix forces a Secure __Host- cookie, but this deployment looks non-HTTPS (jwt.cookieSecure, csrf.cookieSecure or refreshToken.cookieSecure is false). Browsers drop a Secure cookie over HTTP, so double-submit will 403 every mutating request — enable useHostPrefix only over HTTPS.'
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

  // Same seam on the rotation branch, minus the abort. By the time it runs the
  // rotation has committed — successor row written, predecessor CAS-revoked —
  // and both cookies are staged on `event.cookies`, which SvelteKit flushes
  // only on the success and redirect paths. A throw out of here therefore
  // drops the successor cookie while the row says the predecessor was
  // replaced, so the browser keeps replaying the spent token; outside
  // ROTATION_GRACE_MS that is indistinguishable from reuse and revokes the
  // whole family. Do not restore the abort here: one unauthenticated request
  // is recoverable, a burnt family plus a false theft alarm is not. The read
  // path above keeps the documented abort — nothing is committed there.
  const resolveRotatedLocalsUser = async (
    e: RequestEvent,
    user: FullAuthUser<R>
  ): Promise<unknown> => {
    try {
      return await resolveLocalsUser(e, user);
    } catch (err) {
      logger.error(
        '[auth] handle: transformUser threw after a committed refresh rotation — continuing unauthenticated so the rotated cookies still reach the browser',
        err
      );
      return null;
    }
  };

  // 4. Resolve and apply security headers — the one step every request gets,
  // the cookieless short-circuit included. HSTS is gated on a secure
  // deployment — the same predicate the cookie names and the
  // brute-force-default warnings use.
  const respond = async (
    event: RequestEvent,
    resolve: Parameters<Handle>[0]['resolve']
  ): Promise<Response> => {
    const response = await resolve(event);
    return applySecurityHeaders(response, {
      ...config.securityHeaders,
      secure: isSecureDeployment(config)
    });
  };

  return async ({ event, resolve }) => {
    // A remote-function call reaches this hook via one of two transports, both
    // of which let a caller present a public pathname that a path match — the
    // guard (3b) or `csrf.exempt` (0) — would wave through, so neither may be
    // decided on the path:
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
    const isRemote = event.isRemoteRequest || isRemoteFormPost;

    // 0. Cookieless machine routes (`csrf.exempt`). The endpoint authenticates
    // itself, so the hook neither reads a cookie nor writes one: steps 1–3 are
    // skipped wholesale and `locals` gets the unauthenticated shape. Remote
    // requests are excluded before the predicate runs — an exemption here
    // would let a spoofed pathname past the default-deny in 3a.
    if (!isRemote && isCsrfExempt(event)) {
      (event.locals as Record<string, unknown>).user = null;
      return respond(event, resolve);
    }

    // 1. CSRF check for mutating requests. The package's own Origin gate,
    // covering only requests that reach this hook; SvelteKit's kernel CSRF
    // gate runs earlier and still gates handle-bypassed routes. Interplay +
    // the off-switch (`kit.csrf.trustedOrigins: ['*']`, resolved at build
    // time): docs/AUTH.md → Machine callers.
    if (
      !validateCsrf(event.request, event.url, {
        doubleSubmit: csrfDoubleSubmit,
        cookies: event.cookies,
        cookieName: csrfConfig?.cookieName,
        headerName: csrfConfig?.headerName,
        hostPrefix: csrfHostPrefix,
        logger
      })
    ) {
      return authError('csrf_failed');
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
          ? await resolveRotatedLocalsUser(event, rotatedUser)
          : null;
      } else {
        (event.locals as Record<string, unknown>).user = null;
      }
    } else {
      (event.locals as Record<string, unknown>).user = null;
    }

    // 3. Route guard.
    const user = (event.locals as Record<string, unknown>).user;

    if (isRemote) {
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
      const isPublic = isPublicPath(event.url.pathname);
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

    // 4. Resolve, headers on.
    return respond(event, resolve);
  };
}
