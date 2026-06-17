/**
 * SSRF guard for Web-Push endpoints.
 *
 * An authenticated user supplies the push `endpoint` URL, and the server later
 * does `fetch(endpoint, …)` to deliver notifications (see `push.ts`). Without a
 * guard a user could point the endpoint at an internal address
 * (`https://169.254.169.254/…` for cloud metadata, `https://127.0.0.1/…`,
 * RFC 1918 ranges) and turn the push sender into an SSRF probe.
 *
 * The baseline guard is: HTTPS only, and reject literal private / loopback /
 * link-local / unspecified IP hosts (v4 and v6) plus localhost names. An
 * optional host allowlist narrows further to known push services.
 *
 * Note: this checks the URL host, not a resolved IP — it is not a defense
 * against DNS rebinding (a public name resolving to a private IP). Pair with an
 * egress firewall / `allowedHosts` allowlist where that matters.
 */

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map((o) => Number(o));
  if (octets.some((o) => o > 255)) return false; // not a valid IPv4 literal
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 "this" network
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fe80:')) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 unique-local
  // IPv4-mapped IPv6, dotted form (::ffff:127.0.0.1).
  const dotted = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return isPrivateIPv4(dotted[1]);
  // IPv4-mapped IPv6, hex form the URL parser normalizes to (::ffff:7f00:1).
  const hex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIPv4(v4);
  }
  return false;
}

function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost');
}

/**
 * True when `endpoint` is a syntactically valid HTTPS URL to a host that is not
 * a private/loopback/link-local IP literal or a localhost name.
 */
export function isPublicHttpsEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  // Strip a trailing dot: `localhost.` / `127.0.0.1.` are FQDN forms that still
  // resolve locally but would slip past the name/IP checks otherwise.
  const host = url.hostname.replace(/\.$/, '');
  if (isLocalHostname(host)) return false;
  if (isPrivateIPv4(host)) return false;
  if (isPrivateIPv6(host)) return false;
  return true;
}

/**
 * Full acceptance check for a push endpoint: the baseline {@link
 * isPublicHttpsEndpoint} guard plus, when `allowedHosts` is non-empty, a
 * suffix-match allowlist (`'push.apple.com'` matches `web.push.apple.com`).
 */
export function isAllowedPushEndpoint(endpoint: unknown, allowedHosts?: string[]): boolean {
  if (!isPublicHttpsEndpoint(endpoint)) return false;
  if (!allowedHosts || allowedHosts.length === 0) return true;
  const host = new URL(endpoint as string).hostname.toLowerCase();
  return allowedHosts.some((raw) => {
    const allowed = raw.toLowerCase().replace(/^\./, '');
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}
