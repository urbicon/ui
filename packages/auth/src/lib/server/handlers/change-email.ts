import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { FullAuthUser } from '../adapters/types.js';
import { generateSecureToken, hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { escapeHtml } from '../email/templates.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { readJsonBody, validateChangeEmailInput } from '../validation.js';
import { requireSessionUser, verifyCurrentPassword } from './_shared.js';
import { authError } from './errors.js';

/**
 * Request an email change. Re-auth gated; verification is sent to the NEW
 * address (proving control of it) plus a notice to the OLD one. The response is
 * always `{ success: true }` after re-auth and the token/mail work runs
 * decoupled, so neither content nor timing reveals whether the target address
 * already belongs to an account (account-enumeration defense). The change only
 * takes effect once confirmed via {@link createVerifyEmailChangeHandler}.
 */
export function createChangeEmailHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.changeEmail);

  return {
    POST: async ({ request, cookies, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const user = await requireSessionUser(deps, cookies);
      if (!user) return authError('not_authenticated', 401);

      const input = validateChangeEmailInput(await readJsonBody(request));
      if (!input.success) {
        return authError('validation_error', 400, {
          message: input.errors[0].message,
          extra: { errors: input.errors }
        });
      }
      const { newEmail, currentPassword } = input.data;

      // Re-auth before staging any change.
      if (!(await verifyCurrentPassword(user, currentPassword, deps))) {
        return authError('current_password_incorrect', 403);
      }

      // Fire-and-forget the collision check + token write + mails, decoupled
      // from the response so its timing can't reveal whether `newEmail` already
      // belongs to an account (same defense as forgot-password). Failures can no
      // longer surface as an HTTP error, so route them to console.error.
      void (async () => {
        try {
          await issueEmailChange(deps, user, newEmail);
        } catch (err) {
          console.error(`[auth] change-email: failed to issue change (user ${user.id})`, err);
          // Surface the decoupled failure through the observability hook (it
          // can't reach the user as an HTTP error). Guard the hook itself so a
          // throw can't become an unhandled rejection.
          try {
            await deps.config.hooks?.onEmailChangeFailed?.(user.id, newEmail, err);
          } catch (hookErr) {
            console.error('[auth] change-email: onEmailChangeFailed hook threw', hookErr);
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
  newEmail: string
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

  const from = deps.config.email?.from;

  // Confirmation link to the NEW address — proves control of it.
  await deps.email.send({
    from,
    to: newEmail,
    subject: 'Confirm your new email address',
    html: `<p>Hello ${escapeHtml(user.name)},</p><p>Click <a href="${escapeHtml(verifyUrl.toString())}">here</a> to confirm this address for your account. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`
  });

  // Awareness notice to the OLD address so the real owner can react to a
  // change they didn't initiate (the swap only happens after confirmation).
  await deps.email.send({
    from,
    to: user.email,
    subject: 'Email change requested',
    html: `<p>Hello ${escapeHtml(user.name)},</p><p>A change of your account email to <strong>${escapeHtml(newEmail)}</strong> was requested. If this wasn't you, please secure your account — the change only takes effect once it's confirmed from the new address.</p>`
  });

  await deps.config.hooks?.onEmailChangeRequested?.(user.id, newEmail);
}
