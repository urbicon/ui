import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CSRF_COOKIE_NAME,
  DEFAULT_CSRF_HEADER_NAME,
  ensureCsrfCookie,
  generateCsrfToken,
  timingSafeEqualStrings,
  validateCsrf
} from './csrf.js';

function makeRequest(method: string, origin?: string, headers?: Record<string, string>): Request {
  const h = new Headers();
  if (origin) h.set('origin', origin);
  for (const [k, v] of Object.entries(headers ?? {})) h.set(k, v);
  return new Request('http://localhost:3000/api/test', { method, headers: h });
}

/**
 * Minimal Cookies mock covering the subset SvelteKit's Cookies interface we use.
 */
function makeCookies(initial: Record<string, string> = {}): Cookies & {
  _store: Map<string, string>;
  _setCalls: Array<{ name: string; value: string; opts: unknown }>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  const setCalls: Array<{ name: string; value: string; opts: unknown }> = [];
  return {
    get: (name: string) => store.get(name),
    getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, opts: unknown) => {
      store.set(name, value);
      setCalls.push({ name, value, opts });
    },
    delete: (name: string) => {
      store.delete(name);
    },
    serialize: () => '',
    _store: store,
    _setCalls: setCalls
  } as unknown as Cookies & {
    _store: Map<string, string>;
    _setCalls: Array<{ name: string; value: string; opts: unknown }>;
  };
}

const url = new URL('http://localhost:3000');

describe('validateCsrf (origin check)', () => {
  it('allows GET requests', () => {
    expect(validateCsrf(makeRequest('GET'), url)).toBe(true);
  });

  it('allows HEAD requests', () => {
    expect(validateCsrf(makeRequest('HEAD'), url)).toBe(true);
  });

  it('rejects POST without origin header', () => {
    expect(validateCsrf(makeRequest('POST'), url)).toBe(false);
  });

  it('allows POST with matching origin', () => {
    expect(validateCsrf(makeRequest('POST', 'http://localhost:3000'), url)).toBe(true);
  });

  it('rejects POST with different origin', () => {
    expect(validateCsrf(makeRequest('POST', 'http://evil.com'), url)).toBe(false);
  });

  it('rejects POST with invalid origin URL', () => {
    expect(validateCsrf(makeRequest('POST', 'not-a-url'), url)).toBe(false);
  });

  it('rejects PUT without matching origin', () => {
    expect(validateCsrf(makeRequest('PUT', 'http://other.com'), url)).toBe(false);
  });

  it('rejects DELETE without matching origin', () => {
    expect(validateCsrf(makeRequest('DELETE', 'http://other.com'), url)).toBe(false);
  });
});

describe('validateCsrf (double-submit-cookie)', () => {
  const token = 'tok-abcdef1234567890';

  it('accepts when cookie and header tokens match', () => {
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: token });
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: token
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies })).toBe(true);
  });

  it('rejects when cookie token is missing', () => {
    const cookies = makeCookies({});
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: token
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies })).toBe(false);
  });

  it('rejects when header token is missing', () => {
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: token });
    const req = makeRequest('POST', 'http://localhost:3000');
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies })).toBe(false);
  });

  it('rejects when tokens differ', () => {
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: token });
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: 'wrong-token-xxxxxxxxxxxxxxxxxxx'
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies })).toBe(false);
  });

  it('rejects when tokens differ only by length', () => {
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: token });
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: `${token}x`
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies })).toBe(false);
  });

  it('fails closed when doubleSubmit is on but cookies handle is missing', () => {
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: token
    });
    expect(validateCsrf(req, url, { doubleSubmit: true })).toBe(false);
  });

  it('honours custom cookie and header names', () => {
    const cookies = makeCookies({ csrf_v2: token });
    const req = makeRequest('POST', 'http://localhost:3000', { 'x-my-csrf': token });
    expect(
      validateCsrf(req, url, {
        doubleSubmit: true,
        cookies,
        cookieName: 'csrf_v2',
        headerName: 'x-my-csrf'
      })
    ).toBe(true);
  });

  it('falls back to origin-only semantics when doubleSubmit is off', () => {
    const cookies = makeCookies({});
    const req = makeRequest('POST', 'http://localhost:3000');
    // Origin-only check passes; no double-submit required.
    expect(validateCsrf(req, url, { doubleSubmit: false, cookies })).toBe(true);
  });

  it('still runs the origin check before double-submit', () => {
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: token });
    const req = makeRequest('POST', 'http://evil.com', {
      [DEFAULT_CSRF_HEADER_NAME]: token
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies })).toBe(false);
  });
});

describe('generateCsrfToken', () => {
  it('returns a non-empty string', () => {
    const token = generateCsrfToken();
    expect(token.length).toBeGreaterThan(0);
  });

  it('returns a different value on each call', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(20);
  });

  it('contains only base64url-safe characters', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateCsrfToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('timingSafeEqualStrings', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualStrings('abcdef', 'abcdef')).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(timingSafeEqualStrings('abc', 'abcd')).toBe(false);
  });

  it('returns false when content differs', () => {
    expect(timingSafeEqualStrings('abcdef', 'abcxef')).toBe(false);
  });

  it('handles empty strings as equal', () => {
    expect(timingSafeEqualStrings('', '')).toBe(true);
  });
});

describe('ensureCsrfCookie', () => {
  it('generates and sets a new cookie when none exists', () => {
    const cookies = makeCookies();
    const token = ensureCsrfCookie(cookies);
    expect(token.length).toBeGreaterThan(0);
    expect(cookies.get(DEFAULT_CSRF_COOKIE_NAME)).toBe(token);
    expect(cookies._setCalls).toHaveLength(1);
    expect(cookies._setCalls[0]?.name).toBe(DEFAULT_CSRF_COOKIE_NAME);
    // The cookie must be readable from JS for the double-submit pattern to work.
    const opts = cookies._setCalls[0]?.opts as { httpOnly?: boolean };
    expect(opts.httpOnly).toBe(false);
  });

  it('reuses the existing cookie without generating a new token', () => {
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: 'existing-token' });
    const token = ensureCsrfCookie(cookies);
    expect(token).toBe('existing-token');
    expect(cookies._setCalls).toHaveLength(0);
  });

  it('sets sensible defaults: sameSite=lax, secure=true, path=/', () => {
    const cookies = makeCookies();
    ensureCsrfCookie(cookies);
    const opts = cookies._setCalls[0]?.opts as {
      path?: string;
      sameSite?: string;
      secure?: boolean;
    };
    expect(opts.path).toBe('/');
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(true);
  });

  it('honours the secure=false override for dev over http', () => {
    const cookies = makeCookies();
    ensureCsrfCookie(cookies, { secure: false });
    const opts = cookies._setCalls[0]?.opts as { secure?: boolean };
    expect(opts.secure).toBe(false);
  });

  it('uses the custom cookie name when provided', () => {
    const cookies = makeCookies();
    ensureCsrfCookie(cookies, { cookieName: 'csrf_v2' });
    expect(cookies._setCalls[0]?.name).toBe('csrf_v2');
  });
});

describe('CSRF __Host- prefix', () => {
  const token = 'tok-abcdef1234567890';

  it('ensureCsrfCookie sets the __Host--prefixed name with Secure + Path=/', () => {
    const cookies = makeCookies();
    ensureCsrfCookie(cookies, { hostPrefix: true });
    const call = cookies._setCalls[0];
    expect(call?.name).toBe(`__Host-${DEFAULT_CSRF_COOKIE_NAME}`);
    const opts = call?.opts as { path?: string; secure?: boolean };
    expect(opts.path).toBe('/');
    expect(opts.secure).toBe(true);
  });

  it('ensureCsrfCookie forces Secure even when secure:false is passed (prefix requires it)', () => {
    const cookies = makeCookies();
    ensureCsrfCookie(cookies, { hostPrefix: true, secure: false });
    const opts = cookies._setCalls[0]?.opts as { secure?: boolean };
    expect(opts.secure).toBe(true);
  });

  it('combines the prefix with a custom cookie name', () => {
    const cookies = makeCookies();
    ensureCsrfCookie(cookies, { hostPrefix: true, cookieName: 'csrf_v2' });
    expect(cookies._setCalls[0]?.name).toBe('__Host-csrf_v2');
  });

  it('validateCsrf reads the __Host--prefixed cookie when hostPrefix is set', () => {
    const cookies = makeCookies({ [`__Host-${DEFAULT_CSRF_COOKIE_NAME}`]: token });
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: token
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies, hostPrefix: true })).toBe(true);
  });

  it('validateCsrf does NOT read the unprefixed cookie when hostPrefix is set', () => {
    // Token only present under the unprefixed name → mismatch → reject.
    const cookies = makeCookies({ [DEFAULT_CSRF_COOKIE_NAME]: token });
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: token
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies, hostPrefix: true })).toBe(false);
  });

  it('round-trips: ensureCsrfCookie then validateCsrf with the same prefix', () => {
    const cookies = makeCookies();
    const issued = ensureCsrfCookie(cookies, { hostPrefix: true });
    const req = makeRequest('POST', 'http://localhost:3000', {
      [DEFAULT_CSRF_HEADER_NAME]: issued
    });
    expect(validateCsrf(req, url, { doubleSubmit: true, cookies, hostPrefix: true })).toBe(true);
  });
});
