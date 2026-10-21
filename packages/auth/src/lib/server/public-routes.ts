import './server-only.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { AuthLogger } from '../types.js';

/**
 * One entry of a handle's `publicRoutes`. A string is a pathname **prefix**
 * (`startsWith`); the object form is the **exact** form, under which only that
 * pathname itself is exempt — the query string never takes part. `exact` is
 * the literal `true` so the object cannot spell a prefix: that is what the
 * string is for.
 *
 * `'/pricing'` exempts `/pricing`, `/pricing/`, `/pricing/team` *and*
 * `/pricing-admin`; `{ path: '/pricing', exact: true }` exempts `/pricing`
 * alone. `{ path: '/', exact: true }` is the only way to publish a landing page
 * without publishing every route under it.
 */
export type PublicRoute = string | { path: string; exact: true };

/**
 * A handle's `publicRoutes`: a list of {@link PublicRoute} entries, under
 * which what the list names is public and everything else guarded — or a
 * predicate, under which a route is public only when it returns the literal
 * `true`. The predicate gets the decoded pathname and the request event, whose
 * `route.id` names the route SvelteKit resolved for the request.
 */
export type PublicRoutes =
  | readonly PublicRoute[]
  | ((pathname: string, event: RequestEvent) => boolean);

/**
 * Which option a route list came from — what the construction-time messages
 * name, so a typo in `csrf.exempt` is not reported against `publicRoutes`.
 */
export interface RouteListOption {
  /** The option as the consumer spells it. */
  name: string;
  /**
   * The verdict on a bare `'/'` prefix, which exempts every route: the clause
   * after "exempts every route —", either warned (a string) or thrown
   * (`{ error }`).
   */
  bareSlash: string | { error: string };
  /**
   * Per-entry veto, run in the construction loop after the shape checks: the
   * clause after "entry <entry>" that refuses it, or `null` to accept.
   */
  refuse?: (entry: { path: string; exact: boolean }) => string | null;
}

const PUBLIC_ROUTES_OPTION: RouteListOption = {
  name: 'publicRoutes',
  bareSlash:
    "the auth guard is off for the whole app. Use { path: '/', exact: true } for the landing page alone."
};

/**
 * `pathname` decoded the way SvelteKit decodes it before matching a route, or
 * `null` when it does not decode — Kit then resolves no route for it, and both
 * handles refuse the request before anything else ({@link undecodableRefusal}).
 * `event.url.pathname` keeps the escapes, so without this a predicate guarding
 * `/admin` would read `/%61dmin` as public while Kit serves the `/admin` route
 * for it. Kit runs `reroute` on the undecoded URL before this step and strips
 * `paths.base` after it; this does neither.
 * `%25` is split out so an escaped escape stays one. Kit's own function
 * (`decode_pathname`) is outside its exports map, hence restated;
 * `handle.test.ts` compares the two over Kit's.
 */
export function decodePathname(pathname: string): string | null {
  try {
    return pathname.split('%25').map(decodeURI).join('%25');
  } catch {
    return null;
  }
}

/**
 * What both handles answer, first and for every request, when the pathname
 * does not decode ({@link decodePathname}) — or `null` when it decodes.
 *
 * For such a pathname SvelteKit calls the hook outside the `try` that turns a
 * throw into a response (`runtime/server/respond.js`, the catch around
 * `decode_pathname`), so anything the hook throws — the guard's redirect, a
 * consumer callback, a repository read during an outage — rejects the
 * adapter's `server.respond`, which adapter-node leaves unhandled: the process
 * exits. Answered first, none of that runs, and no step has staged a cookie
 * the response would have to carry. Not `resolve`: Kit's own `400` renders its
 * error page through the root layout, that layout's server `load` included.
 * `no-store` because it is a response this package builds (AUTH.md →
 * "Responses are uncacheable by default"). Each handle sets `locals.user` to
 * `null` before returning it: a hook ahead of it in `sequence()` goes on after
 * its `resolve` and reads `locals`.
 *
 * Kit decodes the pathname a `reroute` hook returns, which no handle sees;
 * this checks the requested one. A `reroute` that maps a pathname that decodes
 * to one that does not is therefore not covered.
 */
export const undecodableRefusal = (pathname: string): Response | null =>
  decodePathname(pathname) === null
    ? new Response('Bad Request', { status: 400, headers: { 'Cache-Control': 'no-store' } })
    : null;

/**
 * Whether the guard refuses a request with the JSON `401` rather than the
 * login redirect: its pathname, decoded, is under `/api/`, so `/%61pi/…` is
 * answered like `/api/…`. A pathname that does not decode is read as sent,
 * though neither handle asks about one ({@link undecodableRefusal}).
 * It is the address, not the route: under `paths.base` or behind a `reroute`
 * an API route is refused with the redirect.
 */
export const isApiPath = (pathname: string): boolean =>
  (decodePathname(pathname) ?? pathname).startsWith('/api/');

/** Logs each category once per instance. */
export type ReportOnce = (category: string, message: string, ...context: unknown[]) => void;

/**
 * One reporter per compiled option. A consumer predicate that throws or
 * rejects does so on every request it is asked about, and a client chooses
 * how many requests that is, so a log line per request is a log flood.
 */
export function reportOnce(logger: AuthLogger): ReportOnce {
  const reported = new Set<string>();
  return (category, message, ...context) => {
    if (reported.has(category)) return;
    reported.add(category);
    logger.error(message, ...context);
  };
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

/**
 * A consumer predicate's answer as a match: the literal `true` and nothing
 * else. A Promise — an async predicate's answer — is truthy whatever it
 * settles to, so it never matches; and nothing else awaits it, so a rejection
 * would go unhandled, which ends a Node process (its default
 * `--unhandled-rejections=throw`). It is caught here, and the
 * Promise and the rejection are each reported once. Shared by `publicRoutes`
 * and `csrf.exempt`.
 */
export function predicateMatched(result: unknown, name: string, report: ReportOnce): boolean {
  if (isThenable(result)) {
    report(
      'promise',
      `[auth] ${name} predicate returned a Promise. Only a literal true counts, so it matches nothing; the predicate must be synchronous. Reported once.`
    );
    Promise.resolve(result).catch((err: unknown) =>
      report(
        'rejection',
        `[auth] ${name} predicate returned a Promise that rejected. Reported once.`,
        err
      )
    );
  }
  return result === true;
}

/**
 * The predicate form of a route option, gated on a literal `true`
 * ({@link predicateMatched}). A throw leaves the route guarded and is
 * reported, once — the only other trace of it is a login redirect on a page
 * meant to be public. A pathname that does not decode stays guarded without
 * asking — and never reaches it from a handle, which refuses the request first
 * ({@link undecodableRefusal}).
 */
function gatePredicate(
  predicate: (pathname: string, event: RequestEvent) => boolean,
  logger: AuthLogger,
  name: string
): (event: RequestEvent) => boolean {
  const report = reportOnce(logger);
  return (event) => {
    const pathname = decodePathname(event.url.pathname);
    if (pathname === null) return false;
    try {
      return predicateMatched(predicate(pathname, event), name, report);
    } catch (err) {
      report(
        'throw',
        `[auth] ${name} predicate threw, so the route stays guarded. Reported once; later throws are not.`,
        err
      );
      return false;
    }
  };
}

/**
 * Compile a route option into the predicate both handles guard with — and the
 * one `csrf.exempt` matches its list with — so the three cannot drift in how
 * they read an entry. A predicate is gated, not checked: nothing about it is
 * knowable at construction, so it gets neither the shape checks nor the
 * bare-`'/'` verdict below ({@link gatePredicate}).
 *
 * Refuses, at construction, a path that does not start with `/`: `''` is the
 * silent fail-open twin of `'/'` (`startsWith('')` holds for every pathname,
 * and no warning names it), a bare `'pricing'` the silent fail-closed one (it
 * matches nothing). Both are typos, so both throw where the typo is fixable.
 *
 * A bare `'/'` prefix matches every pathname, so the option is off for the
 * whole app, and the entry is the natural misspelling of "my landing page is
 * public". The verdict is the option's: `publicRoutes` warns — once, here,
 * not per request — rather than refusing, because a fully public site that
 * mounts the handle only for session hydration (`locals.user` on every page)
 * is a legitimate configuration; `csrf.exempt` refuses it, because nothing
 * would be left on. For both, `() => true` is the deliberate spelling, and a
 * predicate is never warned about. An option can also veto single entries
 * (`refuse`), in this same loop.
 */
export function compilePublicRoutes(
  routes: PublicRoutes,
  logger: AuthLogger,
  option: RouteListOption = PUBLIC_ROUTES_OPTION
): (event: RequestEvent) => boolean {
  if (typeof routes === 'function') return gatePredicate(routes, logger, option.name);
  let bareSlashSeen = false;
  // Snapshot: the caller keeps its array, and a later push into it must not
  // silently widen the guard.
  const entries = routes.map((route) => {
    const entry =
      typeof route === 'string'
        ? { path: route, exact: false }
        : { path: route.path, exact: route.exact };
    if (typeof entry.path !== 'string' || !entry.path.startsWith('/')) {
      throw new Error(
        `[auth] ${option.name} entry ${JSON.stringify(route)} must start with '/'. An empty path exempts every route and a bare name matches none — both are typos, neither is a mode.`
      );
    }
    // The type says `exact: true`; a JS caller who left it off is told rather
    // than handed a guessed mode.
    if (typeof route !== 'string' && route.exact !== true) {
      throw new Error(
        `[auth] ${option.name} entry ${JSON.stringify(route)}: the object form is the exact form and must carry exact: true. A prefix is the plain string.`
      );
    }
    if (entry.path === '/' && !entry.exact) {
      if (typeof option.bareSlash !== 'string') {
        throw new Error(
          `[auth] ${option.name} contains '/' as a prefix, which exempts every route — ${option.bareSlash.error}`
        );
      }
      bareSlashSeen = true;
      return entry;
    }
    const reason = option.refuse?.(entry);
    if (reason) {
      throw new Error(`[auth] ${option.name} entry ${JSON.stringify(route)} ${reason}`);
    }
    return entry;
  });
  if (bareSlashSeen && typeof option.bareSlash === 'string') {
    logger.warn(
      `[auth] ${option.name} contains '/' as a prefix, which exempts every route — ${option.bareSlash}`
    );
  }
  return ({ url: { pathname } }) =>
    entries.some((entry) =>
      entry.exact ? pathname === entry.path : pathname.startsWith(entry.path)
    );
}
