import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { privateEndpoints } from '../../handlers/_shared.js';

/**
 * The VAPID **public** key every browser needs to subscribe to Web Push. One of
 * the three endpoints in this package that are not scoped to a caller: the key
 * is identical for every user and is meant to be handed out, so it says
 * `public` rather than inheriting the package's `no-store` default — the
 * default exists to keep one account's answer from reaching another, and there
 * is no account in this answer.
 *
 * Five minutes, the same window `jwks` and `password-policy` use, and the same
 * trade it already accepts: after a key rotation a warm client keeps
 * subscribing against the old key for up to that long. The failure is visible
 * and self-correcting — those subscriptions are refused by the push service and
 * the next fetch has the new key.
 */
const PUSH_KEY_HEADERS = { 'Cache-Control': 'public, max-age=300' } as const;

export function createPushKeyHandler(vapidPublicKey: string): { GET: RequestHandler } {
  return privateEndpoints({
    GET: async () => {
      return json({ publicKey: vapidPublicKey }, { headers: PUSH_KEY_HEADERS });
    }
  });
}
