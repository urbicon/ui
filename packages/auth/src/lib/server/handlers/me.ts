import type { RequestHandler } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { privateEndpoints, requireSessionUser } from './_shared.js';

export function createMeHandler<R extends string>(deps: AuthDeps<R>): { GET: RequestHandler } {
  return privateEndpoints({
    GET: async ({ cookies }) => {
      // Session resolution + token-version invalidation now live in the shared
      // helper that every authenticated handler reuses (see `_shared.ts`).
      const user = await requireSessionUser(deps, cookies);
      if (!user) {
        return Response.json({ user: null }, { status: 401 });
      }

      return Response.json({ user: sanitizeUser(user) });
    }
  });
}
