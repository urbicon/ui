import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { validateUpdateProfileInput } from '../validation.js';
import { parseBody, privateEndpoints, requireSessionUser } from './_shared.js';
import { authError } from './errors.js';

/**
 * Update the authenticated user's mutable profile fields (v1: `name`). Not
 * security-critical, so no re-auth. Email is changed through the verified
 * change-email flow; `role` is never self-service.
 */
export function createUpdateProfileHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  return privateEndpoints({
    POST: async ({ request, cookies }) => {
      const user = await requireSessionUser(deps, cookies);
      if (!user) return authError('not_authenticated');

      const body = await parseBody(request, validateUpdateProfileInput);
      if (body instanceof Response) return body;
      const { name } = body.data;

      await deps.repos.user.updateProfile(user.id, { name });

      // Return the updated identity so the client store can refresh in place
      // without a follow-up round-trip to `me`.
      return json({ user: sanitizeUser({ ...user, name }) });
    }
  });
}
