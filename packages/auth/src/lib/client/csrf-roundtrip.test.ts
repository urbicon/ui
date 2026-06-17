import type { Cookies } from '@sveltejs/kit';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureCsrfCookie, validateCsrf } from '../server/csrf.js';
import { withCsrfHeader } from './csrf.js';

/**
 * Cluster B regression: the shipped client helpers and the server validator
 * must agree on the CSRF token end-to-end. The bug was that the package
 * exported `csrfFetch`/`withCsrfHeader` but the stores/components used bare
 * `fetch`, so enabling `config.csrf.doubleSubmit` 403-ed every mutating
 * request from the bundled UI. This test pins the round trip: the token the
 * server sets is the token the client echoes is the token the server accepts.
 */

function mockCookies(initial: Record<string, string> = {}): Cookies {
  const store = new Map(Object.entries(initial));
  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => store.set(name, value),
    delete: (name: string) => store.delete(name),
    getAll: () => [],
    serialize: () => ''
  } as unknown as Cookies;
}

function setDocumentCookie(value: string): void {
  (globalThis as unknown as { document: { cookie: string } }).document = { cookie: value };
}

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
});

describe('CSRF client↔server round trip (doubleSubmit)', () => {
  const url = new URL('https://app.test/api/auth/login');

  it('accepts a mutating request whose header echoes the server-set cookie', () => {
    // 1. Server seeds the CSRF cookie (as the handle hook does on safe requests).
    const cookies = mockCookies();
    const token = ensureCsrfCookie(cookies, { secure: true });

    // 2. The browser now holds that cookie; the client helper reads it.
    setDocumentCookie(`urbicon_csrf=${token}`);
    const init = withCsrfHeader({ method: 'POST' });

    // 3. The mutating request carries the echoed header + a same-origin Origin.
    const headers = new Headers(init.headers);
    headers.set('origin', url.origin);
    const request = new Request(url, { method: 'POST', headers });

    // 4. The server validator (doubleSubmit on) accepts it — no 403.
    expect(validateCsrf(request, url, { doubleSubmit: true, cookies })).toBe(true);
  });

  it('rejects the same request when the client did NOT echo the header (the old bug)', () => {
    const cookies = mockCookies();
    ensureCsrfCookie(cookies, { secure: true });

    // Bare fetch: no CSRF header set.
    const request = new Request(url, { method: 'POST', headers: { origin: url.origin } });

    expect(validateCsrf(request, url, { doubleSubmit: true, cookies })).toBe(false);
  });

  it('round-trips with custom cookie/header names too', () => {
    const cookies = mockCookies();
    const token = ensureCsrfCookie(cookies, { cookieName: 'csrf_v2', secure: true });

    setDocumentCookie(`csrf_v2=${token}`);
    const init = withCsrfHeader(
      { method: 'POST' },
      { cookieName: 'csrf_v2', headerName: 'x-my-csrf' }
    );

    const headers = new Headers(init.headers);
    headers.set('origin', url.origin);
    const request = new Request(url, { method: 'POST', headers });

    expect(
      validateCsrf(request, url, {
        doubleSubmit: true,
        cookies,
        cookieName: 'csrf_v2',
        headerName: 'x-my-csrf'
      })
    ).toBe(true);
  });

  it('round-trips with the __Host- prefix (server sets, client echoes, server accepts)', () => {
    // Server sets the __Host--prefixed cookie...
    const cookies = mockCookies();
    const token = ensureCsrfCookie(cookies, { hostPrefix: true });

    // ...the browser holds it under the prefixed name; the client reads it
    // only when told to use the prefix.
    setDocumentCookie(`__Host-urbicon_csrf=${token}`);
    const init = withCsrfHeader({ method: 'POST' }, { useHostPrefix: true });

    const headers = new Headers(init.headers);
    headers.set('origin', url.origin);
    const request = new Request(url, { method: 'POST', headers });

    expect(validateCsrf(request, url, { doubleSubmit: true, cookies, hostPrefix: true })).toBe(
      true
    );
  });

  it('rejects when the server uses __Host- but the client forgot useHostPrefix', () => {
    // Server set the prefixed cookie; the browser holds it under the prefixed
    // name. But the client reads with the default (unprefixed) name → finds
    // nothing → sends no header → server (hostPrefix on) rejects. Proves the
    // shared csrfCookieName helper must be configured on BOTH sides.
    const cookies = mockCookies();
    ensureCsrfCookie(cookies, { hostPrefix: true });

    setDocumentCookie('__Host-urbicon_csrf=sometoken');
    const init = withCsrfHeader({ method: 'POST' }); // useHostPrefix omitted

    const headers = new Headers(init.headers);
    headers.set('origin', url.origin);
    const request = new Request(url, { method: 'POST', headers });

    expect(validateCsrf(request, url, { doubleSubmit: true, cookies, hostPrefix: true })).toBe(
      false
    );
  });

  it('still works in origin-only mode (no cookie) — withCsrfHeader is a true no-op, server accepts', () => {
    // doubleSubmit off: the always-on origin check is the sole gate. With no
    // token cookie present, withCsrfHeader must return the SAME init object
    // untouched — assert reference equality, which actually exercises the
    // no-op contract (a header-absence check would pass trivially since the
    // init has no headers to begin with).
    const init: RequestInit = { method: 'POST' };
    expect(withCsrfHeader(init)).toBe(init);

    const request = new Request(url, { method: 'POST', headers: { origin: url.origin } });
    expect(validateCsrf(request, url)).toBe(true);
  });
});
