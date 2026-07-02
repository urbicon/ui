import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
  generateSecureToken,
  hashPassword,
  hashToken,
  sanitizeUser,
  validatePasswordStrength
} from '../auth.js';
import type { AuthDeps } from '../deps.js';
import type { MailBuilder } from '../email/builders.js';
import { resolveEmailSettings } from '../email/resolve.js';
import { buildVerificationEmail } from '../email/templates.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { readJsonBody, validateRegisterInput } from '../validation.js';
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
   * Treat invitation-gated signups as already email-verified. Registration in
   * this package is hard invitation-gated — every account is created from an
   * invitation that was emailed to that exact address — so the invite plus the
   * link-click already proves mailbox ownership. A separate verification mail
   * therefore verifies nothing new (and, since register also auto-logs-in the
   * user, it would arrive *after* they are already signed in).
   *
   * When `true`, the handler creates the user with `emailVerified: true` and
   * skips the verification token **and** the verification email entirely.
   *
   * Defaults to `false` — fully backwards-compatible: the verification token +
   * mail are issued exactly as before, for consumers that do gate on
   * `emailVerified`. This flag covers only the **register** path; email
   * *change* always verifies the new address independently (see
   * `createVerifyEmailChangeHandler`), since there is no prior proof of
   * ownership for it.
   */
  autoVerifyInvited?: boolean;
}

export function createRegisterHandler<R extends string>(
  deps: AuthDeps<R>,
  options: RegisterHandlerOptions = {}
): { POST: RequestHandler } {
  const rateLimiter = makeRateLimiter(deps.config.rateLimit?.register);

  return {
    POST: async (event) => {
      const { request, cookies, getClientAddress } = event;
      const limited = await enforceRateLimit(
        rateLimiter,
        getClientAddress(),
        'Too many registration attempts. Please try again later.'
      );
      if (limited) return limited;

      const input = validateRegisterInput(await readJsonBody(request));
      if (!input.success) {
        return authError('validation_error', 400, {
          message: input.errors[0].message,
          extra: { errors: input.errors }
        });
      }
      const { email, name, password } = input.data;

      // Password strength validation
      const passwordErrors = validatePasswordStrength(password, deps.config.password);
      if (passwordErrors.length > 0) {
        return authError('validation_error', 400, {
          message: passwordErrors[0],
          extra: { errors: passwordErrors }
        });
      }

      // Account-enumeration stance (Finding M2, Cluster G.2): registration is
      // deliberately invitation-gated, and that gate IS the enumeration
      // defense. The distinct 403 ("invitation required" / "already used") and
      // 409 ("already registered") responses below are only ever observable to
      // someone who already holds an unused invitation for this exact email —
      // and invitations are minted by an admin (InvitationManager), never by
      // the attacker. An attacker probing arbitrary emails without an
      // invitation always gets the same 403 "invitation required", whether or
      // not that email is registered, so registration status doesn't leak. We
      // therefore keep the precise messages (they help the genuinely invited
      // user) rather than collapsing them. See docs/AUTH.md.
      //
      // This holds ONLY while invitations stay admin-minted. If a self-service
      // invitation path is ever added, the 403-vs-409 distinction becomes an
      // enumeration oracle for anyone — revisit (collapse the responses) then.
      const invitation = await deps.repos.invitation.findByEmail(email);
      if (!invitation) {
        return authError('invitation_required', 403);
      }
      if (invitation.usedAt) {
        return authError('invitation_used', 403);
      }

      // Check existing user (cheap early reject; the email unique-constraint is
      // the real serialization point on create below).
      const existing = await deps.repos.user.findByEmail(email);
      if (existing) {
        return authError('email_taken', 409);
      }

      const passwordHash = await hashPassword(password, deps.config.password);

      // Invitation-gated signups already prove mailbox ownership: the invite
      // was delivered to this exact address and its link-click proves receipt.
      // With `autoVerifyInvited`, skip the verification token entirely and
      // create the account pre-verified — a null token here means
      // "auto-verified" and gates BOTH the create shape and the mail send below.
      const verificationToken = options.autoVerifyInvited ? null : generateSecureToken();

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

      await deps.config.hooks?.onUserCreated?.(sanitizeUser(fullUser));

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
