import { base64UrlDecode } from '../encoding.js';
import { timingSafeEqual } from '../timing-safe.js';

/**
 * Equality of two web-push key pairs, compared on the **decoded bytes** so
 * base64url padding/alphabet quirks don't produce false negatives, and
 * constant-time because the `auth` value is secret material. Undecodable or
 * non-string input compares unequal (fail-closed).
 *
 * Used by the adapters' `pushSubscription.create` to gate the owner reassign
 * on key possession: the legitimate user-switch-in-the-same-browser case
 * re-sends the browser's existing subscription (same endpoint, same keys),
 * while an attacker who only learned the endpoint URL cannot present the
 * matching keys. Both fields are always compared (no short-circuit between
 * them) so the timing doesn't reveal which one mismatched.
 */
export function pushKeysEqual(
  a: { p256dh: string; auth: string },
  b: { p256dh: string; auth: string }
): boolean {
  try {
    const p256dhEqual = timingSafeEqual(base64UrlDecode(a.p256dh), base64UrlDecode(b.p256dh));
    const authEqual = timingSafeEqual(base64UrlDecode(a.auth), base64UrlDecode(b.auth));
    return p256dhEqual && authEqual;
  } catch {
    return false;
  }
}
