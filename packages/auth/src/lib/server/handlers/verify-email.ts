import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { readJsonBody, validateTokenInput } from '../validation.js';

export function createVerifyEmailHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.verifyEmail);

  return {
    POST: async ({ request, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const input = validateTokenInput(await readJsonBody(request));
      if (!input.success) {
        return json({ error: input.errors[0].message, errors: input.errors }, { status: 400 });
      }
      const { token } = input.data;

      const tokenHash = hashToken(token);
      // Atomic claim: marks verified + clears the token in one conditional
      // write, rejecting expired/already-consumed tokens with null.
      const user = await deps.repos.user.consumeVerificationToken(tokenHash);

      if (!user) {
        return json({ error: 'Invalid or expired verification token.' }, { status: 400 });
      }

      return json({ success: true });
    }
  };
}
