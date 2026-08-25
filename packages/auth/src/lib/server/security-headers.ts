/**
 * Response security headers applied by `createAuthHandle`.
 *
 * Always emitted (no config needed): `X-Content-Type-Options`,
 * `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
 *
 * Configurable (via {@link SecurityHeadersConfig}, exposed as
 * `AuthConfig.securityHeaders`): HSTS and CSP — both carry secure defaults so
 * doing nothing still hardens the response.
 */
export interface SecurityHeadersConfig {
  /**
   * `Strict-Transport-Security` policy value. Emitted only in a secure
   * deployment (HTTPS — see the `secure` flag passed by `createAuthHandle`,
   * derived from `isSecureDeployment`); over plain HTTP browsers ignore the
   * header anyway and emitting it during local dev would pin `localhost` to
   * HTTPS. Behind a TLS-terminating proxy keep `cookieSecure` truthy on all
   * three cookie configs (the standard setup) so HSTS stays enabled.
   *
   * - omitted → default `max-age=63072000; includeSubDomains` (2 years).
   * - string → used verbatim (e.g. add `; preload` once you are sure).
   * - `false` → never emit HSTS.
   */
  hsts?: string | false;
  /**
   * `Content-Security-Policy` value. A full policy is app-specific (its
   * `script-src`/`style-src`/… depend on what the app loads), so this is a
   * hook rather than a complete policy.
   *
   * - omitted → safe baseline `frame-ancestors 'none'`, which blocks framing
   *   (clickjacking) — the modern complement to `X-Frame-Options: DENY` —
   *   without restricting the app's own resources.
   * - string → used verbatim (supply your full policy to harden further).
   * - `false` → never emit CSP.
   */
  csp?: string | false;
}

const DEFAULT_HSTS = 'max-age=63072000; includeSubDomains';
const DEFAULT_CSP = "frame-ancestors 'none'";

export interface ApplySecurityHeadersOptions extends SecurityHeadersConfig {
  /**
   * Whether the deployment serves over HTTPS. Gates HSTS (default `true`).
   * `createAuthHandle` derives this from `isSecureDeployment(config)` — an
   * explicit `cookieSecure: false` on the session, CSRF or refresh cookie.
   */
  secure?: boolean;
}

export function applySecurityHeaders(
  response: Response,
  options?: ApplySecurityHeadersOptions
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS — only meaningful over HTTPS. A consumer can opt out with `hsts: false`.
  if (options?.secure !== false && options?.hsts !== false) {
    headers.set('Strict-Transport-Security', options?.hsts ?? DEFAULT_HSTS);
  }

  // CSP — safe framing baseline by default; opt out with `csp: false`.
  if (options?.csp !== false) {
    headers.set('Content-Security-Policy', options?.csp ?? DEFAULT_CSP);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
