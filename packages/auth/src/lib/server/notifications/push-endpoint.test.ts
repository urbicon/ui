import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint, isPublicHttpsEndpoint } from './push-endpoint.js';

describe('isPublicHttpsEndpoint', () => {
  it('accepts a normal https push-service endpoint', () => {
    expect(isPublicHttpsEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPublicHttpsEndpoint('https://web.push.apple.com/xyz')).toBe(true);
    expect(isPublicHttpsEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(
      true
    );
  });

  it('rejects non-https schemes', () => {
    expect(isPublicHttpsEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPublicHttpsEndpoint('ftp://example.com')).toBe(false);
    expect(isPublicHttpsEndpoint('file:///etc/passwd')).toBe(false);
  });

  it('rejects the cloud metadata address and other link-local IPv4', () => {
    expect(isPublicHttpsEndpoint('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isPublicHttpsEndpoint('https://169.254.0.1/')).toBe(false);
  });

  it('rejects loopback and private IPv4 ranges', () => {
    expect(isPublicHttpsEndpoint('https://127.0.0.1/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://10.0.0.5/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://172.16.3.4/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://172.31.255.255/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://192.168.1.1/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://100.64.0.1/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://0.0.0.0/x')).toBe(false);
  });

  it('allows public IPv4 that merely looks adjacent to private ranges', () => {
    expect(isPublicHttpsEndpoint('https://172.32.0.1/x')).toBe(true); // just outside 172.16/12
    expect(isPublicHttpsEndpoint('https://192.169.0.1/x')).toBe(true);
    expect(isPublicHttpsEndpoint('https://8.8.8.8/x')).toBe(true);
  });

  it('rejects loopback / link-local / unique-local IPv6', () => {
    expect(isPublicHttpsEndpoint('https://[::1]/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://[::]/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://[fe80::1]/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://[fc00::1]/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://[fd12:3456::1]/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://[::ffff:127.0.0.1]/x')).toBe(false);
  });

  it('rejects localhost names, including the trailing-dot FQDN form', () => {
    expect(isPublicHttpsEndpoint('https://localhost/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://api.localhost/x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://localhost./x')).toBe(false);
    expect(isPublicHttpsEndpoint('https://127.0.0.1./x')).toBe(false);
  });

  it('catches alternative IPv4 encodings that the URL parser normalizes', () => {
    // new URL() normalizes these to dotted-decimal before the guard sees them.
    expect(isPublicHttpsEndpoint('https://2130706433/x')).toBe(false); // decimal 127.0.0.1
    expect(isPublicHttpsEndpoint('https://0x7f000001/x')).toBe(false); // hex 127.0.0.1
    expect(isPublicHttpsEndpoint('https://0177.0.0.1/x')).toBe(false); // octal first octet
  });

  it('checks the real host, not userinfo before an @ (credentials trick)', () => {
    // The host after the last @ is what fetch() hits, so the guard must see it.
    expect(isPublicHttpsEndpoint('https://fcm.googleapis.com@169.254.169.254/x')).toBe(false);
  });

  it('rejects malformed, empty, and oversized input', () => {
    expect(isPublicHttpsEndpoint('not a url')).toBe(false);
    expect(isPublicHttpsEndpoint('')).toBe(false);
    expect(isPublicHttpsEndpoint(null)).toBe(false);
    expect(isPublicHttpsEndpoint(123)).toBe(false);
    expect(isPublicHttpsEndpoint(`https://example.com/${'a'.repeat(3000)}`)).toBe(false);
  });
});

describe('isAllowedPushEndpoint', () => {
  const allow = ['fcm.googleapis.com', 'push.apple.com'];

  it('passes through the baseline guard when no allowlist is given', () => {
    expect(isAllowedPushEndpoint('https://anything-public.example.com/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://127.0.0.1/x')).toBe(false);
  });

  it('accepts exact and subdomain matches against the allowlist', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/send/x', allow)).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/x', allow)).toBe(true);
  });

  it('rejects hosts outside the allowlist even if otherwise public https', () => {
    expect(isAllowedPushEndpoint('https://evil.example.com/x', allow)).toBe(false);
    // suffix tricks: must not match a host that merely contains the allowed string
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x', allow)).toBe(false);
  });

  it('still rejects private hosts even when listed', () => {
    expect(isAllowedPushEndpoint('https://127.0.0.1/x', ['127.0.0.1'])).toBe(false);
  });
});
