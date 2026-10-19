import './server-only.js';
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
 * predicate over the pathname, under which a route is public only when it
 * returns the literal `true`.
 */
export type PublicRoutes = readonly PublicRoute[] | ((pathname: string) => boolean);

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
 * The decoding SvelteKit applies to a pathname before it matches a route.
 * `event.url.pathname` keeps the escapes, so a predicate guarding `/admin`
 * would otherwise read `/%61dmin` as public while Kit serves the `/admin`
 * route for it. `%25` is split out so an escaped escape stays one, and a
 * malformed escape throws `URIError`. Kit's own function (`decode_pathname`)
 * is outside its exports map, hence restated; `handle.test.ts` compares the
 * two over Kit's.
 */
const decodePathname = (pathname: string): string =>
  pathname.split('%25').map(decodeURI).join('%25');

/**
 * The predicate form of a route option, gated on a literal `true`: a Promise
 * (an async predicate) is truthy whatever it settles to, so read by truthiness
 * it would open every route it is asked about. A throw leaves the route
 * guarded and is logged, since the only other trace of it is a login redirect
 * on a page meant to be public. A pathname that does not decode resolves no
 * route — SvelteKit answers it `400` — so it stays guarded without asking.
 */
function gatePredicate(
  predicate: (pathname: string) => boolean,
  logger: AuthLogger,
  name: string
): (pathname: string) => boolean {
  return (pathname) => {
    let routed: string;
    try {
      routed = decodePathname(pathname);
    } catch {
      return false;
    }
    try {
      return predicate(routed) === true;
    } catch (err) {
      logger.error(
        `[auth] ${name} predicate threw for ${JSON.stringify(routed)} — the route stays guarded.`,
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
): (pathname: string) => boolean {
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
  return (pathname) =>
    entries.some((entry) =>
      entry.exact ? pathname === entry.path : pathname.startsWith(entry.path)
    );
}
