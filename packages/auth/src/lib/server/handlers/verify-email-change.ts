import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { validateTokenInput } from '../validation.js';
import { notifyHook, parseBody } from './_shared.js';
import { authError } from './errors.js';

/**
 * Confirm a pending email change from the link sent to the new address. Not
 * session-gated — the link may be opened in a different browser than the one
 * that requested the change; control of the token (delivered to the new inbox)
 * is the proof. Existing sessions are intentionally left intact: an email change
 * is not a credential compromise, and `me`/the handle hook read the address from
 * the row, so the stale `email` claim in live access tokens is cosmetic.
 */
export function createVerifyEmailChangeHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  // Share the verify-email limiter bucket — both are token-consume endpoints.
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.verifyEmail);

  return {
    POST: async ({ request, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const body = await parseBody(request, validateTokenInput);
      if (body instanceof Response) return body;
      const { token } = body.data;

      const tokenHash = hashToken(token);
      // Atomic claim: swaps email→pendingEmail + marks verified, or returns null
      // on an unknown/expired token or a target taken since the request.
      const user = await deps.repos.user.consumeEmailChangeToken(tokenHash);
      if (!user) {
        return authError('invalid_token', 400, {
          message: 'Invalid or expired link, or the email is no longer available.'
        });
      }

      // user.email is the freshly-applied new address — the swap has already
      // committed.
      await notifyHook(deps, 'verify-email-change', 'onEmailChanged', user.id, user.email);

      return json({ success: true });
    }
  };
}
