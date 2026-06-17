import { goto as _goto } from '$app/navigation';
import { resolve as _resolve } from '$app/paths';

/**
 * Resolve a dynamic path string through SvelteKit's `resolve()` so the configured
 * `paths.base` prefix is honoured. Bypasses typed-routes type-check — use this
 * only when the path comes from a runtime value (navigation map entry, hash anchor,
 * search-result href). For statically known routes, call `resolve('/...')` directly.
 *
 * Non-absolute inputs (hash anchors like `'#'`, `mailto:`, `tel:`, external URLs)
 * are passed through unchanged — SvelteKit's `resolve()` rejects them at runtime,
 * so callers that fall back to placeholder hrefs would otherwise crash the page.
 */
export function r(path: string): string {
  if (!path.startsWith('/')) return path;
  // @ts-expect-error -- typed-routes can't infer dynamic path strings
  return _resolve(path);
}

/**
 * Navigate to a dynamic path. Wraps `goto(resolve(path))` and bypasses the
 * typed-routes type-check for the same reason as {@link r}. Non-absolute inputs
 * are passed straight to `goto`, matching {@link r}'s pass-through behaviour.
 */
export function nav(path: string): Promise<void> {
  if (!path.startsWith('/')) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- non-absolute paths are passed through; resolve() would throw on them
    return _goto(path);
  }
  // @ts-expect-error -- typed-routes can't infer dynamic path strings
  return _goto(_resolve(path));
}
