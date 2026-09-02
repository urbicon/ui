import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { FullAuthUser } from '../adapters/types.js';
import { generateSecureToken, hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { resolveTokenTtlMs } from '../duration.js';
import type { MailBuilder } from '../email/builders.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildPasswordResetEmail } from '../email/templates.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { validateEmailInput } from '../validation.js';
import { notifyHook, parseBody, privateEndpoints } from './_shared.js';

export interface ForgotPasswordHandlerOptions {
  /**
   * Build the password-reset mail (mirrors `inviteEmail`). Receives the resolved
   * context (`name`, reset `url`, `appName`, `from`, `t`) and returns
   * `{ subject, html, text }`. Defaults to a localized template.
   */
  resetEmail?: MailBuilder;
}

export function createForgotPasswordHandler<R extends string>(
  deps: AuthDeps<R>,
  options: ForgotPasswordHandlerOptions = {}
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'forgotPassword');
  // Resolved here, not per request: a malformed `tokenTtl` throws where the
  // route was wired instead of inside the detached issue-and-mail task, whose
  // failures never reach the client.
  const resetTtlMs = resolveTokenTtlMs(deps.config.tokenTtl, 'passwordReset');

  return privateEndpoints({
    POST: async ({ request, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const body = await parseBody(request, validateEmailInput);
      if (body instanceof Response) return body;
      const { email } = body.data;

      const user = await deps.repos.user.findByEmail(email);
      if (user) {
        // Fire-and-forget so the response time doesn't reveal whether the
        // account exists: a non-existent email returns straight after the
        // lookup, so an existing one must too — otherwise the token write +
        // email send would make it measurably slower (email enumeration via
        // timing, Finding M6). The detached work still runs on the event loop.
        //
        // Because the failure can no longer surface as an HTTP error, it is
        // routed to deps.logger.error AND the optional onPasswordResetFailed hook
        // so a broken mail transport doesn't silently lock users out of
        // recovery. NOTE: on serverless/edge runtimes that freeze the worker
        // once the response is sent, this trailing work (and its logging) can
        // be cut off — use a queue-backed email transport there so reset
        // delivery stays durable.
        void (async () => {
          try {
            await issuePasswordReset(deps, user, resetTtlMs, options.resetEmail);
          } catch (err) {
            // Log by user id, not email — keep PII out of stderr where the
            // consumer's logger may not redact it; the hook gets the address.
            deps.logger.error(
              `[auth] forgot-password: failed to issue reset email (user ${user.id})`,
              err
            );
            await notifyHook(
              deps,
              { site: 'forgot-password', subject: user.id },
              'onPasswordResetFailed',
              user.email,
              err
            );
          }
        })();
      }

      // Always success — both branches reach this same point, so the response
      // carries no account-existence signal.
      return json({ success: true });
    }
  });
}

/**
 * Mint a password-reset token, persist its hash, and email the reset link.
 * Extracted so the handler can run it detached from the response (see the
 * timing-equalization note in `createForgotPasswordHandler`).
 */
async function issuePasswordReset<R extends string>(
  deps: AuthDeps<R>,
  user: FullAuthUser<R>,
  ttlMs: number,
  resetEmail?: MailBuilder
): Promise<void> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + ttlMs);

  await deps.repos.user.setPasswordResetToken(user.id, tokenHash, expires);

  const resetUrl = new URL('/auth/reset-password', deps.config.appUrl);
  resetUrl.searchParams.set('token', token);

  const { t, appName, from } = resolveEmailSettings(deps.config);
  const ctx = { name: user.name, url: resetUrl.toString(), appName, from, t };
  const built = resetEmail?.(ctx) ?? buildPasswordResetEmail(ctx, t);
  await deps.email.send({ from, ...built, to: user.email });
}
