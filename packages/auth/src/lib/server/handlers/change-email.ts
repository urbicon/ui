import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { FullAuthUser } from '../adapters/types.js';
import { generateSecureToken, hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import type { ChangeEmailNoticeContext, MailBuilder } from '../email/builders.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildChangeEmail, buildChangeEmailNotice } from '../email/templates.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { validateChangeEmailInput } from '../validation.js';
import { parseBody, requireSessionUser, verifyCurrentPassword } from './_shared.js';
import { authError } from './errors.js';

export interface ChangeEmailHandlerOptions {
  /**
   * Build the confirmation mail sent to the NEW address (carries the verify
   * link). Receives the resolved context (`name`, confirm `url`, `appName`,
   * `from`, `t`) and returns `{ subject, html, text }`. Defaults to a localized
   * template.
   */
  verifyEmailChangeEmail?: MailBuilder;
  /**
   * Build the awareness notice sent to the OLD address (no link — just informs
   * the current owner a change was requested). Receives the same context plus
   * the pending `newEmail`. Defaults to a localized template.
   */
  changeEmailEmail?: MailBuilder<ChangeEmailNoticeContext>;
}

/**
 * Request an email change. Re-auth gated; verification is sent to the NEW
 * address (proving control of it) plus a notice to the OLD one. The response is
 * always `{ success: true }` after re-auth and the token/mail work runs
 * decoupled, so neither content nor timing reveals whether the target address
 * already belongs to an account (account-enumeration defense). The change only
 * takes effect once confirmed via {@link createVerifyEmailChangeHandler}.
 */
export function createChangeEmailHandler<R extends string>(
  deps: AuthDeps<R>,
  options: ChangeEmailHandlerOptions = {}
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'changeEmail');

  return {
    POST: async ({ request, cookies, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const user = await requireSessionUser(deps, cookies);
      if (!user) return authError('not_authenticated', 401);

      const body = await parseBody(request, validateChangeEmailInput);
      if (body instanceof Response) return body;
      const { newEmail, currentPassword } = body.data;

      // Re-auth before staging any change.
      if (!(await verifyCurrentPassword(user, currentPassword, deps))) {
        return authError('current_password_incorrect', 403);
      }

      // Fire-and-forget the collision check + token write + mails, decoupled
      // from the response so its timing can't reveal whether `newEmail` already
      // belongs to an account (same defense as forgot-password). Failures can no
      // longer surface as an HTTP error, so route them to deps.logger.error.
      void (async () => {
        try {
          await issueEmailChange(deps, user, newEmail, options);
        } catch (err) {
          deps.logger.error(`[auth] change-email: failed to issue change (user ${user.id})`, err);
          // Surface the decoupled failure through the observability hook (it
          // can't reach the user as an HTTP error). Guard the hook itself so a
          // throw can't become an unhandled rejection.
          try {
            await deps.config.hooks?.onEmailChangeFailed?.(user.id, newEmail, err);
          } catch (hookErr) {
            deps.logger.error('[auth] change-email: onEmailChangeFailed hook threw', hookErr);
          }
        }
      })();

      return json({ success: true });
    }
  };
}

/**
 * Persist the pending change and send both mails. Extracted so the handler can
 * run it detached from the response (see the timing note in the handler).
 */
async function issueEmailChange<R extends string>(
  deps: AuthDeps<R>,
  user: FullAuthUser<R>,
  newEmail: string,
  options: ChangeEmailHandlerOptions
): Promise<void> {
  // No-op when it's already the current address (nothing to change) or already
  // taken by another account (collision → silent: no token, no mail to the
  // foreign address; the response already revealed nothing).
  if (newEmail === user.email) return;
  if (await deps.repos.user.findByEmail(newEmail)) return;

  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await deps.repos.user.setEmailChangeToken(user.id, newEmail, tokenHash, expires);

  const verifyUrl = new URL('/auth/verify-email-change', deps.config.appUrl);
  verifyUrl.searchParams.set('token', token);

  const { t, appName, from } = resolveEmailSettings(deps.config);

  // Confirmation link to the NEW address — proves control of it.
  const confirmCtx = { name: user.name, url: verifyUrl.toString(), appName, from, t };
  const confirm = options.verifyEmailChangeEmail?.(confirmCtx) ?? buildChangeEmail(confirmCtx, t);
  await deps.email.send({ from, ...confirm, to: newEmail });

  // Awareness notice to the OLD address so the real owner can react to a
  // change they didn't initiate (the swap only happens after confirmation).
  const noticeCtx = { name: user.name, appName, from, t, newEmail };
  const notice = options.changeEmailEmail?.(noticeCtx) ?? buildChangeEmailNotice(noticeCtx, t);
  await deps.email.send({ from, ...notice, to: user.email });

  await deps.config.hooks?.onEmailChangeRequested?.(user.id, newEmail);
}
