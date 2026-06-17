import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { PushSubscriptionRepository } from '../../adapters/types.js';
import { readJsonBody } from '../../validation.js';
import { isAllowedPushEndpoint } from '../push-endpoint.js';
import { base64UrlDecode } from '../web-push-crypto.js';

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
}

export function createPushSubscriptionHandler(
  repo: PushSubscriptionRepository,
  options?: PushSubscriptionHandlerOptions
): {
  POST: RequestHandler;
  DELETE: RequestHandler;
} {
  return {
    POST: async ({ request, locals }) => {
      const user = (locals as { user?: { id: string } }).user;
      if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { subscription } = (await readJsonBody(request)) as {
        subscription?: { endpoint?: unknown; keys?: unknown };
      };
      if (typeof subscription?.endpoint !== 'string' || !subscription?.keys) {
        return json({ error: 'Invalid subscription data' }, { status: 400 });
      }

      // SSRF guard: the endpoint is later fetched server-side, so reject
      // non-HTTPS, private/loopback/link-local hosts (and anything outside the
      // optional allowlist) before persisting it.
      if (!isAllowedPushEndpoint(subscription.endpoint, options?.allowedEndpointHosts)) {
        return json({ error: 'Invalid push endpoint' }, { status: 400 });
      }

      // Validate the encryption keys structurally — an invalid p256dh/auth pair
      // would otherwise be stored and then crash every push to this user.
      if (!isValidWebPushKeys(subscription.keys)) {
        return json({ error: 'Invalid subscription keys' }, { status: 400 });
      }

      await repo.create(user.id, {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });

      return json({ success: true }, { status: 201 });
    },

    DELETE: async ({ request, locals }) => {
      const user = (locals as { user?: { id: string } }).user;
      if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { endpoint } = (await readJsonBody(request)) as { endpoint?: unknown };
      if (typeof endpoint !== 'string' || endpoint.length === 0) {
        return json({ error: 'Endpoint is required' }, { status: 400 });
      }

      await repo.delete(user.id, endpoint);
      return json({ success: true });
    }
  };
}
