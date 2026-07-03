import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './redirect.js';

describe('sanitizeRedirect', () => {
  it('passes an internal absolute path through, keeping query and hash', () => {
    expect(sanitizeRedirect('/dashboard', '/')).toBe('/dashboard');
    expect(sanitizeRedirect('/a/b?x=1&y=2#frag', '/')).toBe('/a/b?x=1&y=2#frag');
  });

  it('falls back for missing or empty input', () => {
    expect(sanitizeRedirect(null, '/fallback')).toBe('/fallback');
    expect(sanitizeRedirect(undefined, '/fallback')).toBe('/fallback');
    expect(sanitizeRedirect('', '/fallback')).toBe('/fallback');
  });

  it('rejects absolute URLs (the classic open redirect)', () => {
    expect(sanitizeRedirect('https://evil.test/phish', '/')).toBe('/');
    expect(sanitizeRedirect('http://evil.test', '/')).toBe('/');
    expect(sanitizeRedirect('javascript:alert(1)', '/')).toBe('/');
  });

  it('rejects protocol-relative URLs and their backslash variant', () => {
    // '//evil.test' resolves to https://evil.test in a browser navigation.
    expect(sanitizeRedirect('//evil.test/phish', '/')).toBe('/');
    // Browsers normalize '/\' to '//' before resolving.
    expect(sanitizeRedirect('/\\evil.test', '/')).toBe('/');
  });

  it('rejects relative (non-slash) paths — the guard only ever emits absolute ones', () => {
    expect(sanitizeRedirect('dashboard', '/')).toBe('/');
    expect(sanitizeRedirect('../admin', '/')).toBe('/');
  });

  it('normalizes an embedded backslash instead of letting it re-form an authority', () => {
    // WHATWG URL treats '\' as '/' inside a path — the result stays internal.
    const out = sanitizeRedirect('/a\\b', '/');
    expect(out.startsWith('/')).toBe(true);
    expect(out.startsWith('//')).toBe(false);
  });

  it('rejects dot-segment smuggling that re-forms a protocol-relative URL', () => {
    // '/..//evil.test' passes the raw startsWith gates, but the parser
    // normalizes the dot segment away and leaves pathname '//evil.test' —
    // which a browser resolves to https://evil.test. The normalized-output
    // check is the only line that stops these.
    expect(sanitizeRedirect('/..//evil.test/phish', '/')).toBe('/');
    expect(sanitizeRedirect('/%2e%2e//evil.test', '/')).toBe('/');
    expect(sanitizeRedirect('/a/..//evil.test', '/')).toBe('/');
    expect(sanitizeRedirect('/.//evil.test', '/')).toBe('/');
    expect(sanitizeRedirect('/a/b/../../..//evil.test', '/')).toBe('/');
  });

  it('rejects whitespace-smuggled authority escapes that slip past the prefix gate', () => {
    // WHATWG URL strips tabs/newlines BEFORE parsing, so '/\t/evil.test'
    // passes the raw startsWith checks yet resolves to http://evil.test —
    // only the sentinel-origin comparison catches it.
    expect(sanitizeRedirect('/\t/evil.test', '/')).toBe('/');
    expect(sanitizeRedirect('/\n//evil.test', '/')).toBe('/');
  });

  it('round-trips the value the auth handle encodes', () => {
    const requested = '/account/settings?tab=security';
    const query = `redirectTo=${encodeURIComponent(requested)}`;
    const value = new URLSearchParams(query).get('redirectTo');
    expect(sanitizeRedirect(value, '/')).toBe(requested);
  });
});
