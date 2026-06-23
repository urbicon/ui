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
import { escapeHtml } from '../email/templates.js';
import { enforceRateLimit, makeRateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { readJsonBody, validateRegisterInput } from '../validation.js';

export function createRegisterHandler<R extends string>(
  deps: AuthDeps<R>
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
        return json({ error: input.errors[0].message, errors: input.errors }, { status: 400 });
      }
      const { email, name, password } = input.data;

      // Password strength validation
      const passwordErrors = validatePasswordStrength(password, deps.config.password);
      if (passwordErrors.length > 0) {
        return json({ error: passwordErrors[0], errors: passwordErrors }, { status: 400 });
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
        return json({ error: 'An invitation is required to register.' }, { status: 403 });
      }
      if (invitation.usedAt) {
        return json({ error: 'This invitation has already been used.' }, { status: 403 });
      }

      // Check existing user (cheap early reject; the email unique-constraint is
      // the real serialization point on create below).
      const existing = await deps.repos.user.findByEmail(email);
      if (existing) {
        return json({ error: 'This email is already registered.' }, { status: 409 });
      }

      const passwordHash = await hashPassword(password, deps.config.password);
      const verificationToken = generateSecureToken();
      const tokenHash = hashToken(verificationToken);
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

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
        verificationToken: tokenHash,
        verificationTokenExpires: tokenExpires
      });

      // Re-read the full row instead of hand-assembling it: DB-defaulted
      // columns (tokenVersion, counters) come back authoritative, so adding a
      // column to the schema can't silently desync the in-memory shape.
      const fullUser = await deps.repos.user.findByEmail(email);
      if (!fullUser) {
        return json({ error: 'Registration failed. Please try again.' }, { status: 500 });
      }

      // Record consumption atomically. The create above already serialized
      // concurrent registrations; this flips usedAt without a lost update and,
      // on adapters lacking an email unique-constraint, still rejects a genuine
      // double-claim. A false result is an anomaly (the invitation was consumed
      // between our earlier check and now) — the account already exists, so we
      // surface it loudly rather than failing the request.
      const claimed = await deps.repos.invitation.markUsedIfUnused(invitation.id);
      if (!claimed) {
        console.warn(
          `[auth] register: created user ${fullUser.id} but invitation ${invitation.id} was already consumed — possible concurrent registration on an adapter without an email unique-constraint.`
        );
      }

      // Send verification email
      const verifyUrl = new URL('/auth/verify-email', deps.config.appUrl);
      verifyUrl.searchParams.set('token', verificationToken);

      await deps.email.send({
        from: deps.config.email?.from,
        to: email,
        subject: 'Verify your email',
        html: `<p>Hello ${escapeHtml(name)},</p><p>Please verify your email by clicking <a href="${escapeHtml(verifyUrl.toString())}">this link</a>.</p>`
      });

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
