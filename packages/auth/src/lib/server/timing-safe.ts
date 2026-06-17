/**
 * Constant-time comparison helpers, shared across the auth core (JWT HMAC,
 * password-hash verify) and the CSRF double-submit check so the timing-safe
 * discipline lives in exactly one place.
 *
 * Both functions short-circuit **only** on a length mismatch; for equal
 * lengths every element is compared regardless of where the first difference
 * is, so the running time does not leak how many leading bytes/chars matched.
 */

/** Constant-time byte comparison. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/** Constant-time string comparison over UTF-16 code units. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
