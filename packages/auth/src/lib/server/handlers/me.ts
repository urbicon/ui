import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { NO_STORE, requireSessionUser } from './_shared.js';

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
