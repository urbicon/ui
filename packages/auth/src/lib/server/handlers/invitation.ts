import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthLocale } from '../../i18n/keys.js';
import type { AuthUser } from '../../types.js';
import { generateSecureToken, hashToken, sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildInvitationEmail } from '../email/templates.js';
import { validateInvitationInput } from '../validation.js';
import { notifyHook, parseBody, privateEndpoints, requireSessionUser } from './_shared.js';
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
  const { authorize, roles, inviteEmail } = options;
  // A non-finite or non-positive TTL fails OPEN, which is the wrong direction
  // for the thing that bounds an invitation's life: `Infinity` produced an
  // `Invalid Date`, whose `getTime()` is `NaN`, and `NaN <= Date.now()` is
  // false — so every invitation lived forever, silently. "Never expires" is not
  // a supported configuration; say so at wiring time rather than at 3am.
  const configuredTtl = options.invitationTtlMs;
  if (configuredTtl !== undefined && (!Number.isFinite(configuredTtl) || configuredTtl <= 0)) {
    throw new Error(
      `[auth] invitationTtlMs must be a positive finite number of milliseconds, got ${configuredTtl}. ` +
        'Invitations cannot be made to never expire.'
    );
  }
  const invitationTtlMs = configuredTtl ?? DEFAULT_INVITATION_TTL_MS;

  // Resolve the caller from the session cookie and run the authorization gate.
  // Returns the sanitized user, or a Response the handler must return as-is.
  async function authorizedUser(
    cookies: Parameters<RequestHandler>[0]['cookies']
  ): Promise<{ user: AuthUser<R> } | Response> {
    const full = await requireSessionUser(deps, cookies);
    if (!full) return authError('not_authenticated');

    const user = sanitizeUser(full);
    if (!(await authorize(user))) return authError('forbidden');
    return { user };
  }

  return privateEndpoints({
    GET: async ({ cookies }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const invitations = await deps.repos.invitation.list();
      return json({ invitations });
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
        return authError('email_taken');
      }
      const existingInvite = await deps.repos.invitation.findByEmail(email);
      if (existingInvite) {
        return authError('email_invited');
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
        } catch (err) {
          // The invitee — not the API caller — is the one left unable to
          // register, so surface this loudly (error, not warn) and via the
          // optional hook so it can reach an error tracker / resend queue,
          // mirroring `onPasswordResetFailed`.
          deps.logger.error(
            `[auth] invitation for ${email} was created but the invite email failed to send:`,
            err
          );
          await notifyHook(
            deps,
            { site: 'invitation', subject: invitation.id },
            'onInvitationEmailFailed',
            email,
            err
          );
        }
      }

      // Recorded OUTSIDE the send's try/catch, and only on a send that did not
      // throw. Inside it, a failing `markEmailed` — a deadlock, a dropped
      // connection — was reported as "the email failed to send" even though the
      // mail had gone out: the response said `emailSent: true` while the
      // database said `emailedAt: null`, and a resend queue hanging off
      // `onInvitationEmailFailed` would post a second mail carrying the same
      // live token. The write is now its own step, and the response reports what
      // it actually achieved.
      let emailedAt: Date | null = null;
      if (emailSent) {
        const at = new Date();
        try {
          await deps.repos.invitation.markEmailed(invitation.id, at);
          emailedAt = at;
        } catch (err) {
          // The mail is out and the invitation is valid; only the delivery
          // record is missing. That costs `autoVerifyInvited` for this one
          // invitation — the invitee verifies by mail instead — so it is worth
          // a loud log and nothing more.
          deps.logger.error(
            `[auth] invitation for ${email} was emailed but recording emailedAt failed; the invitee will be asked to verify their address:`,
            err
          );
        }
      }

      // `inviteUrl` carries the raw token, so it comes back ONLY when nothing
      // was mailed. When the mail went out, the invitee holds the credential and
      // handing the admin a second copy would put it in a second place for no
      // reason — an admin could redeem it as the invitee, and with
      // `autoVerifyInvited` land a pre-verified account. It is never in
      // `list()`: the hash is all the database holds.
      return json(
        {
          invitation: { ...invitation, emailedAt },
          emailSent,
          ...(emailSent ? {} : { inviteUrl })
        },
        { status: 201 }
      );
    },

    DELETE: async ({ cookies, params }) => {
      const auth = await authorizedUser(cookies);
      if (auth instanceof Response) return auth;

      const id = params.id;
      if (!id) {
        return authError('validation_error', { message: 'Invitation id is required.' });
      }

      await deps.repos.invitation.delete(id);
      return json({ success: true });
    }
  });
}
