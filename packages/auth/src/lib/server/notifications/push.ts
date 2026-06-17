import type { PushSubscriptionData, PushSubscriptionRepository } from '../adapters/types.js';
import { createRateLimiter, type RateLimitStore } from '../rate-limit.js';
import { isPublicHttpsEndpoint } from './push-endpoint.js';
import { buildEncryptedBody, createVapidHeaders, encryptPayload } from './web-push-crypto.js';

export type { VapidKeys } from './web-push-crypto.js';
export { generateVapidKeys } from './web-push-crypto.js';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  url?: string;
  tag?: string;
}

export interface PushResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  expired?: boolean;
  /** Set to true when the push was skipped because the per-endpoint rate limit was hit. */
  rateLimited?: boolean;
  /** Error message when the push failed before a response was received (crypto, fetch, VAPID). */
  error?: string;
}

export interface PushRateLimitConfig {
  /** Rolling window in milliseconds within which `max` pushes per endpoint are allowed. */
  windowMs: number;
  /** Maximum number of pushes to the same endpoint per window. */
  max: number;
  /** Optional persistent adapter (Redis/Prisma/etc.). Defaults to in-memory. */
  store?: RateLimitStore;
}

export interface PushServiceOptions {
  /**
   * Enable per-endpoint rate limiting. Pushes that exceed the window/max
   * budget are returned with `rateLimited: true` and `statusCode: 429` in
   * their `PushResult` — the HTTP request to the push endpoint is skipped.
   */
  rateLimit?: PushRateLimitConfig;
}

/**
 * A push subscription paired with its owning user, so cleanup can scope the
 * delete by `(userId, endpoint)` and avoid removing another user's row that
 * happens to share an endpoint URL.
 */
export interface OwnedPushSubscription extends PushSubscriptionData {
  userId: string;
}

export interface PushService {
  sendPush(subscriptions: PushSubscriptionData[], payload: PushPayload): Promise<PushResult[]>;
  cleanupExpired(
    repo: PushSubscriptionRepository,
    subscriptions: OwnedPushSubscription[]
  ): Promise<void>;
}

export function createPushService(
  vapidConfig: VapidConfig,
  options?: PushServiceOptions
): PushService {
  const rateLimiter = options?.rateLimit
    ? createRateLimiter({
        windowMs: options.rateLimit.windowMs,
        max: options.rateLimit.max,
        store: options.rateLimit.store
      })
    : null;
  return {
    async sendPush(subscriptions, payload): Promise<PushResult[]> {
      const plaintext = new TextEncoder().encode(JSON.stringify(payload));

      // Web Push services cap the encrypted record at 4096 bytes (RFC 8291).
      // The aes128gcm overhead is a 16-byte GCM tag + 1 padding-delimiter byte
      // on top of the plaintext, so the plaintext must fit in 4096 - 17 = 4079
      // bytes. An oversized payload would only ever earn a 413 from the push
      // service (silently swallowed downstream) — reject it up front with a
      // clear, per-endpoint error instead of paying for N doomed requests.
      const MAX_PLAINTEXT_BYTES = 4079;
      if (plaintext.length > MAX_PLAINTEXT_BYTES) {
        return subscriptions.map((sub) => ({
          endpoint: sub.endpoint,
          success: false,
          error: `payload too large: ${plaintext.length} bytes exceeds the ${MAX_PLAINTEXT_BYTES}-byte Web Push limit`
        }));
      }

      const results = await Promise.allSettled(
        subscriptions.map(async (sub): Promise<PushResult> => {
          // SSRF defense-in-depth: never fetch an endpoint that isn't a public
          // HTTPS host. The subscription handler validates on create; this is
          // the last guard before the request, covering pre-guard rows or
          // hand-built subscription lists.
          if (!isPublicHttpsEndpoint(sub.endpoint)) {
            return { endpoint: sub.endpoint, success: false, error: 'blocked endpoint' };
          }

          if (rateLimiter) {
            const limit = await rateLimiter.check(sub.endpoint);
            if (!limit.allowed) {
              return {
                endpoint: sub.endpoint,
                success: false,
                statusCode: 429,
                rateLimited: true
              };
            }
          }

          // Encrypt payload per RFC 8291
          const { ciphertext, salt, serverPublicKey } = await encryptPayload(plaintext, sub.keys);
          const body = buildEncryptedBody(ciphertext, salt, serverPublicKey);

          // VAPID headers per RFC 8292
          const vapidHeaders = await createVapidHeaders(
            sub.endpoint,
            vapidConfig.subject,
            vapidConfig.publicKey,
            vapidConfig.privateKey
          );

          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              ...vapidHeaders,
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'Content-Length': String(body.length),
              TTL: '86400',
              Urgency: 'normal'
            },
            body: body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength
            ) as ArrayBuffer
          });

          if (response.status === 410 || response.status === 404) {
            return {
              endpoint: sub.endpoint,
              success: false,
              statusCode: response.status,
              expired: true
            };
          }

          if (!response.ok) {
            return { endpoint: sub.endpoint, success: false, statusCode: response.status };
          }

          return { endpoint: sub.endpoint, success: true, statusCode: response.status };
        })
      );

      return results.map((r, i): PushResult => {
        if (r.status === 'fulfilled') return r.value;
        const reason = r.reason;
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'unknown';
        return {
          endpoint: subscriptions[i]?.endpoint ?? 'unknown',
          success: false,
          error: message
        };
      });
    },

    async cleanupExpired(repo, subscriptions) {
      for (const sub of subscriptions) {
        // SSRF defense-in-depth (same as sendPush): skip any endpoint that
        // isn't a public HTTPS host rather than fetch it.
        if (!isPublicHttpsEndpoint(sub.endpoint)) continue;
        let response: Response;
        try {
          // Lightweight check — send empty payload to test endpoint validity
          const vapidHeaders = await createVapidHeaders(
            sub.endpoint,
            vapidConfig.subject,
            vapidConfig.publicKey,
            vapidConfig.privateKey
          );

          response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              ...vapidHeaders,
              'Content-Length': '0',
              TTL: '0'
            }
          });
        } catch {
          // Endpoint unreachable (DNS, TLS, timeout) — may be temporary, skip
          // to the next subscription without deleting.
          continue;
        }

        // Repo errors must propagate — a DB outage during cleanup must not be
        // silently indistinguishable from an unreachable push endpoint.
        if (response.status === 410 || response.status === 404) {
          await repo.delete(sub.userId, sub.endpoint);
        }
      }
    }
  };
}
