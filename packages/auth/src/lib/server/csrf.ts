import type { Cookies } from '@sveltejs/kit';
import {
  csrfCookieName,
  DEFAULT_CSRF_COOKIE_NAME,
  DEFAULT_CSRF_HEADER_NAME
} from '../csrf-constants.js';
import { base64UrlEncode } from './encoding.js';
import { timingSafeEqualStrings } from './timing-safe.js';

// Re-export so existing `from './csrf.js'` imports keep working.
export { DEFAULT_CSRF_COOKIE_NAME, DEFAULT_CSRF_HEADER_NAME, timingSafeEqualStrings };

const CSRF_TOKEN_BYTES = 32;
const CSRF_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

let csrfMisconfigurationWarned = false;

export interface CsrfValidateOptions {
  /** When set, enforces the Double-Submit-Cookie pattern on top of the origin check. */
  doubleSubmit?: boolean;
  /** SvelteKit cookies handle. Required when `doubleSubmit` is true. */
  cookies?: Cookies;
  /** Cookie name holding the CSRF token (default: `urbicon_csrf`). */
  cookieName?: string;
  /** Header name carrying the echoed CSRF token (default: `x-csrf-token`). */
  headerName?: string;
  /**
   * Read the token from the `__Host-`-prefixed cookie name. Must match the
   * value used when the cookie was set (`ensureCsrfCookie`) and on the client.
   */
  hostPrefix?: boolean;
}

export interface EnsureCsrfCookieOptions {
  cookieName?: string;
  /** Secure attribute for the cookie. Default `true`; set `false` for non-HTTPS dev. */
  secure?: boolean;
  /** Override the SameSite value. Default `'lax'`. */
  sameSite?: 'lax' | 'strict' | 'none';
  /** Max-Age in seconds (default: 7 days). */
  maxAge?: number;
  /**
   * Use the `__Host-` cookie-name prefix. Hardens against subdomain cookie
   * injection but **requires** HTTPS — the prefix forces `secure: true` and
   * `path: '/'` regardless of the other options (the browser drops a
   * `__Host-` cookie that lacks them).
   */
  hostPrefix?: boolean;
}

/**
 * Generate a cryptographically strong CSRF token (32 random bytes, base64url-encoded).
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Validate an incoming request against CSRF attacks.
 *
 * Layer 1 (always): Origin-header check — the request's `Origin` must match
 * the server origin. GET and HEAD are skipped (safe methods).
 *
 * Layer 2 (opt-in via `options.doubleSubmit`): Double-Submit-Cookie — the
 * token in the CSRF cookie must match the token sent in the CSRF header.
 * This defends against CORS-related attacks that can satisfy the Origin
 * check but cannot read the cookie set by the server.
 *
 * Independent of SvelteKit's built-in `kit.csrf.checkOrigin`, which runs in
 * the request kernel *before* any hook and so still gates handle-bypassed
 * routes. This check is stricter — all mutating methods, all content types
 * (incl. JSON), no `trustedOrigins` allow-list — i.e. a strict superset of
 * the kernel gate for every request routed through `createAuthHandle`. A
 * consumer exposing a cross-origin form-encoded endpoint *outside* the handle
 * must turn the kernel check off (`kit.csrf.trustedOrigins: ['*']`) and rely
 * on this gate. See docs/AUTH.md → Known Limitations & Security Gaps.
 */
export function validateCsrf(request: Request, url: URL, options?: CsrfValidateOptions): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true;

  // Layer 1: Origin check
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const requestOrigin = new URL(origin);
    if (requestOrigin.origin !== url.origin) return false;
  } catch {
    return false;
  }

  // Layer 2 (opt-in): Double-Submit-Cookie
  if (options?.doubleSubmit) {
    if (!options.cookies) {
      // Misconfiguration — treat as failure rather than silently downgrading.
      // Emit a loud signal once per process so consumers notice the broken
      // wiring instead of silently 403-ing every mutating request.
      if (!csrfMisconfigurationWarned) {
        csrfMisconfigurationWarned = true;

        console.error(
          '[auth] validateCsrf: doubleSubmit enabled but no `cookies` passed — every mutating request will fail CSRF. Wire `options.cookies` into the handle hook.'
        );
      }
      return false;
    }
    const cookieName = csrfCookieName(
      options.cookieName ?? DEFAULT_CSRF_COOKIE_NAME,
      options.hostPrefix ?? false
    );
    const headerName = options.headerName ?? DEFAULT_CSRF_HEADER_NAME;

    const cookieToken = options.cookies.get(cookieName);
    const headerToken = request.headers.get(headerName);

    if (!cookieToken || !headerToken) return false;
    if (!timingSafeEqualStrings(cookieToken, headerToken)) return false;
  }

  return true;
}

/**
 * Ensure the CSRF cookie is present. Called on safe requests so the client
 * has a token to echo back on subsequent mutating requests. Returns the
 * token (existing or freshly generated) for server-side rendering scenarios
 * where the token is inlined into a form.
 *
 * Cookie is **not** `httpOnly` — the pattern relies on JS being able to
 * read it and send it back in a header or form field.
 */
export function ensureCsrfCookie(cookies: Cookies, options?: EnsureCsrfCookieOptions): string {
  const hostPrefix = options?.hostPrefix ?? false;
  const cookieName = csrfCookieName(options?.cookieName ?? DEFAULT_CSRF_COOKIE_NAME, hostPrefix);
  const existing = cookies.get(cookieName);
  if (existing) return existing;

  const token = generateCsrfToken();
  cookies.set(cookieName, token, {
    // `__Host-` requires Path=/, Secure, and NO Domain attribute; force the
    // first two and pin Domain unset so the browser keeps the cookie instead
    // of silently dropping it (otherwise double-submit would 403 every
    // mutating request). `domain: undefined` makes the no-Domain invariant
    // explicit and immune to a host ever defaulting one in.
    path: '/',
    sameSite: options?.sameSite ?? 'lax',
    secure: hostPrefix ? true : (options?.secure ?? true),
    ...(hostPrefix ? { domain: undefined } : {}),
    httpOnly: false,
    maxAge: options?.maxAge ?? CSRF_COOKIE_MAX_AGE
  });
  return token;
}
