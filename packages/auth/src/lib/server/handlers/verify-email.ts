import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { validateTokenInput } from '../validation.js';
import { parseBody, privateEndpoints } from './_shared.js';
import { authError } from './errors.js';

export function createVerifyEmailHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'verifyEmail');

  return privateEndpoints({
    POST: async ({ request, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const body = await parseBody(request, validateTokenInput);
      if (body instanceof Response) return body;
      const { token } = body.data;

      const tokenHash = hashToken(token);
      // Atomic claim: marks verified + clears the token in one conditional
      // write, rejecting expired/already-consumed tokens with null.
      const user = await deps.repos.user.consumeVerificationToken(tokenHash);

      if (!user) {
        return authError('invalid_token', {
          message: 'Invalid or expired verification token.'
        });
      }

      return json({ success: true });
    }
  });
}
