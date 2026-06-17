import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { requireSessionUser } from './_shared.js';

// This endpoint returns the authenticated user. Mark every response
// uncacheable so a shared cache (CDN/proxy whose key omits the session cookie)
// can never replay one user's identity — or a stale 401 — to another client.
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function createMeHandler<R extends string>(deps: AuthDeps<R>): { GET: RequestHandler } {
  return {
    GET: async ({ cookies }) => {
      // Session resolution + token-version invalidation now live in the shared
      // helper that every authenticated handler reuses (see `_shared.ts`).
      const user = await requireSessionUser(deps, cookies);
      if (!user) {
        return json({ user: null }, { status: 401, headers: NO_STORE });
      }

      return json({ user: sanitizeUser(user) }, { headers: NO_STORE });
    }
  };
}
