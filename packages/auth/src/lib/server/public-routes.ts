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
 * Which option a route list came from — what the construction-time messages
 * name, so a typo in `csrf.exempt` is not reported against `publicRoutes`.
 */
export interface RouteListOption {
  /** The option as the consumer spells it. */
  name: string;
  /**
   * What a bare `'/'` prefix does to the app and what to write instead: the
   * clause after "exempts every route —" in the warning.
   */
  bareSlash: string;
}

const PUBLIC_ROUTES_OPTION: RouteListOption = {
  name: 'publicRoutes',
  bareSlash:
    "the auth guard is off for the whole app. Use { path: '/', exact: true } for the landing page alone."
};

/**
 * Compile a route list into the predicate both handles guard with — and the
 * one `csrf.exempt` matches with — so the three cannot drift in how they read
 * an entry.
 *
 * Refuses, at construction, a path that does not start with `/`: `''` is the
 * silent fail-open twin of `'/'` (`startsWith('')` holds for every pathname,
 * and no warning names it), a bare `'pricing'` the silent fail-closed one (it
 * matches nothing). Both are typos, so both throw where the typo is fixable.
 *
 * Warns — once, here, not per request — when a bare `'/'` prefix is in the
 * list: as a prefix it matches every pathname, so the guard is off for the
 * whole app, and the entry is the natural misspelling of "my landing page is
 * public". A warning rather than a throw, because a fully public site that
 * mounts the handle only for session hydration (`locals.user` on every page)
 * is a legitimate configuration and this is its only spelling.
 */
export function compilePublicRoutes(
  routes: readonly PublicRoute[],
  logger: AuthLogger,
  option: RouteListOption = PUBLIC_ROUTES_OPTION
): (pathname: string) => boolean {
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
    return entry;
  });
  if (entries.some((entry) => entry.path === '/' && !entry.exact)) {
    logger.warn(
      `[auth] ${option.name} contains '/' as a prefix, which exempts every route — ${option.bareSlash}`
    );
  }
  return (pathname) =>
    entries.some((entry) =>
      entry.exact ? pathname === entry.path : pathname.startsWith(entry.path)
    );
}
