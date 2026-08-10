import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthLocale } from '../../i18n/keys.js';
import type { AuthUser } from '../../types.js';
import { generateSecureToken, hashToken, sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildInvitationEmail } from '../email/templates.js';
import { validateInvitationInput } from '../validation.js';
import { NO_STORE, parseBody, requireSessionUser } from './_shared.js';
import { authError } from './errors.js';

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
   * `sendEmail` flag). Defaults to a localized template (`config.email.locale`)
   * linking to `${appUrl}/auth/register?token=<secret>&email=<invitee>`.
   * Receives the resolved context — `from`, `appName`, and the `t` bundle — so a
   * custom builder can reuse or override them. Return `{ subject, html, text? }`
   * (optionally a `from` to override the configured sender).
   *
   * The `url` carries the one-time invitation token: it IS the credential, so a
   * custom builder must put it in the message and must not log it.
   */
  inviteEmail?: (ctx: {
    email: string;
    role: R;
    url: string;
    from?: string;
    appName: string;
    t: AuthLocale;
  }) => {
    subject: string;
    html: string;
    text?: string;
    from?: string;
  };

  /**
   * How long an invitation stays redeemable, in milliseconds.
   * @default 7 days
   *
   * Deliberately far longer than the one-hour password-reset window: a reset is
   * a response to something the user just did, while an invitation has to reach
   * a person who may be on holiday. Before #149 there was no window at all —
   * an invitation stayed open from the moment it was minted until someone used
   * it, which is the interval the address-only gate left exploitable.
   *
   * Shorten it if invitations are handed over synchronously.
   */
  invitationTtlMs?: number;
}

/** 7 days. See {@link InvitationHandlerOptions.invitationTtlMs}. */
const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  const { authorize, roles, inviteEmail, invitationTtlMs = DEFAULT_INVITATION_TTL_MS } = options;

  // Resolve the caller from the session cookie and run the authorization gate.
  // Returns the sanitized user, or a Response the handler must return as-is.
  async function authorizedUser(
    cookies: Parameters<RequestHandler>[0]['cookies']
  ): Promise<{ user: AuthUser<R> } | Response> {
    const full = await requireSessionUser(deps, cookies);
    if (!full) return authError('not_authenticated', 401, { message: 'Unauthorized' });

    const user = sanitizeUser(full);
    if (!(await authorize(user))) return authError('forbidden', 403);
    return { user };
  }

  return {
    GET: async ({ cookies }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const invitations = await deps.repos.invitation.list();
      return json({ invitations }, { headers: NO_STORE });
    },

    POST: async ({ request, cookies }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const body = await parseBody(request, (raw) => validateInvitationInput(raw, roles));
      if (body instanceof Response) return body;
      const { email, role, sendEmail } = body.data;

      // Duplicate rejection with a clear 409. The caller is an authorized admin,
      // so there's no enumeration concern in distinguishing the cases. Checking
      // first also keeps adapters whose `create` throws on a pre-existing row
      // (e.g. the in-memory one) from surfacing as a 500.
      const existingUser = await deps.repos.user.findByEmail(email);
      if (existingUser) {
        return authError('email_taken', 409);
      }
      const existingInvite = await deps.repos.invitation.findByEmail(email);
      if (existingInvite) {
        return authError('email_invited', 409);
      }

      // The raw token exists for exactly this request. It is hashed on the way
      // into storage and returned to the admin once, in the URL below — there is
      // no path that can produce it again, which is what makes a leaked database
      // useless for redeeming invitations (#149).
      const token = generateSecureToken();
      const invitation = await deps.repos.invitation.create({
        email,
        role,
        invitedById: auth.user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + invitationTtlMs)
      });

      // The register URL is built here and RETURNED, not built inside the mail
      // path and discarded (#68). Without a mail transport — a configuration
      // this package ships a console transport for, and the quickstart runs on —
      // the admin otherwise had a freshly minted invitation and no way to hand
      // it to anyone. The route belongs to the server, so the panel does not
      // have to reconstruct it from `location.origin`.
      const url = new URL('/auth/register', deps.config.appUrl);
      url.searchParams.set('token', token);
      url.searchParams.set('email', email);
      const inviteUrl = url.toString();

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
        const { t, appName, from } = resolveEmailSettings(deps.config);
        const built = inviteEmail
          ? inviteEmail({ email, role: role as R, url: inviteUrl, from, appName, t })
          : buildInvitationEmail({ url: inviteUrl, appName }, t);

        try {
          await deps.email.send({ from, ...built, to: email });
          emailSent = true;
          // Recorded only after a send that did NOT throw. This timestamp is
          // what lets `autoVerifyInvited` skip verification, so it has to mean
          // "the mail went out", not "we tried".
          await deps.repos.invitation.markEmailed(invitation.id, new Date());
        } catch (err) {
          // The invitee — not the API caller — is the one left unable to
          // register, so surface this loudly (error, not warn) and via the
          // optional hook so it can reach an error tracker / resend queue,
          // mirroring `onPasswordResetFailed`.
          deps.logger.error(
            `[auth] invitation for ${email} was created but the invite email failed to send:`,
            err
          );
          try {
            await deps.config.hooks?.onInvitationEmailFailed?.(email, err);
          } catch (hookErr) {
            deps.logger.error('[auth] onInvitationEmailFailed hook threw:', hookErr);
          }
        }
      }

      // `inviteUrl` carries the raw token and is returned ONCE — it is not in
      // `list()`, because the hash is all the database holds. An admin who loses
      // it deletes the invitation and mints a new one.
      return json(
        {
          invitation: { ...invitation, emailedAt: emailSent ? new Date() : null },
          emailSent,
          inviteUrl
        },
        { status: 201, headers: NO_STORE }
      );
    },

    DELETE: async ({ cookies, params }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const id = params.id;
      if (!id) {
        return authError('validation_error', 400, { message: 'Invitation id is required.' });
      }

      await deps.repos.invitation.delete(id);
      return json({ success: true });
    }
  };
}
