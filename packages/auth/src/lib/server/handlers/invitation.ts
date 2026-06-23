import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthUser } from '../../types.js';
import { sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { escapeHtml } from '../email/templates.js';
import { getSessionFromCookie } from '../session.js';
import { readJsonBody, validateInvitationInput } from '../validation.js';

export interface InvitationHandlerOptions<R extends string = string> {
  /**
   * Authorize the caller to manage invitations (create / list / revoke).
   * Required and fail-closed by design: there is no default, because an open
   * invitation endpoint would let any authenticated user mint invitations —
   * and the register handler's account-enumeration defense holds ONLY while
   * invitations stay admin-minted (see `register.ts` / docs/AUTH.md). Receives
   * the sanitized authenticated user; return `true` to allow. The package has
   * no role model of its own, so you decide what "may invite" means, e.g.
   * `authorize: (user) => user.role === 'admin'`.
   */
  authorize: (user: AuthUser<R>) => boolean | Promise<boolean>;
  /**
   * Roles assignable through an invitation. The submitted role must be one of
   * these — without an allow-list a crafted request could invite a user at a
   * higher privilege than the UI offers (privilege escalation). Mirror the
   * `roles` prop you pass to `<InvitationManager>`.
   */
  roles: R[];
  /**
   * Build the invitation email sent when the client requests it (the
   * `sendEmail` flag). Defaults to a minimal template linking to
   * `${appUrl}/auth/register?email=<invitee>`. Receives `from` — the resolved
   * `config.email.from` — so a custom builder can reuse or override the sender.
   * Return `{ subject, html, text? }` (optionally a `from` to override).
   */
  inviteEmail?: (ctx: { email: string; role: R; url: string; from?: string }) => {
    subject: string;
    html: string;
    text?: string;
    from?: string;
  };
}

function defaultInviteEmail(ctx: { url: string }): { subject: string; html: string } {
  const url = escapeHtml(ctx.url);
  return {
    subject: "You've been invited",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been invited</h2>
        <p>You've been invited to create an account. Click the button below to register:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; border-radius: 6px; text-decoration: none;">
            Create your account
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
    `
  };
}

/**
 * Admin-facing invitation CRUD: the server half of `<InvitationManager>`.
 * Returns three handlers — mount `POST` + `GET` on `/api/invitations` and
 * `DELETE` on `/api/invitations/[id]`:
 *
 * ```ts
 * const invitations = createInvitationHandlers(deps, {
 *   authorize: (user) => user.role === 'admin',
 *   roles: ['member', 'admin']
 * });
 * // src/routes/api/invitations/+server.ts
 * export const POST = invitations.POST;
 * export const GET = invitations.GET;
 * // src/routes/api/invitations/[id]/+server.ts
 * export const DELETE = invitations.DELETE;
 * ```
 *
 * CSRF is enforced by `createAuthHandle` (the mutating requests carry the
 * double-submit token / Origin check), so the handlers don't repeat it. They
 * resolve the caller from the session cookie directly (not `locals.user`), so
 * authorization is unaffected by a `transformUser` hook reshaping locals.
 */
export function createInvitationHandlers<R extends string>(
  deps: AuthDeps<R>,
  options: InvitationHandlerOptions<R>
): { POST: RequestHandler; GET: RequestHandler; DELETE: RequestHandler } {
  const { authorize, roles, inviteEmail } = options;

  // Resolve the caller from the session cookie and run the authorization gate.
  // Returns the sanitized user, or a Response the handler must return as-is.
  async function authorizedUser(
    cookies: Parameters<RequestHandler>[0]['cookies']
  ): Promise<{ user: AuthUser<R> } | Response> {
    const session = await getSessionFromCookie<R>(cookies, deps.config.jwt);
    if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

    const full = await deps.repos.user.findById(session.userId);
    if (!full || full.tokenVersion !== session.tokenVersion) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = sanitizeUser(full);
    if (!(await authorize(user))) return json({ error: 'Forbidden' }, { status: 403 });
    return { user };
  }

  return {
    GET: async ({ cookies }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const invitations = await deps.repos.invitation.list();
      return json({ invitations });
    },

    POST: async ({ request, cookies }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const input = validateInvitationInput(await readJsonBody(request), roles);
      if (!input.success) {
        return json({ error: input.errors[0].message, errors: input.errors }, { status: 400 });
      }
      const { email, role, sendEmail } = input.data;

      // Duplicate rejection with a clear 409. The caller is an authorized admin,
      // so there's no enumeration concern in distinguishing the cases. Checking
      // first also keeps adapters whose `create` throws on a pre-existing row
      // (e.g. the in-memory one) from surfacing as a 500.
      const existingUser = await deps.repos.user.findByEmail(email);
      if (existingUser) {
        return json({ error: 'This email is already registered.' }, { status: 409 });
      }
      const existingInvite = await deps.repos.invitation.findByEmail(email);
      if (existingInvite) {
        return json({ error: 'This email has already been invited.' }, { status: 409 });
      }

      const invitation = await deps.repos.invitation.create({
        email,
        role,
        invitedById: auth.user.id
      });

      // The invitation row is the durable effect and has already succeeded;
      // emailing is best-effort so a mail outage can't fail the invite. The
      // failure is reported back as `emailSent: false` (not swallowed silently)
      // so a caller can surface "created, but email failed".
      let emailSent = false;
      if (sendEmail) {
        // Build the message OUTSIDE the try: a malformed appUrl or a throwing
        // consumer-supplied `inviteEmail` builder is a programming error, not a
        // transient mail outage — let it surface (a real 500 + stack) rather
        // than masquerade as "email failed to send" on every invite forever.
        const url = new URL('/auth/register', deps.config.appUrl);
        url.searchParams.set('email', email);
        const from = deps.config.email?.from;
        const built = inviteEmail
          ? inviteEmail({ email, role: role as R, url: url.toString(), from })
          : defaultInviteEmail({ url: url.toString() });

        try {
          await deps.email.send({ from, ...built, to: email });
          emailSent = true;
        } catch (err) {
          // The invitee — not the API caller — is the one left unable to
          // register, so surface this loudly (error, not warn) and via the
          // optional hook so it can reach an error tracker / resend queue,
          // mirroring `onPasswordResetFailed`.
          console.error(
            `[auth] invitation for ${email} was created but the invite email failed to send:`,
            err
          );
          try {
            await deps.config.hooks?.onInvitationEmailFailed?.(email, err);
          } catch (hookErr) {
            console.error('[auth] onInvitationEmailFailed hook threw:', hookErr);
          }
        }
      }

      return json({ invitation, emailSent }, { status: 201 });
    },

    DELETE: async ({ cookies, params }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const id = params.id;
      if (!id) return json({ error: 'Invitation id is required.' }, { status: 400 });

      await deps.repos.invitation.delete(id);
      return json({ success: true });
    }
  };
}
