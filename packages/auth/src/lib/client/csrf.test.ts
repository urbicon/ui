import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCsrfToken, withCsrfHeader } from './csrf.js';

/**
 * Mock a minimal document.cookie getter — the client helpers only read
 * `document.cookie` once per call, so this is enough. Avoids pulling in
 * jsdom as a dev dependency for a handful of string-parsing tests.
 */
function mockCookies(value: string): void {
  (globalThis as unknown as { document: { cookie: string } }).document = { cookie: value };
}

function clearDocument(): void {
  delete (globalThis as unknown as { document?: unknown }).document;
}

describe('readCsrfToken', () => {
  beforeEach(() => mockCookies(''));
  afterEach(() => clearDocument());

  it('returns null when document is undefined (SSR)', () => {
    clearDocument();
    expect(readCsrfToken()).toBeNull();
  });

  it('returns null when the cookie is absent', () => {
    mockCookies('other=x; another=y');
    expect(readCsrfToken()).toBeNull();
  });

  it('reads the default cookie name', () => {
    mockCookies('urbicon_csrf=abc123; path=/');
    expect(readCsrfToken()).toBe('abc123');
  });

  it('reads a custom cookie name', () => {
    mockCookies('csrf_v2=my-token');
    expect(readCsrfToken('csrf_v2')).toBe('my-token');
  });

  it('picks the right cookie when several are present', () => {
    mockCookies('session=xxx; urbicon_csrf=target; theme=dark');
    expect(readCsrfToken()).toBe('target');
  });

  it('decodes percent-encoded values', () => {
    mockCookies('urbicon_csrf=hello%20world');
    expect(readCsrfToken()).toBe('hello world');
  });

  it('is resilient against regex-special characters in the cookie name', () => {
    mockCookies('my.csrf+name=value42');
    expect(readCsrfToken('my.csrf+name')).toBe('value42');
  });

  it('does not match a cookie whose name is a suffix of the requested name', () => {
    // "other_csrf" ends with "csrf" but the exact name we want is "csrf".
    mockCookies('other_csrf=nope');
    expect(readCsrfToken('csrf')).toBeNull();
  });

  it('reads the __Host--prefixed cookie when useHostPrefix is set', () => {
    mockCookies('__Host-urbicon_csrf=hosttok; theme=dark');
    expect(readCsrfToken(undefined, true)).toBe('hosttok');
    // Without the prefix flag, the unprefixed name does not match.
    expect(readCsrfToken()).toBeNull();
  });

  it('combines useHostPrefix with a custom cookie name', () => {
    mockCookies('__Host-csrf_v2=custom-host-tok');
    expect(readCsrfToken('csrf_v2', true)).toBe('custom-host-tok');
  });
});

describe('withCsrfHeader', () => {
  beforeEach(() => mockCookies(''));
  afterEach(() => clearDocument());

  it('returns the init object unchanged when no token is available', () => {
    const init: RequestInit = { method: 'POST' };
    const result = withCsrfHeader(init);
    expect(result).toEqual(init);
  });

  it('adds the default header when the token is present', () => {
    mockCookies('urbicon_csrf=tok42');
    const result = withCsrfHeader({ method: 'POST' });
    const headers = new Headers(result.headers);
    expect(headers.get('x-csrf-token')).toBe('tok42');
    expect(result.method).toBe('POST');
  });

  it('honours custom cookie and header names', () => {
    mockCookies('csrf_v2=zzz');
    const result = withCsrfHeader({}, { cookieName: 'csrf_v2', headerName: 'x-my-csrf' });
    const headers = new Headers(result.headers);
    expect(headers.get('x-my-csrf')).toBe('zzz');
  });

  it('echoes the token from the __Host--prefixed cookie when configured', () => {
    mockCookies('__Host-urbicon_csrf=hosttok');
    const result = withCsrfHeader({ method: 'POST' }, { useHostPrefix: true });
    const headers = new Headers(result.headers);
    expect(headers.get('x-csrf-token')).toBe('hosttok');
  });

  it('preserves previously set headers', () => {
    mockCookies('urbicon_csrf=tok99');
    const result = withCsrfHeader({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    });
    const headers = new Headers(result.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('tok99');
  });
});
