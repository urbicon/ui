import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { generateSecureToken, hashToken, sanitizeUser } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import type { MailBuilder } from '../email/builders.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildVerificationEmail } from '../email/templates.js';
import { hashPassword, validatePasswordStrength } from '../password.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { validateRegisterInput } from '../validation.js';
import { notifyHook, parseBody } from './_shared.js';
import { authError } from './errors.js';

export interface RegisterHandlerOptions {
  /**
   * Build the email-verification mail (mirrors `inviteEmail`). Receives the
   * resolved context (recipient `name`, verify `url`, `appName`, `from`, and the
   * `t` bundle) and returns `{ subject, html, text }` (optionally a `from` to
   * override the configured sender). Defaults to a localized template driven by
   * `config.email.locale`.
   */
  verificationEmail?: MailBuilder;

  /**
   * Treat signups from an **emailed** invitation as already email-verified.
   *
   * The reasoning only works for one of the two ways an invitation reaches
   * someone. A mail sent to the invited address, carrying a secret token, and
   * redeemed with that token, demonstrates the registrant reads that mailbox —
   * a separate verification mail would verify nothing new, and since register
   * also auto-logs-in, it would arrive after they are already signed in.
   *
   * A link the admin copied out of the panel (#68) demonstrates nothing about
   * the address it names: it travelled whatever channel the admin chose, to
   * whoever they chose. So this flag is honoured **only** when the invitation
   * carries an `emailedAt` — an invitation minted without delivery gets the
   * ordinary verification token and mail, regardless of this setting.
   *
   * Know precisely what `emailedAt` attests: **a transport accepted the
   * message**. It is exactly as strong as the transport is. The bundled console
   * transport — which the quickstart runs on — writes the mail, token and all,
   * to the process log and never fails, so under it this flag turns log access
   * into a pre-verified account. Enable it only with a transport that really
   * delivers to the address.
   *
   * Before #149 the flag rested on a claim the code did not check ("emailed to
   * that exact address"): registration was gated on knowing the address, and
   * nothing was ever emailed to prove it.
   *
   * Defaults to `false` — the verification token + mail are issued exactly as
   * before, for consumers that gate on `emailVerified`. Covers only the
   * **register** path; email *change* always verifies the new address
   * independently (see `createVerifyEmailChangeHandler`), since there is no
   * prior proof of ownership for it.
   */
  autoVerifyInvited?: boolean;
}

export function createRegisterHandler<R extends string>(
  deps: AuthDeps<R>,
  options: RegisterHandlerOptions = {}
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'register');

  return {
    POST: async (event) => {
      const { request, cookies, getClientAddress } = event;
      const limited = await enforceRateLimit(
        rateLimiter,
        getClientAddress(),
        'Too many registration attempts. Please try again later.'
      );
      if (limited) return limited;

      const body = await parseBody(request, validateRegisterInput);
      if (body instanceof Response) return body;
      const { email, name, password, token } = body.data;

      // Password strength validation
      const passwordErrors = validatePasswordStrength(password, deps.config.password);
      if (passwordErrors.length > 0) {
        return authError('validation_error', 400, {
          message: passwordErrors[0],
          extra: { errors: passwordErrors }
        });
      }

      // Registration is gated on POSSESSION OF THE TOKEN, and on nothing else.
      //
      // It used to be gated on knowing the invited address (#149): anyone who
      // guessed an address with an open invitation could register an account on
      // it with a password of their choosing, and `markUsedIfUnused` below then
      // burned the invitation, so the genuine invitee was locked out with a 403.
      // The window was not short — it ran from the moment the admin created the
      // invitation until someone used it.
      //
      // Account-enumeration stance. The distinct 403s and the 409 below are only
      // observable to someone holding a valid unused token, which is minted by
      // an admin and never guessable. An attacker without one gets the same
      // `invitation_required` for every address, registered or not, so
      // registration status does not leak — and unlike the address gate, an
      // attacker WITH a guessed address now gets that same 403 too, rather than
      // an account. The precise messages help the genuinely invited user; see
      // docs/AUTH.md.
      //
      // The email in the body is NOT trusted: the invitation names the address,
      // and a body naming a different one is a mismatched request, not a way to
      // redirect an invitation.
      // No `if (!token)` here: `validateRegisterInput` already rejects a missing
      // or blank one with a 400, before anything is looked up. A second check
      // would be unreachable, and its 403 would contradict that 400.
      const invitation = await deps.repos.invitation.findByTokenHash(hashToken(token));
      if (!invitation) {
        return authError('invitation_required', 403);
      }
      if (invitation.usedAt) {
        return authError('invitation_used', 403);
      }
      if (invitation.expiresAt.getTime() <= Date.now()) {
        return authError('invitation_expired', 403);
      }
      if (invitation.email !== email) {
        return authError('invitation_required', 403);
      }

      // Check existing user (cheap early reject; the email unique-constraint is
      // the real serialization point on create below).
      const existing = await deps.repos.user.findByEmail(email);
      if (existing) {
        return authError('email_taken', 409);
      }

      const passwordHash = await hashPassword(password, deps.config.password);

      // Skipping verification needs a proof of mailbox ownership, and only one
      // of the two delivery routes provides one: a mail sent TO this address,
      // carrying a secret, redeemed with that secret. A link the admin copied
      // out of the panel (#68) travelled a channel the package knows nothing
      // about, to a recipient it cannot vouch for — so `emailedAt` is checked,
      // not just the option. A null token here means "auto-verified" and gates
      // BOTH the create shape and the mail send below.
      const provesMailbox = invitation.emailedAt !== null;
      const verificationToken =
        options.autoVerifyInvited && provesMailbox ? null : generateSecureToken();

      // Create the user BEFORE claiming the invitation. An invitation is bound
      // 1:1 to an email, so the email unique-constraint is the authoritative
      // serialization point: two concurrent registrations for the same
      // invitation share an email, and only one create can win. Creating first
      // means a failed/throwing create never burns the invitation — the user
      // can simply retry (avoids the "invitation consumed, no account" trap).
      await deps.repos.user.create({
        email,
        name,
        passwordHash,
        role: invitation.role as R,
        ...(verificationToken
          ? {
              verificationToken: hashToken(verificationToken),
              verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
            }
          : { emailVerified: true })
      });

      // Re-read the full row instead of hand-assembling it: DB-defaulted
      // columns (tokenVersion, counters) come back authoritative, so adding a
      // column to the schema can't silently desync the in-memory shape.
      const fullUser = await deps.repos.user.findByEmail(email);
      if (!fullUser) {
        return authError('server_error', 500, {
          message: 'Registration failed. Please try again.'
        });
      }

      // Record consumption atomically. The create above already serialized
      // concurrent registrations; this flips usedAt without a lost update and,
      // on adapters lacking an email unique-constraint, still rejects a genuine
      // double-claim. A false result is an anomaly (the invitation was consumed
      // between our earlier check and now) — the account already exists, so we
      // surface it loudly rather than failing the request.
      const claimed = await deps.repos.invitation.markUsedIfUnused(invitation.id);
      if (!claimed) {
        deps.logger.warn(
          `[auth] register: created user ${fullUser.id} but invitation ${invitation.id} was already consumed — possible concurrent registration on an adapter without an email unique-constraint.`
        );
      }

      // Send the verification email — unless this was an auto-verified invited
      // signup (null token). Localized default, or the consumer hook.
      if (verificationToken) {
        const verifyUrl = new URL('/auth/verify-email', deps.config.appUrl);
        verifyUrl.searchParams.set('token', verificationToken);

        const { t, appName, from } = resolveEmailSettings(deps.config);
        const ctx = { name, url: verifyUrl.toString(), appName, from, t };
        const built = options.verificationEmail?.(ctx) ?? buildVerificationEmail(ctx, t);
        await deps.email.send({ from, ...built, to: email });
      }

      // Post-commit: the row exists and the single-use invitation is spent. A
      // throwing hook that surfaced as a 500 would send the registrant into a
      // retry that answers `invitation_used` 403 — locked out for good.
      await notifyHook(
        deps,
        { site: 'register', subject: fullUser.id },
        'onUserCreated',
        sanitizeUser(fullUser)
      );

      // Auto-login — access + optional refresh cookie, tagged with device meta.
      await establishSession(
        cookies,
        fullUser,
        deps.config,
        deps.repos,
        resolveSessionMeta(event, deps.config)
      );

      return json({ user: sanitizeUser(fullUser) }, { status: 201 });
    }
  };
}
