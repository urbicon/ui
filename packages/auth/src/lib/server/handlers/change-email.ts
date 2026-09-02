import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { FullAuthUser } from '../adapters/types.js';
import { generateSecureToken, hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { resolveTokenTtlMs } from '../duration.js';
import type { ChangeEmailNoticeContext, MailBuilder } from '../email/builders.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildChangeEmail, buildChangeEmailNotice } from '../email/templates.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { validateChangeEmailInput } from '../validation.js';
import {
  notifyHook,
  parseBody,
  privateEndpoints,
  requireSessionUser,
  verifyCurrentPassword
} from './_shared.js';
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
  // Resolved here, not per request: a malformed `tokenTtl` throws where the
  // route was wired instead of inside the detached issue-and-mail task, whose
  // failures never reach the client.
  const changeTtlMs = resolveTokenTtlMs(deps.config.tokenTtl, 'emailChange');

  return privateEndpoints({
    POST: async ({ request, cookies, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const user = await requireSessionUser(deps, cookies);
      if (!user) return authError('not_authenticated');

      const body = await parseBody(request, validateChangeEmailInput);
      if (body instanceof Response) return body;
      const { newEmail, currentPassword } = body.data;

      // Re-auth before staging any change.
      if (!(await verifyCurrentPassword(user, currentPassword, deps))) {
        return authError('current_password_incorrect');
      }

      // Fire-and-forget the collision check + token write + mails, decoupled
      // from the response so its timing can't reveal whether `newEmail` already
      // belongs to an account (same defense as forgot-password). Failures can no
      // longer surface as an HTTP error, so route them to deps.logger.error.
      void (async () => {
        try {
          await issueEmailChange(deps, user, newEmail, changeTtlMs, options);
        } catch (err) {
          deps.logger.error(`[auth] change-email: failed to issue change (user ${user.id})`, err);
          // Surface the decoupled failure through the observability hook (it
          // can't reach the user as an HTTP error). Detached, so an unguarded
          // throw here would be an unhandled rejection rather than a 500.
          await notifyHook(
            deps,
            { site: 'change-email', subject: user.id },
            'onEmailChangeFailed',
            user.id,
            newEmail,
            err
          );
        }
      })();

      return json({ success: true });
    }
  });
}

/**
 * Persist the pending change and send both mails. Extracted so the handler can
 * run it detached from the response (see the timing note in the handler).
 */
async function issueEmailChange<R extends string>(
  deps: AuthDeps<R>,
  user: FullAuthUser<R>,
  newEmail: string,
  ttlMs: number,
  options: ChangeEmailHandlerOptions
): Promise<void> {
  // No-op when it's already the current address (nothing to change) or already
  // taken by another account (collision → silent: no token, no mail to the
  // foreign address; the response already revealed nothing).
  if (newEmail === user.email) return;
  if (await deps.repos.user.findByEmail(newEmail)) return;

  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + ttlMs);

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

  // Token and both mails are out. Unguarded, a throw here would land in the
  // caller's catch and be filed as `onEmailChangeFailed` — the opposite of what
  // happened.
  await notifyHook(
    deps,
    { site: 'change-email', subject: user.id },
    'onEmailChangeRequested',
    user.id,
    newEmail
  );
}
