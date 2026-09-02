import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { Passkey, PasskeyRepository } from '../adapters/types.js';
import { sanitizeUser } from '../auth.js';
import { isSecureDeployment } from '../cookie-policy.js';
import type { AuthDeps } from '../deps.js';
import { base64UrlDecode } from '../encoding.js';
import {
  notifyHook,
  parseBody,
  privateEndpoints,
  requireSessionUser
} from '../handlers/_shared.js';
import { authError } from '../handlers/errors.js';
import { enforceRateLimit, sharedLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { readJsonBody, validatePasskeyNameInput } from '../validation.js';
import { generateChallenge, resolveChallengeTimeoutSeconds } from './challenge-store.js';
import { WebAuthnError } from './errors.js';
import {
  type AuthenticationCredentialJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationCredentialJSON,
  verifyAssertion,
  verifyRegistration,
  type WebAuthnConfig
} from './webauthn.js';

// One warning per `WebAuthnConfig`: it describes the config, not the call. A
// consumer who calls this factory from several route modules with one shared
// config object gets one line; distinct config literals are distinct configs
// and warn once each.
const uvTwoFactorWarned = new WeakSet<WebAuthnConfig>();

// Cookie carrying the per-ceremony challenge handle for passkey authentication.
// Discoverable ("usernameless") login can't bind the challenge to a user at
// options time — the user is unknown until the authenticator returns a
// credential — so the options handler mints a fresh opaque handle, stores the
// challenge under it, and pins the handle here; the verify handler reads it
// back to locate and consume the right challenge. Single-use + short-lived.
const WEBAUTHN_AUTH_COOKIE = 'urbicon_webauthn_auth';

// The `__Host-` prefix blocks a sibling/parent subdomain from shadowing the
// handle via cookie-tossing. It mandates Secure + Path=/ + no Domain, so a
// browser drops such a cookie over plain HTTP — use it only when the
// deployment is HTTPS (`isSecureDeployment`) and fall back to the bare name for
// non-HTTPS dev. Both handlers derive `secure` from the same predicate, so the
// set and the read always agree on the name — across all three cookie configs,
// not just `jwt`.
function webauthnAuthCookieName(secure: boolean): string {
  return secure ? `__Host-${WEBAUTHN_AUTH_COOKIE}` : WEBAUTHN_AUTH_COOKIE;
}

/**
 * The full passkey route group: the four WebAuthn ceremony endpoints plus the
 * self-service list/rename/delete set behind `<PasskeyManager>`. One bundled factory
 * (the package's multi-route convention, like `createInvitationHandlers` /
 * `createNotificationsHandlers`) over the canonical `AuthDeps` bundle; the
 * WebAuthn ceremony config rides as the second argument. Mount the groups on
 * the paths the client components call (default base `/api/auth/passkey`):
 *
 * ```ts
 * const passkey = createPasskeyHandlers(deps, webauthnConfig);
 * // …/registration-options/+server.ts    → export const POST = passkey.registrationOptions.POST;
 * // …/registration-verify/+server.ts     → export const POST = passkey.registrationVerify.POST;
 * // …/authentication-options/+server.ts  → export const POST = passkey.authenticationOptions.POST;
 * // …/authentication-verify/+server.ts   → export const POST = passkey.authenticationVerify.POST;
 * // …/list/+server.ts                    → export const GET = passkey.list.GET;
 * // …/[credentialId]/+server.ts          → export const DELETE = passkey.item.DELETE;
 * //                                        export const PATCH = passkey.item.PATCH;
 * ```
 *
 * (The static sibling routes take precedence over the `[credentialId]` param
 * route, so all six share the base path.) Requires `deps.repos.passkey` —
 * throws at wiring time when it is missing (fail-loud, not a latent 500).
 *
 * Every ceremony failure answers with the bare `passkey_verification_failed`
 * code and no `message` override, so the browser gets one localized sentence
 * (`auth.errors.passkeyVerificationFailed`) whatever went wrong: none of the
 * causes is actionable by the user, and one of them — the sign-counter
 * regression — is a clone warning that must not be readable in a page. What
 * separates them stays server-side: `config.hooks.onLoginFailed(email, reason)`
 * receives a distinct reason per outcome, and `deps.logger` receives the three
 * details a reason string cannot carry.
 */
export function createPasskeyHandlers<R extends string>(
  deps: AuthDeps<R>,
  webauthn: WebAuthnConfig
): {
  registrationOptions: { POST: RequestHandler };
  registrationVerify: { POST: RequestHandler };
  authenticationOptions: { POST: RequestHandler };
  authenticationVerify: { POST: RequestHandler };
  list: { GET: RequestHandler };
  item: { DELETE: RequestHandler; PATCH: RequestHandler };
} {
  const passkeyRepo = deps.repos.passkey;
  if (!passkeyRepo) {
    throw new Error(
      'createPasskeyHandlers: deps.repos.passkey is required — pass the adapter’s passkey repository.'
    );
  }

  // `authenticationVerify` establishes the session without the TOTP gate, which
  // holds only while a passkey is more than possession. Opting out of user
  // verification makes it exactly that, so with `config.twoFactor` wired the
  // pair downgrades a TOTP-enrolled user's passkey login to one factor. Warn
  // rather than throw: the opt-out is legitimate for authenticators that cannot
  // do UV, and this is the consumer's call to make.
  if (
    webauthn.requireUserVerification === false &&
    deps.config.twoFactor &&
    !uvTwoFactorWarned.has(webauthn)
  ) {
    uvTwoFactorWarned.add(webauthn);
    deps.logger.warn(
      '[auth] webauthn.requireUserVerification is explicitly false while config.twoFactor is set — passkey logins are not TOTP-gated, so a tap-only authenticator signs a TOTP-enrolled user in with a single factor. Drop the opt-out (UV is required by default) or accept it deliberately.'
    );
  }

  // Resolve the authenticated caller from the session cookie — the same path
  // the account handlers use — instead of `locals.user`: a consumer's
  // `transformUser` hook may reshape locals arbitrarily, which used to break
  // these handlers silently (`user.id === undefined` flowing into repo
  // lookups, review finding R5). Cookie resolution also re-validates
  // `tokenVersion`.
  const sessionUser = (cookies: Cookies) => requireSessionUser(deps, cookies);

  // The ceremony core is deps-free, so hand it the resolved sink here rather
  // than letting it fall back to bare `console`. Copied once at factory time:
  // every handler below shares this object, so `challengeStore` identity and
  // the ceremony config stay single.
  const ceremony: WebAuthnConfig = { ...webauthn, logger: webauthn.logger ?? deps.logger };

  return privateEndpoints({
    registrationOptions: registrationOptionsHandler(deps, ceremony, passkeyRepo, sessionUser),
    registrationVerify: registrationVerifyHandler(deps, ceremony, passkeyRepo, sessionUser),
    authenticationOptions: authenticationOptionsHandler(deps, ceremony, passkeyRepo),
    authenticationVerify: authenticationVerifyHandler(deps, ceremony, passkeyRepo),
    list: listHandler(passkeyRepo, sessionUser),
    item: { ...deleteHandler(passkeyRepo, sessionUser), ...renameHandler(passkeyRepo, sessionUser) }
  });
}

type SessionUserResolver<R extends string> = (
  cookies: Cookies
) => ReturnType<typeof requireSessionUser<R>>;

// ---- Registration Options ----

function registrationOptionsHandler<R extends string>(
  _deps: AuthDeps<R>,
  webauthn: WebAuthnConfig,
  passkeyRepo: PasskeyRepository,
  sessionUser: SessionUserResolver<R>
): { POST: RequestHandler } {
  return {
    POST: async ({ cookies }) => {
      const user = await sessionUser(cookies);
      if (!user) {
        return authError('not_authenticated');
      }

      const existing = await passkeyRepo.findByUserId(user.id);
      const existingIds = existing.map((p) => p.credentialId);

      const options = await generateRegistrationOptions(
        webauthn,
        { id: user.id, name: user.email, displayName: user.name },
        existingIds
      );

      return json({ options });
    }
  };
}

// ---- Registration Verify ----

function registrationVerifyHandler<R extends string>(
  deps: AuthDeps<R>,
  webauthn: WebAuthnConfig,
  passkeyRepo: PasskeyRepository,
  sessionUser: SessionUserResolver<R>
): { POST: RequestHandler } {
  return {
    POST: async ({ request, cookies }) => {
      const user = await sessionUser(cookies);
      if (!user) {
        return authError('not_authenticated');
      }

      try {
        const { credential, name } = (await readJsonBody(request)) as {
          credential: RegistrationCredentialJSON;
          name?: string;
        };

        if (!credential) {
          return authError('validation_error', { message: 'Credential is required' });
        }

        const verified = await verifyRegistration(webauthn, user.id, credential);

        const passkey = await passkeyRepo.create(user.id, {
          credentialId: verified.credentialId,
          publicKey: verified.publicKey,
          publicKeyAlg: verified.publicKeyAlg,
          counter: verified.counter,
          transports: verified.transports,
          aaguid: verified.aaguid,
          name
        });

        return json(
          {
            passkey: {
              credentialId: passkey.credentialId,
              name: passkey.name,
              createdAt: passkey.createdAt,
              aaguid: passkey.aaguid
            }
          },
          { status: 201 }
        );
      } catch (err) {
        if (err instanceof WebAuthnError) {
          // The WebAuthn cause goes to the log, not onto the wire: it names
          // internals ("challenge mismatch", "origin"), and this handler has no
          // `onLoginFailed` seam to carry it — registration is not a login.
          deps.logger.warn('[auth] passkey registration verification failed:', err.message);
          return authError('passkey_registration_verification_failed');
        }
        throw err;
      }
    }
  };
}

// ---- Authentication Options ----

function authenticationOptionsHandler<R extends string>(
  deps: AuthDeps<R>,
  webauthn: WebAuthnConfig,
  passkeyRepo: PasskeyRepository
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'passkeyAuth');

  return {
    POST: async ({ request, cookies, getClientAddress }) => {
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      const body = await request.json().catch(() => ({}));
      const email = body?.email;

      // `email` is an optional UX hint: when supplied and known, scope the
      // ceremony to that user's credentials (`allowCredentials`). Absent or
      // unknown → an empty list, i.e. the discoverable-credential flow where
      // the authenticator offers any resident credential for this RP. Either
      // way we do NOT leak whether the email exists.
      let credentialIds: string[] = [];
      if (email) {
        const user = await deps.repos.user.findByEmail(email);
        if (user) {
          const passkeys = await passkeyRepo.findByUserId(user.id);
          credentialIds = passkeys.map((p) => p.credentialId);
        }
      }

      // Bind the challenge to a fresh, opaque ceremony handle rather than to a
      // user: discoverable login has no user at this point, so keying by userId
      // left the challenge unfindable at verify time (Finding M4). Email-first
      // login benefits too — two overlapping ceremonies no longer clobber each
      // other's challenge. The handle travels in an HttpOnly cookie the verify
      // step reads back.
      //
      // `ceremonyId` is an independent random token used ONLY as the
      // challenge-store key — NOT the WebAuthn challenge itself.
      // `generateAuthenticationOptions` mints the real challenge separately and
      // stores it under this handle. (We reuse the package's CSPRNG primitive.)
      const ceremonyId = generateChallenge();
      const options = await generateAuthenticationOptions(webauthn, ceremonyId, credentialIds);

      const secure = isSecureDeployment(deps.config);
      cookies.set(webauthnAuthCookieName(secure), ceremonyId, {
        path: '/',
        httpOnly: true,
        secure,
        // `strict`: the whole ceremony is same-origin fetch (options → get() →
        // verify) with no navigation in between, so the tightest SameSite
        // applies without any UX cost — unlike the session cookie, this handle
        // never needs to survive a cross-site top-level navigation.
        sameSite: 'strict',
        // Expire the pointer with the challenge it points at — same resolver,
        // so the cookie cannot outlive what it points to.
        maxAge: resolveChallengeTimeoutSeconds(webauthn)
      });

      return json({ options });
    }
  };
}

// ---- Authentication Verify ----

function authenticationVerifyHandler<R extends string>(
  deps: AuthDeps<R>,
  webauthn: WebAuthnConfig,
  passkeyRepo: PasskeyRepository
): { POST: RequestHandler } {
  const rateLimiter = sharedLimiter(deps.config, 'passkeyAuth');

  // Audit-seam parity with the password login: every
  // terminal outcome of a passkey login fires the same consumer hooks, so an
  // audit log sees passkey logins too. The email argument is '' on every path —
  // discoverable login knows no address up front; the reason string
  // disambiguates. `subject` is the stored credential's owner where the path
  // got that far — the rejected assertion included, whose credential was
  // looked up before its signature failed — and `null` on the two that reject
  // before any lookup resolves one (challenge_missing, unknown_credential).
  // Never the email, which must stay out of the log.
  const loginFailed = (email: string, reason: string, subject: string | null) =>
    notifyHook(deps, { site: 'passkey', subject }, 'onLoginFailed', email, reason);

  return {
    POST: async (event) => {
      const { request, cookies, getClientAddress } = event;
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;
      // Hoisted out of the `try` so the WebAuthnError catch can name the owner.
      let stored: Passkey | null = null;

      // Gate on the ceremony handle first — it's the cheapest check and the
      // flow's precondition. No cookie → the options step never ran for this
      // browser, or the cookie was stripped/expired. Fail closed (like a
      // missing challenge) before parsing the body or touching the credential
      // store, and never fall back to a user-keyed lookup.
      const secure = isSecureDeployment(deps.config);
      const cookieName = webauthnAuthCookieName(secure);
      const ceremonyId = cookies.get(cookieName);
      if (!ceremonyId) {
        await loginFailed('', 'challenge_missing', null);
        return authError('passkey_verification_failed');
      }
      // Invalidate the single-use handle immediately, so no error path (or
      // replay) downstream can reuse it.
      cookies.delete(cookieName, { path: '/' });

      try {
        const { credential } = (await readJsonBody(request)) as {
          credential: AuthenticationCredentialJSON;
        };

        if (!credential) {
          return authError('validation_error', { message: 'Credential is required' });
        }

        // Look up the stored credential
        stored = await passkeyRepo.findByCredentialId(credential.id);
        if (!stored) {
          await loginFailed('', 'unknown_credential', null);
          // The browser offered a passkey this server does not hold — the
          // steady state after a deletion from another device, and what every
          // retry after `credential_deleted` below lands on. A distinct code so
          // the page can say "sign in another way" instead of "try again".
          // Not an oracle worth hiding: in the email flow the options response
          // already lists the account's credential IDs, and in the discoverable
          // flow the ID is authenticator-minted (≥ 16 random bytes) — a probe
          // with a made-up ID learns that a random value is unregistered, which
          // the lookup's timing told it before this line ran.
          return authError('passkey_credential_deleted');
        }

        // Verify the assertion. The challenge is consumed under the ceremony
        // handle (not stored.userId) — that is what makes discoverable login
        // work; the user is identified by `stored` below.
        const verified = await verifyAssertion(
          webauthn,
          ceremonyId,
          credential,
          stored.publicKey,
          stored.publicKeyAlg,
          stored.counter
        );

        // Defense-in-depth (WebAuthn L2 §7.2 step 6): when the authenticator
        // returns a user handle, it must identify the same user the stored
        // credential belongs to. We already trust `stored.userId` (our DB), so
        // a mismatch can't escalate by itself — but rejecting it keeps the
        // assertion spec-compliant and guards against a future caller that
        // trusts the returned handle. The handle is base64url(utf8(userId)).
        if (verified.userHandle) {
          let handleUserId: string | null = null;
          try {
            handleUserId = new TextDecoder().decode(base64UrlDecode(verified.userHandle));
          } catch {
            handleUserId = null;
          }
          if (handleUserId !== stored.userId) {
            await loginFailed('', 'user_handle_mismatch', stored.userId);
            return authError('passkey_verification_failed');
          }
        }

        // Update counter (compare-and-set). A false result after a passed
        // assertion means a concurrent request already advanced the counter —
        // i.e. a replay slipped through the read→verify gap. Reject it; this
        // closes the cloned-authenticator window the bare update left open.
        const advanced = await passkeyRepo.updateCounter(credential.id, verified.newCounter);
        if (!advanced) {
          // A false compare-and-set has two causes: a concurrent request already
          // advanced the counter — a replay through the read→verify gap, the
          // genuine cloned-authenticator signal — OR the credential was deleted
          // mid-login (a benign delete-race). Re-query to tell them apart so a SOC
          // doesn't alarm on a routine deletion as a clone attack. One extra read
          // on this rare fail-closed path; the rejection is identical either way.
          const stillStored = await passkeyRepo.findByCredentialId(stored.credentialId);
          if (!stillStored) {
            await loginFailed('', 'credential_deleted', stored.userId);
            return authError('passkey_credential_deleted');
          }
          await loginFailed('', 'counter_regression', stored.userId);
          // Logged as well as hooked: this is the one outcome an operator must
          // see even without an `onLoginFailed` hook wired, and the words
          // "possible cloned authenticator" belong nowhere near an end user.
          deps.logger.warn(
            `[auth] passkey counter did not increase for credential ${stored.credentialId} (user ${stored.userId}) — possible cloned authenticator`
          );
          return authError('passkey_verification_failed');
        }

        // Load user and create session
        const user = await deps.repos.user.findById(stored.userId);
        if (!user) {
          await loginFailed('', 'user_not_found', stored.userId);
          return authError('passkey_verification_failed');
        }

        // A completed ceremony hands back the two calls it cost (options +
        // verify share this bucket), so only abandoned or failed ceremonies
        // spend a shared address's budget. Two and not a reset, for the same
        // reason as the password login: a success may only return what it took.
        await rateLimiter?.refund(getClientAddress(), 2);

        // No TOTP 2FA gate here, by design: a user-verified passkey is already
        // a strong, phishing-resistant factor, so a successful assertion
        // establishes the session directly even when `user.totpEnabled` is set.
        // The 2FA gate applies only to the password login path (see login.ts).
        await establishSession(
          cookies,
          user,
          deps.config,
          deps.repos,
          resolveSessionMeta(event, deps.config)
        );

        const safeUser = sanitizeUser(user);
        // Post-commit: the counter is advanced and the session established.
        // The wrapper also keeps a hook that throws a WebAuthnError out of the
        // catch below, which would file a completed login as a failed assertion.
        await notifyHook(deps, { site: 'passkey', subject: user.id }, 'onLoginSuccess', safeUser);
        return json({ user: safeUser });
      } catch (err) {
        if (err instanceof WebAuthnError) {
          // The assertion itself was rejected (bad signature, challenge
          // mismatch, origin, …) — the audit-relevant failure class.
          await loginFailed('', 'invalid_assertion', stored?.userId ?? null);
          // `invalid_assertion` collapses every WebAuthn cause into one reason;
          // the specific one is only in the error, so it goes to the log.
          deps.logger.warn('[auth] passkey assertion rejected:', err.message);
          return authError('passkey_verification_failed');
        }
        throw err;
      }
    }
  };
}

// ---- List ----

/**
 * One stored passkey as `<PasskeyManager>` renders it. The stored COSE public
 * key and the sign counter are server-internal verification state and must not
 * travel to the client, so the projection is by allow-list rather than by
 * subtraction — a column added to `Passkey` cannot leak through it.
 *
 * Shared by `list` and by the rename response, which is why it is a function:
 * the panel replaces one row with what the rename answered, so a field the two
 * shapes disagreed on would blank itself on every rename.
 */
function toPasskeyView(p: Passkey) {
  return {
    credentialId: p.credentialId,
    name: p.name,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
    aaguid: p.aaguid
  };
}

// Self-service passkey listing: the server half of `<PasskeyManager>`'s list
// view (the four ceremony handlers above cover register/login).
function listHandler<R extends string>(
  passkeyRepo: PasskeyRepository,
  sessionUser: SessionUserResolver<R>
): { GET: RequestHandler } {
  return {
    GET: async ({ cookies }) => {
      const user = await sessionUser(cookies);
      if (!user) {
        return authError('not_authenticated');
      }

      const passkeys = await passkeyRepo.findByUserId(user.id);
      return json({ passkeys: passkeys.map(toPasskeyView) });
    }
  };
}

// ---- Rename ----

/**
 * Self-service passkey relabelling — the only writer of
 * `PasskeyRepository.rename`, which every adapter had to implement while no
 * shipped code path reached it.
 *
 * **The ownership check is here, not delegated to the repository.** `rename` is
 * contractually owner-scoped, so a foreign credentialId is a no-op there — but
 * a handler that only calls it cannot tell a rename that happened from one that
 * did not, and would answer `200` on the strength of the adapter alone. Reading
 * the row first makes the refusal this handler's own, and pays for itself: the
 * response echoes the renamed row, so the panel adopts the stored name (the
 * server trims) instead of its own draft.
 *
 * No rate limiter, matching `item.DELETE` and `list.GET` beside it. Every
 * `rateLimit` key in this package guards an endpoint that either accepts a
 * credential (`login`, `changePassword`, `twoFactor`) or answers before a
 * session exists (`passkeyAuth`); a relabel does neither, and the other
 * authenticated write that takes a display name — `update-profile` — is
 * likewise unlimited.
 */
function renameHandler<R extends string>(
  passkeyRepo: PasskeyRepository,
  sessionUser: SessionUserResolver<R>
): { PATCH: RequestHandler } {
  return {
    PATCH: async ({ request, cookies, params }) => {
      const user = await sessionUser(cookies);
      if (!user) {
        return authError('not_authenticated');
      }

      const credentialId = params.credentialId;
      if (!credentialId) {
        return authError('validation_error', { message: 'Credential id is required' });
      }

      const body = await parseBody(request, validatePasskeyNameInput);
      if (body instanceof Response) return body;
      const { name } = body.data;

      const stored = await passkeyRepo.findByCredentialId(credentialId);
      // One answer for "no such credential" and "not yours": a 403 on the
      // second would confirm that a credentialId the caller does not own is
      // registered here.
      if (!stored || stored.userId !== user.id) {
        return authError('passkey_not_found');
      }

      await passkeyRepo.rename(user.id, credentialId, name);

      // The row is echoed from what was read plus the name just written, the
      // way `update-profile` echoes the updated user — a re-read would cost a
      // second round trip to restate what this handler just decided.
      return json({ passkey: toPasskeyView({ ...stored, name }) });
    }
  };
}

// ---- Delete ----

// Self-service passkey removal. The repository delete is owner-scoped
// (`delete(userId, credentialId)`), so a caller guessing someone else's
// credential id hits a no-op; the response is deliberately idempotent
// (`200` whether or not a row matched).
function deleteHandler<R extends string>(
  passkeyRepo: PasskeyRepository,
  sessionUser: SessionUserResolver<R>
): { DELETE: RequestHandler } {
  return {
    DELETE: async ({ cookies, params }) => {
      const user = await sessionUser(cookies);
      if (!user) {
        return authError('not_authenticated');
      }

      const credentialId = params.credentialId;
      if (!credentialId) {
        return authError('validation_error', { message: 'Credential id is required' });
      }

      await passkeyRepo.delete(user.id, credentialId);
      return json({ success: true });
    }
  };
}
