/**
 * A process-lifetime key for one `jwt.secret` that is not the secret. Two
 * registries outlive every config object and key on it: the repeat-bundle
 * warning in `createAuthDeps` and the rate-limit counters in `sharedLimiter`.
 * Neither may retain a secret the consumer has rotated away.
 *
 * Synchronous by necessity — `crypto.subtle.digest` is async and neither
 * caller is — so two 32-bit lanes with different mixing stand in for a digest.
 * A collision would merge two secrets' counters and cost one spurious warning;
 * at 64 bits that is a 2⁻⁶⁴ chance per pair of secrets.
 */
export function fingerprint(secret: string): string {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < secret.length; i++) {
    const code = secret.charCodeAt(i);
    fnv = Math.imul(fnv ^ code, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  return `${(fnv >>> 0).toString(16)}:${(djb >>> 0).toString(16)}`;
}
