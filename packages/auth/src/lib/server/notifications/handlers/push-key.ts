import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export function createPushKeyHandler(vapidPublicKey: string): { GET: RequestHandler } {
  return {
    GET: async () => {
      return json({ publicKey: vapidPublicKey });
    }
  };
}
