import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { AuthConfig, RateLimitConfig } from '../../types.js';
import type {
  PasskeyRepository,
  RefreshTokenRepository,
  UserRepository
} from '../adapters/types.js';
import { sanitizeUser } from '../auth.js';
import { base64UrlDecode } from '../encoding.js';
import { requireSessionUser } from '../handlers/_shared.js';
import { authError } from '../handlers/errors.js';
import { enforceRateLimit, makeRateLimiter, type RateLimiter } from '../rate-limit.js';
import { establishSession, resolveSessionMeta } from '../session.js';
import { readJsonBody } from '../validation.js';
import { generateChallenge } from './challenge-store.js';
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

// Passkey authentication is two endpoints (options + verify) that form one
// login flow. Building a separate in-memory limiter per handler would split
// the per-IP budget in two — a consumer asking for "5 attempts" would get 5
// against each endpoint, doubling the real allowance. Cache the limiter by the
// identity of the `passkeyAuth` config object so both handlers built from the
// same config share one counter. (A consumer who supplies a persistent
// `store` shares server-side regardless; this fixes the in-memory default.)
const passkeyAuthLimiters = new WeakMap<RateLimitConfig, RateLimiter | null>();

function sharedPasskeyAuthLimiter(config: RateLimitConfig | undefined): RateLimiter | null {
  if (!config) return null;
  let limiter = passkeyAuthLimiters.get(config);
  if (limiter === undefined) {
    limiter = makeRateLimiter(config);
    passkeyAuthLimiters.set(config, limiter);
  }
  return limiter;
}

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
// deployment is HTTPS (`jwt.cookieSecure !== false`) and fall back to the bare
// name for non-HTTPS dev. Both handlers derive `secure` from the same config,
// so the set and the read always agree on the name.
function webauthnAuthCookieName(secure: boolean): string {
  return secure ? `__Host-${WEBAUTHN_AUTH_COOKIE}` : WEBAUTHN_AUTH_COOKIE;
}

export interface PasskeyHandlerDeps<R extends string = string> {
  webauthn: WebAuthnConfig;
  authConfig: AuthConfig<R>;
  repos: {
    passkey: PasskeyRepository;
    user: UserRepository<R>;
    /** Required when `authConfig.refreshToken` is set. */
    refreshToken?: RefreshTokenRepository;
  };
}

// Resolve the authenticated caller from the session cookie — the same path
// the account handlers use — instead of `locals.user`: a consumer's
// `transformUser` hook may reshape locals arbitrarily, which used to break
// these handlers silently (`user.id === undefined` flowing into repo lookups,
// review finding R5). Cookie resolution also re-validates `tokenVersion`.
function sessionUser<R extends string>(deps: PasskeyHandlerDeps<R>, cookies: Cookies) {
  return requireSessionUser({ config: deps.authConfig, repos: deps.repos }, cookies);
}

// ---- Registration Options ----

export function createPasskeyRegistrationOptionsHandler<R extends string>(
  deps: PasskeyHandlerDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async ({ cookies }) => {
      const user = await sessionUser(deps, cookies);
      if (!user) {
        return authError('not_authenticated', 401);
      }

      const existing = await deps.repos.passkey.findByUserId(user.id);
      const existingIds = existing.map((p) => p.credentialId);

      const options = await generateRegistrationOptions(
        deps.webauthn,
        { id: user.id, name: user.email, displayName: user.name },
        existingIds
      );

      return json({ options });
    }
  };
}

// ---- Registration Verify ----

export function createPasskeyRegistrationVerifyHandler<R extends string>(
  deps: PasskeyHandlerDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async ({ request, cookies }) => {
      const user = await sessionUser(deps, cookies);
      if (!user) {
        return authError('not_authenticated', 401);
      }

      try {
        const { credential, name } = (await readJsonBody(request)) as {
          credential: RegistrationCredentialJSON;
          name?: string;
        };

        if (!credential) {
          return authError('validation_error', 400, { message: 'Credential is required' });
        }

        const verified = await verifyRegistration(deps.webauthn, user.id, credential);

        const passkey = await deps.repos.passkey.create(user.id, {
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
          return authError('passkey_verification_failed', 400, { message: err.message });
        }
        throw err;
      }
    }
  };
}

// ---- Authentication Options ----

export function createPasskeyAuthenticationOptionsHandler<R extends string>(
  deps: PasskeyHandlerDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = sharedPasskeyAuthLimiter(deps.authConfig.rateLimit?.passkeyAuth);

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
          const passkeys = await deps.repos.passkey.findByUserId(user.id);
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
      const options = await generateAuthenticationOptions(deps.webauthn, ceremonyId, credentialIds);

      const secure = deps.authConfig.jwt.cookieSecure !== false;
      cookies.set(webauthnAuthCookieName(secure), ceremonyId, {
        path: '/',
        httpOnly: true,
        secure,
        // `strict`: the whole ceremony is same-origin fetch (options → get() →
        // verify) with no navigation in between, so the tightest SameSite
        // applies without any UX cost — unlike the session cookie, this handle
        // never needs to survive a cross-site top-level navigation.
        sameSite: 'strict',
        // Expire the pointer with the challenge it points at (default 5 min).
        maxAge: Math.ceil((deps.webauthn.challengeTimeout ?? 300_000) / 1000)
      });

      return json({ options });
    }
  };
}

// ---- Authentication Verify ----

export function createPasskeyAuthenticationVerifyHandler<R extends string>(
  deps: PasskeyHandlerDeps<R>
): { POST: RequestHandler } {
  const rateLimiter = sharedPasskeyAuthLimiter(deps.authConfig.rateLimit?.passkeyAuth);

  // Audit-seam parity with the password login (review finding R10): every
  // terminal outcome of a passkey login fires the same consumer hooks, so an
  // audit log sees passkey logins too. The email argument is '' on paths where
  // the ceremony fails before a user is resolved — discoverable login knows no
  // email up front; the reason string disambiguates.
  const loginFailed = (email: string, reason: string) =>
    deps.authConfig.hooks?.onLoginFailed?.(email, reason);

  return {
    POST: async (event) => {
      const { request, cookies, getClientAddress } = event;
      const limited = await enforceRateLimit(rateLimiter, getClientAddress());
      if (limited) return limited;

      // Gate on the ceremony handle first — it's the cheapest check and the
      // flow's precondition. No cookie → the options step never ran for this
      // browser, or the cookie was stripped/expired. Fail closed (like a
      // missing challenge) before parsing the body or touching the credential
      // store, and never fall back to a user-keyed lookup.
      const secure = deps.authConfig.jwt.cookieSecure !== false;
      const cookieName = webauthnAuthCookieName(secure);
      const ceremonyId = cookies.get(cookieName);
      if (!ceremonyId) {
        await loginFailed('', 'challenge_missing');
        return authError('passkey_verification_failed', 400, {
          message: 'Challenge expired or not found'
        });
      }
      // Invalidate the single-use handle immediately, so no error path (or
      // replay) downstream can reuse it.
      cookies.delete(cookieName, { path: '/' });

      try {
        const { credential } = (await readJsonBody(request)) as {
          credential: AuthenticationCredentialJSON;
        };

        if (!credential) {
          return authError('validation_error', 400, { message: 'Credential is required' });
        }

        // Look up the stored credential
        const stored = await deps.repos.passkey.findByCredentialId(credential.id);
        if (!stored) {
          await loginFailed('', 'unknown_credential');
          return authError('passkey_verification_failed', 400, { message: 'Unknown credential' });
        }

        // Verify the assertion. The challenge is consumed under the ceremony
        // handle (not stored.userId) — that is what makes discoverable login
        // work; the user is identified by `stored` below.
        const verified = await verifyAssertion(
          deps.webauthn,
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
            await loginFailed('', 'user_handle_mismatch');
            return authError('passkey_verification_failed', 400, {
              message: 'User handle mismatch'
            });
          }
        }

        // Update counter (compare-and-set). A false result after a passed
        // assertion means a concurrent request already advanced the counter —
        // i.e. a replay slipped through the read→verify gap. Reject it; this
        // closes the cloned-authenticator window the bare update left open.
        const advanced = await deps.repos.passkey.updateCounter(credential.id, verified.newCounter);
        if (!advanced) {
          await loginFailed('', 'counter_regression');
          return authError('passkey_verification_failed', 400, {
            message: 'Counter did not increase — possible cloned authenticator'
          });
        }

        // Load user and create session
        const user = await deps.repos.user.findById(stored.userId);
        if (!user) {
          await loginFailed('', 'user_not_found');
          return authError('passkey_verification_failed', 400, { message: 'User not found' });
        }

        // No TOTP 2FA gate here, by design: a passkey is already a strong,
        // phishing-resistant factor, so a successful assertion establishes the
        // session directly even when `user.totpEnabled` is set. The 2FA gate
        // applies only to the password login path (see login.ts).
        await establishSession(
          cookies,
          user,
          deps.authConfig,
          deps.repos,
          resolveSessionMeta(event, deps.authConfig)
        );

        const safeUser = sanitizeUser(user);
        await deps.authConfig.hooks?.onLoginSuccess?.(safeUser);
        return json({ user: safeUser });
      } catch (err) {
        if (err instanceof WebAuthnError) {
          // The assertion itself was rejected (bad signature, challenge
          // mismatch, origin, …) — the audit-relevant failure class.
          await loginFailed('', 'invalid_assertion');
          return authError('passkey_verification_failed', 400, { message: err.message });
        }
        throw err;
      }
    }
  };
}

// ---- List ----

/**
 * Self-service passkey listing: the server half of `<PasskeyManager>`'s list
 * view (the four ceremony handlers above cover register/login). Mount `GET`
 * on `${basePath}/list`:
 *
 * ```ts
 * // src/routes/api/passkeys/list/+server.ts
 * export const GET = createPasskeyListHandler(deps).GET;
 * ```
 */
export function createPasskeyListHandler<R extends string>(
  deps: PasskeyHandlerDeps<R>
): { GET: RequestHandler } {
  return {
    GET: async ({ cookies }) => {
      const user = await sessionUser(deps, cookies);
      if (!user) {
        return authError('not_authenticated', 401);
      }

      const passkeys = await deps.repos.passkey.findByUserId(user.id);
      // Project to the display shape: the stored COSE public key and the sign
      // counter are server-internal verification state and must not travel to
      // the client.
      return json({
        passkeys: passkeys.map((p) => ({
          credentialId: p.credentialId,
          name: p.name,
          createdAt: p.createdAt,
          lastUsedAt: p.lastUsedAt,
          aaguid: p.aaguid
        }))
      });
    }
  };
}

// ---- Delete ----

/**
 * Self-service passkey removal: the server half of `<PasskeyManager>`'s
 * remove action. Mount `DELETE` on `${basePath}/[credentialId]` (the static
 * sibling routes — `list`, `registration-options`, … — take precedence over
 * the param route, so they can share the base path):
 *
 * ```ts
 * // src/routes/api/passkeys/[credentialId]/+server.ts
 * export const DELETE = createPasskeyDeleteHandler(deps).DELETE;
 * ```
 *
 * The repository delete is owner-scoped (`delete(credentialId, userId)`), so
 * a caller guessing someone else's credential id hits a no-op; the response
 * is deliberately idempotent (`200` whether or not a row matched).
 */
export function createPasskeyDeleteHandler<R extends string>(
  deps: PasskeyHandlerDeps<R>
): { DELETE: RequestHandler } {
  return {
    DELETE: async ({ cookies, params }) => {
      const user = await sessionUser(deps, cookies);
      if (!user) {
        return authError('not_authenticated', 401);
      }

      const credentialId = params.credentialId;
      if (!credentialId) {
        return authError('validation_error', 400, { message: 'Credential id is required' });
      }

      await deps.repos.passkey.delete(credentialId, user.id);
      return json({ success: true });
    }
  };
}
