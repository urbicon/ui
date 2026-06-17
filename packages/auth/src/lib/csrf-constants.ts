/**
 * Shared defaults for the CSRF Double-Submit-Cookie pattern.
 *
 * Both the server-side validator/cookie-setter and the client-side
 * header-echo helpers reference these constants so consumers can override
 * them in one place via `AuthConfig.csrf`.
 */
export const DEFAULT_CSRF_COOKIE_NAME = 'urbicon_csrf';
export const DEFAULT_CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Resolve the effective CSRF cookie name. With `hostPrefix`, prepend the
 * `__Host-` cookie-name prefix: a `__Host-`-prefixed cookie can only be set
 * over HTTPS with `Path=/` and **no** `Domain` attribute, so a sibling or
 * parent subdomain cannot inject/overwrite it (cookie-tossing). Both the
 * server (set + validate) and the client (read + echo) must resolve the name
 * the same way, hence this shared helper.
 */
export function csrfCookieName(baseName: string, hostPrefix: boolean): string {
  return hostPrefix ? `__Host-${baseName}` : baseName;
}
