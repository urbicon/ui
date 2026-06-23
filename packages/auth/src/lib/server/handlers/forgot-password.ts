import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { FullAuthUser } from '../adapters/types.js';
import { generateSecureToken, hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { escapeHtml } from '../email/templates.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { readJsonBody, validateEmailInput } from '../validation.js';

export function createForgotPasswordHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.passwordReset);

  return {
    POST: async ({ request, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const input = validateEmailInput(await readJsonBody(request));
      if (!input.success) {
        return json({ error: input.errors[0].message, errors: input.errors }, { status: 400 });
      }
      const { email } = input.data;

      const user = await deps.repos.user.findByEmail(email);
      if (user) {
        // Fire-and-forget so the response time doesn't reveal whether the
        // account exists: a non-existent email returns straight after the
        // lookup, so an existing one must too — otherwise the token write +
        // email send would make it measurably slower (email enumeration via
        // timing, Finding M6). The detached work still runs on the event loop.
        //
        // Because the failure can no longer surface as an HTTP error, it is
        // routed to console.error AND the optional onPasswordResetFailed hook
        // so a broken mail transport doesn't silently lock users out of
        // recovery. NOTE: on serverless/edge runtimes that freeze the worker
        // once the response is sent, this trailing work (and its logging) can
        // be cut off — use a queue-backed email transport there so reset
        // delivery stays durable.
        void (async () => {
          try {
            await issuePasswordReset(deps, user, deps.config.appUrl);
          } catch (err) {
            // Log by user id, not email — keep PII out of stderr where the
            // consumer's logger may not redact it; the hook gets the address.
            console.error(
              `[auth] forgot-password: failed to issue reset email (user ${user.id})`,
              err
            );
            try {
              await deps.config.hooks?.onPasswordResetFailed?.(user.email, err);
            } catch (hookErr) {
              console.error('[auth] forgot-password: onPasswordResetFailed hook threw', hookErr);
            }
          }
        })();
      }

      // Always success — both branches reach this same point, so the response
      // carries no account-existence signal.
      return json({ success: true });
    }
  };
}

/**
 * Mint a password-reset token, persist its hash, and email the reset link.
 * Extracted so the handler can run it detached from the response (see the
 * timing-equalization note in `createForgotPasswordHandler`).
 */
async function issuePasswordReset<R extends string>(
  deps: AuthDeps<R>,
  user: FullAuthUser<R>,
  appUrl: string
): Promise<void> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await deps.repos.user.setPasswordResetToken(user.id, tokenHash, expires);

  const resetUrl = new URL('/auth/reset-password', appUrl);
  resetUrl.searchParams.set('token', token);

  await deps.email.send({
    from: deps.config.email?.from,
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Hello ${escapeHtml(user.name)},</p><p>Click <a href="${escapeHtml(resetUrl.toString())}">here</a> to reset your password. This link expires in 1 hour.</p>`
  });
}
