/**
 * Resolve the authenticated caller's id from `event.locals`, fail-closed.
 *
 * The notification handlers deliberately read `locals.user` (set by
 * `createAuthHandle`) instead of re-resolving the session cookie: unlike the
 * passkey handlers they carry no user repository or JWT config, and adding
 * both just to re-do the hook's work would triple every factory signature.
 * The price is a shape contract: a consumer `transformUser` hook may reshape
 * `locals.user` arbitrarily, so this helper VALIDATES the one field these
 * handlers need instead of blindly casting — a reshaped object without a
 * string `id` yields `null` (→ 401) rather than `findByUserId(undefined)`
 * silently querying nothing. The minimum shape is documented on
 * `AuthConfig.hooks.transformUser`.
 */
export function localsUserId(locals: unknown): string | null {
  const user = (locals as { user?: { id?: unknown } } | undefined)?.user;
  return user && typeof user.id === 'string' && user.id.length > 0 ? user.id : null;
}
