import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { resolvePasswordPolicy } from '../../password-policy.js';
import type { AuthDeps } from '../deps.js';
import { privateEndpoints } from './_shared.js';

/**
 * Publishes the password policy the server enforces, so the sign-up /
 * reset / change-password forms can gate against it instead of against a
 * second, hand-kept copy in component props. Mount it at
 * `/api/auth/password-policy` (the path the client components default to):
 *
 * ```ts
 * // src/routes/api/auth/password-policy/+server.ts
 * export const GET = createPasswordPolicyHandler(authDeps).GET;
 * ```
 *
 * Unauthenticated by design — registration and password reset are both
 * signed-out flows, and the policy is not a secret: one failed submit already
 * spells it out ("Password must be at least 12 characters"). What it does NOT
 * publish is the rest of `config.password`: the response is
 * `resolvePasswordPolicy`'s five-field projection, so the PBKDF2 work factor
 * never reaches the wire.
 */
export function createPasswordPolicyHandler<R extends string>(
  deps: AuthDeps<R>
): { GET: RequestHandler } {
  return privateEndpoints({
    GET: async () =>
      json(
        { policy: resolvePasswordPolicy(deps.config.password) },
        // Static per deployment, so caching keeps the extra request off every
        // repeat visit. The cost is bounded and named: for up to 5 minutes
        // after a policy is TIGHTENED, a warm client gates on the old one. It
        // corrects itself on the first refusal — the `validation_error` body
        // carries the new policy and the forms adopt it — so the window costs
        // one rejected submit, not an English error.
        { headers: { 'Cache-Control': 'public, max-age=300' } }
      )
  });
}
