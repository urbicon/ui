import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword, validatePasswordStrength } from '../password.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { validateResetPasswordInput } from '../validation.js';
import { parseBody } from './_shared.js';
import { authError } from './errors.js';

export function createResetPasswordHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'resetPassword');

  return {
    POST: async ({ request, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const body = await parseBody(request, validateResetPasswordInput);
      if (body instanceof Response) return body;
      const { token, password } = body.data;

      const passwordErrors = validatePasswordStrength(password, deps.config.password);
      if (passwordErrors.length > 0) {
        return authError('validation_error', 400, {
          message: passwordErrors[0],
          extra: { errors: passwordErrors }
        });
      }

      // Hash before claiming so the expensive PBKDF2 work sits outside the
      // claim→write window: a successful claim is followed immediately by the
      // password write, keeping the token-consumed and password-changed states
      // in lockstep even if the process dies mid-handler.
      const newHash = await hashPassword(password, deps.config.password);

      const tokenHash = hashToken(token);
      // Atomic single-use claim: clears the reset token and returns its owner.
      // A second concurrent attempt with the same token gets null → 400.
      const user = await deps.repos.user.consumeResetToken(tokenHash);
      if (!user) {
        return authError('invalid_token', 400, { message: 'Invalid or expired reset token.' });
      }

      await deps.repos.user.updatePassword(user.id, newHash);

      // Invalidate all existing sessions — the JWT check rejects stale access
      // cookies via tokenVersion, and refresh-token families must be revoked
      // so a stolen pre-reset refresh cookie cannot mint fresh access tokens.
      await deps.repos.user.incrementTokenVersion(user.id);
      await deps.repos.refreshToken?.revokeAllForUser(user.id);

      await deps.config.hooks?.onPasswordChanged?.(user.id);

      return json({ success: true });
    }
  };
}
