import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthLogger, RateLimitConfig } from '../../../types.js';
import type {
  PushSubscriptionRepository,
  PushSubscriptionWriteOutcome
} from '../../adapters/types.js';
import { base64UrlDecode } from '../../encoding.js';
import { authError } from '../../handlers/errors.js';
import { shieldLogger } from '../../logger.js';
import { enforceRateLimit, makeRateLimiter } from '../../rate-limit.js';
import { readJsonBody } from '../../validation.js';
import { isAllowedPushEndpoint } from '../push-endpoint.js';
import { localsUserId } from './locals-user.js';

/**
 * Structurally validate the subscription `keys` before persisting. RFC 8291
 * requires `p256dh` to be an uncompressed P-256 public key (65 bytes, leading
 * `0x04`) and `auth` to be a 16-byte secret. Decoding normalizes any
 * padding/alphabet quirks and rejects garbage, so a malformed subscription
 * can't sit in the DB and make every later push throw inside `importKey`.
 */
function isValidWebPushKeys(keys: unknown): keys is { p256dh: string; auth: string } {
  if (typeof keys !== 'object' || keys === null) return false;
  const { p256dh, auth } = keys as Record<string, unknown>;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return false;
  // Bound the raw strings before decoding (a P-256 key is 87 base64url chars,
  // the auth secret 22) — defense against an oversized decode.
  if (p256dh.length > 200 || auth.length > 100) return false;
  try {
    const pub = base64UrlDecode(p256dh);
    const secret = base64UrlDecode(auth);
    return pub.length === 65 && pub[0] === 0x04 && secret.length === 16;
  } catch {
    return false;
  }
}

export interface PushSubscriptionHandlerOptions {
  /**
   * Restrict accepted push endpoints to hosts matching one of these suffixes
   * (e.g. `['fcm.googleapis.com', 'push.apple.com', 'updates.push.services.mozilla.com']`).
   * `'push.apple.com'` also matches `web.push.apple.com`. When omitted, any
   * HTTPS endpoint to a public host is accepted. The HTTPS + private-range SSRF
   * guard always applies regardless.
   */
  allowedEndpointHosts?: string[];
  /**
   * Rate limit for the mutating endpoints (POST and DELETE share one budget),
   * keyed by the authenticated user id — the endpoints require a session, and
   * a per-user key can't be dodged by rotating IPs. Subscribe/unsubscribe is a
   * rare user action, so the default of 10/min is generous for real use and a
   * wall for scripted abuse. Pass `null` to disable.
   */
  rateLimit?: RateLimitConfig | null;
  /**
   * Upper bound on stored subscriptions per user — a cost guard: every stored
   * row is a network fetch on every push send to that user. The cap applies
   * only to endpoints not yet registered for the user; re-subscribing an
   * existing endpoint (the browser's normal case) always passes. Exceeding it
   * answers `409`. Default 10 (≈ a device fleet, not a script). The check is
   * read-then-write and therefore approximate under concurrency — fine for a
   * cost guard.
   */
  maxSubscriptionsPerUser?: number;
  /**
   * Sink for the two write outcomes worth an operator's attention:
   * `'rejected'` (warn — an authenticated account presented a foreign
   * endpoint with non-matching keys, i.e. someone is replaying endpoint URLs
   * they don't own) and `'reassigned'` (a push channel moved between
   * accounts with key possession proven — legitimate, but the previous
   * owner's channel just went quiet, so it should be correlatable).
   * Defaults to `console`; calls are shielded. Endpoint URLs are never
   * logged (capability discipline) — only the acting user id.
   */
  logger?: AuthLogger;
}

/** Default POST/DELETE limit — see {@link PushSubscriptionHandlerOptions.rateLimit}. */
const DEFAULT_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, max: 10 };

export function createPushSubscriptionHandler(
  repo: PushSubscriptionRepository,
  options?: PushSubscriptionHandlerOptions
): {
  POST: RequestHandler;
  DELETE: RequestHandler;
} {
  const rateLimiter = makeRateLimiter(
    options?.rateLimit === null ? undefined : (options?.rateLimit ?? DEFAULT_RATE_LIMIT)
  );
  const maxSubscriptionsPerUser = options?.maxSubscriptionsPerUser ?? 10;
  const logger = shieldLogger(options?.logger ?? console);
  // Tripwire for adapters predating the key gate (still returning void):
  // with them the takeover gate simply does not exist, and every write
  // reports success — warn once so the absent gate is visible.
  let warnedVoidOutcome = false;

  return {
    POST: async ({ request, locals }) => {
      const userId = localsUserId(locals);
      if (!userId) {
        return authError('not_authenticated');
      }

      const limited = await enforceRateLimit(rateLimiter, userId);
      if (limited) return limited;

      const { subscription } = (await readJsonBody(request)) as {
        subscription?: { endpoint?: unknown; keys?: unknown };
      };
      if (typeof subscription?.endpoint !== 'string' || !subscription?.keys) {
        return authError('validation_error', { message: 'Invalid subscription data' });
      }

      // SSRF guard: the endpoint is later fetched server-side, so reject
      // non-HTTPS, private/loopback/link-local hosts (and anything outside the
      // optional allowlist) before persisting it.
      if (!isAllowedPushEndpoint(subscription.endpoint, options?.allowedEndpointHosts)) {
        return authError('validation_error', { message: 'Invalid push endpoint' });
      }

      // Validate the encryption keys structurally — an invalid p256dh/auth pair
      // would otherwise be stored and then crash every push to this user.
      if (!isValidWebPushKeys(subscription.keys)) {
        return authError('validation_error', { message: 'Invalid subscription keys' });
      }

      // Per-user cap on NEW endpoints only — a re-subscribe of an existing
      // endpoint doesn't grow the row count and must never be blocked.
      const existing = await repo.findByUser(userId);
      if (
        existing.length >= maxSubscriptionsPerUser &&
        !existing.some((s) => s.endpoint === subscription.endpoint)
      ) {
        return authError('push_subscription_limit', {
          message: `Subscription limit reached (${maxSubscriptionsPerUser} per user)`
        });
      }

      const outcome = (await repo.create(userId, {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      })) as PushSubscriptionWriteOutcome | undefined;

      if (outcome === undefined && !warnedVoidOutcome) {
        warnedVoidOutcome = true;
        logger.warn(
          '[auth] pushSubscription.create returned no outcome — this adapter predates the ' +
            'endpoint-takeover key gate and enforces none. Implement ' +
            'PushSubscriptionWriteOutcome and run the adapter conformance suite.'
        );
      }

      // 'rejected': the endpoint row belongs to another account and the
      // submitted keys don't match the stored ones — the caller knows the
      // endpoint URL but demonstrably doesn't hold the browser subscription,
      // so the write was refused (see PushSubscriptionRepository.create).
      // Both security-relevant outcomes are logged (never the endpoint URL).
      if (outcome === 'rejected') {
        logger.warn(
          `[auth] push-subscription write rejected: user ${userId} presented a foreign endpoint without the matching keys`
        );
        return authError('push_endpoint_conflict');
      }
      if (outcome === 'reassigned') {
        logger.warn(
          `[auth] push-subscription endpoint reassigned to user ${userId} (key possession proven) — the previous owner's channel on this device went quiet`
        );
      }

      return json({ success: true }, { status: 201 });
    },

    DELETE: async ({ request, locals }) => {
      const userId = localsUserId(locals);
      if (!userId) {
        return authError('not_authenticated');
      }

      const limited = await enforceRateLimit(rateLimiter, userId);
      if (limited) return limited;

      const { endpoint } = (await readJsonBody(request)) as { endpoint?: unknown };
      if (typeof endpoint !== 'string' || endpoint.length === 0) {
        return authError('validation_error', { message: 'Endpoint is required' });
      }

      await repo.delete(userId, endpoint);
      return json({ success: true });
    }
  };
}
