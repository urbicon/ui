import { describe, expect, it } from 'vitest';
import { applySecurityHeaders } from './security-headers.js';

function makeResponse(): Response {
  return new Response('body', {
    status: 201,
    statusText: 'Created',
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('applySecurityHeaders — always-on headers', () => {
  it('sets the four baseline headers regardless of config', () => {
    const res = applySecurityHeaders(makeResponse());
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('preserves status, statusText, body and pre-existing headers', async () => {
    const res = applySecurityHeaders(makeResponse());
    expect(res.status).toBe(201);
    expect(res.statusText).toBe('Created');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.text()).toBe('body');
  });
});

describe('applySecurityHeaders — HSTS', () => {
  it('emits the default policy when no options are passed (secure by default)', () => {
    const res = applySecurityHeaders(makeResponse());
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains'
    );
  });

  it('emits the default policy when secure is true', () => {
    const res = applySecurityHeaders(makeResponse(), { secure: true });
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains'
    );
  });

  it('does NOT emit HSTS when secure is false (non-HTTPS dev)', () => {
    const res = applySecurityHeaders(makeResponse(), { secure: false });
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('does NOT emit HSTS when hsts is explicitly false', () => {
    const res = applySecurityHeaders(makeResponse(), { hsts: false });
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('uses a custom HSTS policy verbatim', () => {
    const res = applySecurityHeaders(makeResponse(), {
      hsts: 'max-age=31536000; includeSubDomains; preload'
    });
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
  });

  it('honours hsts:false even in a secure context', () => {
    const res = applySecurityHeaders(makeResponse(), { secure: true, hsts: false });
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });
});

describe('applySecurityHeaders — CSP', () => {
  it('emits the safe framing baseline by default', () => {
    const res = applySecurityHeaders(makeResponse());
    expect(res.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  });

  it('uses a custom CSP verbatim', () => {
    const policy = "default-src 'self'; frame-ancestors 'none'";
    const res = applySecurityHeaders(makeResponse(), { csp: policy });
    expect(res.headers.get('Content-Security-Policy')).toBe(policy);
  });

  it('does NOT emit CSP when csp is explicitly false', () => {
    const res = applySecurityHeaders(makeResponse(), { csp: false });
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('emits CSP independently of the secure flag (CSP is transport-agnostic)', () => {
    const res = applySecurityHeaders(makeResponse(), { secure: false });
    expect(res.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  });
});
