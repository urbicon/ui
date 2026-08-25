// One answer to "is this deployment HTTPS?" and one to "is this cookie's
// SameSite/Secure pair legal?", for every cookie the package writes.

/**
 * The package-wide "this deployment is not HTTPS" signal: an explicit
 * `cookieSecure: false` on **any** of the three cookie configs a consumer can
 * declare it on — session (`jwt`), CSRF, refresh. A deployment is one
 * transport, so one `false` settles the question for every cookie.
 *
 * Five decisions hang off it and every one of them breaks in the same way if
 * they disagree: the `__Host-` prefix on the 2FA and passkey-ceremony cookies,
 * their `Secure` attribute, the `__Host-` CSRF warning, HSTS, and whether the
 * brute-force resolver treats the config as production. A `__Host-`+`Secure`
 * cookie is dropped by the browser over plain HTTP, and the flows that lose it
 * report a *challenge-store* failure (`no_2fa_challenge`,
 * `Challenge expired or not found`) — the cookie name is nowhere in that
 * message, so a narrower signal costs the operator the whole debugging trail.
 *
 * Structural parameter, not `AuthConfig<R>`: this is the one predicate every
 * cookie site needs, and none of them care about the role generic.
 */
export function isSecureDeployment(config: {
  jwt: { cookieSecure?: boolean };
  csrf?: { cookieSecure?: boolean };
  refreshToken?: { cookieSecure?: boolean };
}): boolean {
  return (
    config.jwt.cookieSecure !== false &&
    config.csrf?.cookieSecure !== false &&
    config.refreshToken?.cookieSecure !== false
  );
}

/**
 * Modern browsers reject a `SameSite=None` cookie that is not also `Secure`,
 * so the combination is a misconfiguration: the cookie silently disappears in
 * some browsers and is accepted in others. Returns the resolved `secure` value
 * (default `true`) and throws on the illegal pair.
 *
 * Called from three places on purpose: the two cookie writers
 * (`setSessionCookie`, the refresh cookie's `cookieOpts`) and the wiring-time
 * validators, so the rule cannot drift between the check and the write.
 *
 * @param scope names the config slice in the error, so the message points at
 *   the field the consumer has to change.
 */
export function assertCookieSameSiteSecure(
  scope: 'jwt' | 'refreshToken',
  cookieSameSite: 'lax' | 'strict' | 'none' | undefined,
  cookieSecure: boolean | undefined
): boolean {
  const secure = cookieSecure ?? true;
  if ((cookieSameSite ?? 'lax') === 'none' && !secure) {
    throw new Error(
      `[auth] ${scope}.cookieSameSite: "none" requires ${scope}.cookieSecure: true — browsers reject SameSite=None without Secure.`
    );
  }
  return secure;
}
