import {
  csrfCookieName,
  DEFAULT_CSRF_COOKIE_NAME,
  DEFAULT_CSRF_HEADER_NAME
} from '../csrf-constants.js';

export interface CsrfClientOptions {
  cookieName?: string;
  headerName?: string;
  /**
   * Match the server's `csrf.useHostPrefix` — read the token from the
   * `__Host-`-prefixed cookie name. Leave `false` (default) unless the server
   * sets `useHostPrefix: true`.
   */
  useHostPrefix?: boolean;
}

/**
 * Read the CSRF token from document.cookie. Returns null outside the browser
 * or when the cookie is absent (e.g. before the server has set it).
 */
export function readCsrfToken(
  cookieName: string = DEFAULT_CSRF_COOKIE_NAME,
  useHostPrefix = false
): string | null {
  if (typeof document === 'undefined') return null;
  const name = csrfCookieName(cookieName, useHostPrefix);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Augment a `fetch` init object with the CSRF header. Safe to call even when
 * the token is missing — the init object is returned unchanged in that case,
 * so the server-side origin check stays the sole gatekeeper.
 */
export function withCsrfHeader(init: RequestInit = {}, options?: CsrfClientOptions): RequestInit {
  const token = readCsrfToken(options?.cookieName, options?.useHostPrefix);
  if (!token) return init;
  const headers = new Headers(init.headers);
  headers.set(options?.headerName ?? DEFAULT_CSRF_HEADER_NAME, token);
  return { ...init, headers };
}

/**
 * Thin fetch wrapper that automatically echoes the CSRF token for mutating
 * requests. Use from client components that talk to endpoints guarded by
 * the Double-Submit-Cookie pattern.
 *
 * `fetchImpl` swaps the underlying fetch implementation (mock backends in
 * demos/tests, custom retry/auth layers). Defaults to the global `fetch`.
 */
export function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options?: CsrfClientOptions,
  fetchImpl?: typeof globalThis.fetch
): Promise<Response> {
  const finalInit = withCsrfHeader(init, options);
  return fetchImpl ? fetchImpl(input, finalInit) : fetch(input, finalInit);
}
