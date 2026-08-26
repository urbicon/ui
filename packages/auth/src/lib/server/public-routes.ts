import type { AuthLogger } from '../types.js';

/**
 * One entry of a handle's `publicRoutes`. A string is a pathname **prefix**
 * (`startsWith`); the object form adds `exact`, under which only that
 * pathname itself is exempt — the query string never takes part.
 *
 * `'/pricing'` exempts `/pricing`, `/pricing/`, `/pricing/team` *and*
 * `/pricing-admin`; `{ path: '/pricing', exact: true }` exempts `/pricing`
 * alone. `{ path: '/', exact: true }` is the only way to publish a landing page
 * without publishing every route under it.
 */
export type PublicRoute = string | { path: string; exact?: boolean };

/**
 * Compile a `publicRoutes` list into the predicate both handles guard with,
 * so the two cannot drift in how they read an entry.
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
  logger: AuthLogger
): (pathname: string) => boolean {
  // Snapshot: the caller keeps its array, and a later push into it must not
  // silently widen the guard.
  const entries = routes.map((route) =>
    typeof route === 'string'
      ? { path: route, exact: false }
      : { path: route.path, exact: route.exact === true }
  );
  if (entries.some((entry) => entry.path === '/' && !entry.exact)) {
    logger.warn(
      "[auth] publicRoutes contains '/' as a prefix, which exempts every route — the auth guard is off for the whole app. Use { path: '/', exact: true } for the landing page alone."
    );
  }
  return (pathname) =>
    entries.some((entry) =>
      entry.exact ? pathname === entry.path : pathname.startsWith(entry.path)
    );
}
