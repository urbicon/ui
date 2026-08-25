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
 * Called from six places on purpose: the three cookie writers
 * (`setSessionCookie`, `ensureCsrfCookie`, the refresh cookie's `cookieOpts`)
 * and the wiring-time validator for each, so the rule cannot drift between the
 * check and the write — and no writable cookie is exempt from it.
 *
 * Pass the **effective** secure value, not the raw field: `ensureCsrfCookie`
 * force-sets `secure` under `useHostPrefix`, so a `cookieSecure: false` there
 * is overridden rather than illegal.
 *
 * @param scope names the config slice in the error, so the message points at
 *   the field the consumer has to change.
 */
export function assertCookieSameSiteSecure(
  scope: 'jwt' | 'csrf' | 'refreshToken',
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

/**
 * The one contradiction {@link isSecureDeployment} cannot express: `cookieSecure`
 * disagreeing between the cookie configs.
 *
 * Any explicit `false` declares the whole deployment non-HTTPS, so it switches
 * off HSTS, the production brute-force warnings, and the `__Host-` prefix **and**
 * `Secure` attribute of the 2FA and passkey-ceremony cookies. But each cookie is
 * still *written* with its own `cookieSecure ?? true`, so a config where the
 * values differ produces a deployment declared plain-HTTP that nonetheless emits
 * a `Secure` cookie the browser will drop. Both directions bite:
 *
 * - `csrf.cookieSecure: false` alone → HSTS and all four production warnings go
 *   away while the session cookie stays `Secure`, so nobody can log in over HTTP.
 * - `jwt.cookieSecure: false` with `csrf.doubleSubmit` and no `csrf.cookieSecure`
 *   → the CSRF cookie is written `Secure` over plain HTTP, is dropped, and every
 *   mutating request 403s.
 *
 * Returns the warning text, or `null` when the present configs agree. Only
 * configured slices count — an absent `csrf`/`refreshToken` writes no cookie and
 * is not a disagreement.
 */
export function describeCookieSecureDisagreement(config: {
  jwt: { cookieSecure?: boolean };
  csrf?: { cookieSecure?: boolean; useHostPrefix?: boolean };
  refreshToken?: { cookieSecure?: boolean };
}): string | null {
  const effective: [string, boolean][] = [['jwt', config.jwt.cookieSecure ?? true]];
  if (config.csrf) {
    // useHostPrefix force-sets Secure (see ensureCsrfCookie), so that is the
    // value the browser actually sees.
    effective.push([
      'csrf',
      config.csrf.useHostPrefix === true || (config.csrf.cookieSecure ?? true)
    ]);
  }
  if (config.refreshToken) {
    effective.push(['refreshToken', config.refreshToken.cookieSecure ?? true]);
  }

  const insecure = effective.filter(([, isSecure]) => !isSecure).map(([name]) => name);
  const secure = effective.filter(([, isSecure]) => isSecure).map(([name]) => name);
  if (insecure.length === 0 || secure.length === 0) return null;

  return (
    `[auth] cookieSecure disagrees between cookie configs: ${insecure.join(', ')} ` +
    `= false, ${secure.join(', ')} = true (default). Any explicit false marks the ` +
    'whole deployment non-HTTPS — HSTS and the production hardening warnings are ' +
    'off, and the 2FA + passkey cookies drop their __Host- prefix and Secure flag — ' +
    `while the ${secure.join('/')} cookie${secure.length > 1 ? 's are' : ' is'} ` +
    'still written Secure and a browser discards it over plain HTTP. Set ' +
    'cookieSecure: false on all of them for an HTTP dev deployment, or on none of ' +
    'them for HTTPS.'
  );
}
