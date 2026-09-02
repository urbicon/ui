import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { resolvePasswordPolicy, unmetPasswordRules } from '../../password-policy.js';
import type { AuthConfig, AuthLogger, JwtConfig, PasswordConfig } from '../../types.js';
import type { FullAuthUser, UserRepository } from '../adapters/types.js';
import type { AuthDeps } from '../deps.js';
import { passwordRuleMessage, verifyPasswordWithMigration } from '../password.js';
import { getSessionFromCookie } from '../session.js';
import { readJsonBody, type ValidationResult } from '../validation.js';
import { authError } from './errors.js';

/**
 * Parse and validate a JSON request body, or produce the canonical
 * validation-error `400`. Result-or-Response form of the six-line block every
 * body-taking handler repeated verbatim:
 *
 * ```ts
 * const body = await parseBody(request, validateLoginInput);
 * if (body instanceof Response) return body;
 * const { email, password } = body.data;
 * ```
 *
 * The first field error becomes the `error` prose (the client's fallback
 * surfaces it verbatim); the full list rides along as `errors`.
 */
export async function parseBody<T>(
  request: Request,
  validate: (raw: unknown) => ValidationResult<T>
): Promise<{ data: T } | Response> {
  const input = validate(await readJsonBody(request));
  if (!input.success) {
    return authError('validation_error', {
      message: input.errors[0].message,
      extra: { errors: input.errors }
    });
  }
  return { data: input.data };
}

type AuthHooks<R extends string> = NonNullable<AuthConfig<R>['hooks']>;
type HookName = keyof AuthHooks<string> & string;

/**
 * What a throw out of each consumer hook does — `abort` for the two that gate
 * an outcome which has not happened yet, `catch` for everything that only
 * reports. Each hook's own doc comment on `AuthConfig.hooks` carries the
 * reasoning; this is where a reader looks up the split.
 *
 * `satisfies Record<HookName, …>` makes the classification **total**, which is
 * the point of the table: a hook added to `AuthConfig.hooks` without an entry
 * here does not compile, and neither does an entry whose hook was renamed or
 * removed. Both unions below are projections of it, so no third place can
 * disagree with it. Compile-time only — nothing reads it at runtime.
 */
const HOOK_CLASS = {
  onUserCreated: 'catch',
  onPasswordChanged: 'catch',
  onLoginSuccess: 'catch',
  onLoginFailed: 'catch',
  onPasswordResetFailed: 'catch',
  onInvitationEmailFailed: 'catch',
  onEmailChangeRequested: 'catch',
  onEmailChangeFailed: 'catch',
  onEmailChanged: 'catch',
  onBeforeAccountDelete: 'abort',
  transformUser: 'abort'
} satisfies Record<HookName, 'abort' | 'catch'>;

export type HookNamesOfClass<C extends 'abort' | 'catch'> = {
  [K in HookName]: (typeof HOOK_CLASS)[K] extends C ? K : never;
}[HookName];

/** A throw reaches the caller: `onBeforeAccountDelete`, `transformUser`. */
export type AbortingHookName = HookNamesOfClass<'abort'>;

/** A throw is caught and logged — every other hook. */
export type CaughtHookName = HookNamesOfClass<'catch'>;

/**
 * Invoke a consumer hook so a throw inside it cannot change what the handler
 * already achieved.
 *
 * These hooks all report rather than gate, and every call site runs after the
 * outcome it reports — the write is committed, the cookie is set, or the
 * response has already been sent (the detached forgot-password / change-email
 * paths). A throw there could only replace a truthful status with a `500`.
 *
 * The error is always logged, never swallowed. `deps.logger` is shielded
 * against a throwing consumer sink when the bundle came from `createAuthDeps`;
 * a hand-assembled `AuthDeps` carries whatever logger it was given.
 *
 * `hook` is a key of the hooks object rather than a label, so the name in the
 * log line and the function invoked cannot disagree. `subject` identifies the
 * affected record — an **id, never an email address or other PII**, since this
 * line goes to a sink the package does not control. Pass `null` on the paths
 * that resolve no record (an unknown login email, a passkey ceremony that
 * fails before its owner is known).
 */
export async function notifyHook<R extends string, K extends CaughtHookName>(
  deps: { config: AuthConfig<R>; logger: AuthLogger },
  where: { site: string; subject: string | null },
  hook: K,
  ...args: Parameters<NonNullable<AuthHooks<R>[K]>>
): Promise<void> {
  const fn = deps.config.hooks?.[hook] as
    | ((...hookArgs: Parameters<NonNullable<AuthHooks<R>[K]>>) => Promise<void> | void)
    | undefined;
  if (!fn) return;
  try {
    await fn(...args);
  } catch (err) {
    const subject = where.subject ? ` for ${where.subject}` : '';
    deps.logger.error(
      `[auth] ${where.site}: ${hook} hook threw${subject} (caught — the handler's outcome is unchanged)`,
      err
    );
  }
}

/**
 * Refuse a password that misses the configured policy, or `null` when it
 * passes. The three handlers that accept a new password (register, reset,
 * change) all answered `validation_error` with English prose, and
 * `errorMessageFromCode` deliberately prefers the server prose for that code —
 * so a German user read "Password must be at least 12 characters" whenever the
 * client gate was measuring against a different policy than the server.
 *
 * The body therefore carries the refusal in machine form as well: `rules` (the
 * failing `PasswordRuleId`s) and `passwordPolicy` (what they were measured
 * against). A client with a locale bundle renders its own labels from those
 * and adopts the policy, so the same request cannot be refused for a rule the
 * form never showed. `error`/`errors` stay exactly as before for consumers
 * without i18n.
 */
export function passwordRefusal(password: string, config?: PasswordConfig): Response | null {
  const policy = resolvePasswordPolicy(config);
  const rules = unmetPasswordRules(password, policy);
  if (rules.length === 0) return null;
  return authError('validation_error', {
    message: passwordRuleMessage(rules[0], policy),
    extra: {
      errors: rules.map((rule) => passwordRuleMessage(rule, policy)),
      rules,
      passwordPolicy: policy
    }
  });
}

/**
 * The keys SvelteKit treats as endpoints in a `+server.ts` module: its seven
 * `HttpMethod`s, plus `fallback` — which answers every method the module does
 * not export by name, and would otherwise be the one handler this wrapper
 * walks past.
 *
 * Both live in SvelteKit's `SSREndpoint`, which it declares but does not
 * export ("Module '@sveltejs/kit' declares 'HttpMethod' locally, but it is not
 * exported"), so the set cannot be derived from the type and is restated here.
 * It is exported for exactly one reason: the cache-directive gate imports it
 * instead of keeping a second hand-written copy, so the two cannot disagree
 * about what an endpoint is. A method SvelteKit adds has to be added here —
 * nothing detects that for us.
 */
export const ENDPOINT_KEYS: readonly string[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'fallback'
];

/**
 * A value safe to walk into looking for more endpoints: an object literal, and
 * nothing else. `privateEndpoints` recurses because two factories group their
 * endpoints (`sessions.list.GET`), and a group is always a literal — while an
 * `Array`, `Date`, `Map` or class instance sharing the bundle would be walked
 * into for keys it does not have.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** A route handler, narrowed to what this wrapper needs of it. */
type EndpointHandler = (event: RequestEvent) => Response | Promise<Response>;

/**
 * Give every endpoint in a handler bundle `Cache-Control: no-store` unless the
 * response names a directive itself.
 *
 * **Being uncacheable is a property of what this package answers, not of each
 * `json()` call.** Everything here is scoped to one account — the `me` payload,
 * freshly minted tokens, session/invitation/notification/passkey lists, 2FA
 * material, WebAuthn challenges, and the per-account outcome a bare
 * `{ success: true }` reports. SvelteKit's `json()` emits nothing but
 * `content-type` and `content-length`, so a response that says nothing is
 * heuristically storable (RFC 9111 §4.2.2): a shared cache keyed by URL, seeing
 * no `Vary: Cookie`, may hand one account's answer to the next caller. Wrapping
 * the bundle puts the directive where the class lives; a call site cannot omit
 * it and does not have to spell it.
 *
 * The three endpoints that are genuinely public (`jwks`, `password-policy`,
 * `push-key`) set their own `Cache-Control` and keep it — this only ever fills
 * a gap, so a public endpoint needs no exemption list to stay public.
 *
 * The directive is set on the response the handler already built. Nothing is
 * copied into a fresh `Headers`, so no header a handler set can be dropped on
 * the way out — `Retry-After` on a 429 included — and a streaming body
 * (`text/event-stream`) is passed through untouched rather than re-wrapped.
 *
 * The bundle is mutated in place and handed back. What this promises is a
 * header on the endpoint responses and nothing else, so every other value a
 * factory puts beside its endpoints — a limiter, a `prerender` flag, a shared
 * sub-object — has to come through untouched, its identity included; only
 * object literals are walked into looking for further endpoints. The shapes
 * that rules out are pinned in `_shared.test.ts`.
 */
export function privateEndpoints<T extends object>(bundle: T): T {
  stampEndpoints(bundle as Record<string, unknown>, new WeakSet());
  return bundle;
}

/**
 * Every handler {@link privateEndpoints} has produced, so a test can ask
 * whether a given endpoint came out of it.
 *
 * Driving an endpoint only answers this where a test can reach a success path,
 * and a good third of these need a ceremony, a second factor or a live token
 * first. Until they get one they answer from `authError`, whose directive says
 * nothing about the wrapper — and that gap is where an endpoint mounted BESIDE
 * the wrapper hides. `{ ...privateEndpoints({ setup }), enable: enable() }` is
 * a natural thing to write against a wrapper that mutates in place, and it puts
 * a `200` carrying ten plaintext backup codes on the wire with no directive at
 * all. Asking about identity covers every endpoint, reachable or not, and needs
 * no fixture.
 */
const WRAPPED = new WeakSet<object>();

/**
 * Whether `handler` is an endpoint {@link privateEndpoints} wrapped.
 *
 * It answers about the *function*, not about a response: a wrapped endpoint
 * that names its own directive (`jwks`, `password-policy`, `push-key`) is
 * still wrapped — the wrapper only ever fills a gap. What reaches the wire is
 * a separate question, and a separate assertion.
 */
export function isWrappedEndpoint(handler: unknown): boolean {
  return typeof handler === 'function' && WRAPPED.has(handler);
}

/**
 * `seen` is what bounds the walk. A bundle is a value the caller owns, so it
 * may hold a reference back to itself or share one sub-object between two
 * groups; without this, the first recurses until the stack runs out and the
 * second wraps the same handler twice.
 */
function stampEndpoints(node: Record<string, unknown>, seen: WeakSet<object>): void {
  if (seen.has(node)) return;
  seen.add(node);
  for (const [key, value] of Object.entries(node)) {
    if (ENDPOINT_KEYS.includes(key) && typeof value === 'function') {
      const handler = value as EndpointHandler;
      const wrapped = async (event: RequestEvent): Promise<Response> => {
        const response = await handler(event);
        if (!response.headers.has('Cache-Control')) {
          response.headers.set('Cache-Control', 'no-store');
        }
        return response;
      };
      WRAPPED.add(wrapped);
      node[key] = wrapped;
    } else if (isPlainObject(value)) {
      stampEndpoints(value, seen);
    }
  }
}

/**
 * Resolve the authenticated user behind the request's session cookie, or
 * `null` when there is no valid session. This is the shared building block for
 * every authenticated handler (`me`, account management, sessions, 2FA): it
 * performs the exact three checks `me` established —
 *
 *   1. a session cookie is present and its JWT verifies,
 *   2. the referenced user still exists,
 *   3. the cookie's `tokenVersion` still equals the row's (server-side
 *      invalidation: a bumped version refuses an otherwise-valid access cookie).
 *
 * Returns the **full** user row (password hash + security columns) so a caller
 * that needs to re-authenticate ({@link verifyCurrentPassword}) or mutate the
 * account has it without a second read. Always run the result through
 * `sanitizeUser` before returning anything to the client.
 *
 * The parameter type is structurally minimal (`config.jwt` + `repos.user`)
 * rather than the full `AuthDeps`, so handler families with narrower deps —
 * the passkey handlers carry `authConfig` + a passkey/user repo pair — can
 * share this single resolution path instead of reading `locals.user`, whose
 * shape a consumer's `transformUser` hook may change arbitrarily.
 */
export async function requireSessionUser<R extends string>(
  // `logger` is structurally optional so hand-wired callers keep working; the
  // AuthDeps bundle always carries the resolved (shielded) one, so handler
  // calls route verify-path warnings into the configured sink.
  deps: { config: { jwt: JwtConfig }; repos: { user: UserRepository<R> }; logger?: AuthLogger },
  cookies: Cookies
): Promise<FullAuthUser<R> | null> {
  const session = await getSessionFromCookie<R>(cookies, deps.config.jwt, deps.logger);
  if (!session) return null;

  const user = await deps.repos.user.findById(session.userId);
  if (!user) return null;

  // Strict inequality, not directional: a cookie minted before a password
  // reset / "log out everywhere" (behind the row) and a forged cookie ahead of
  // the row must both be refused.
  if (user.tokenVersion !== session.tokenVersion) return null;

  return user;
}

/**
 * Re-authenticate a known user by their current password — the gate for
 * security-critical actions (change-email, delete-account, 2FA-disable). It
 * reuses the same `verifyPasswordWithMigration` path as login, so a legacy
 * bcrypt hash still verifies, but unlike login it performs **no** side effects:
 * it neither transparently rehashes nor records a failed attempt. Keeping it a
 * pure check means a caller that is about to delete the account — or set a
 * brand-new hash anyway — doesn't trigger a pointless write. Returns `true`
 * iff `password` matches `user.passwordHash`.
 *
 * Passkey-only accounts are out of scope for now: every user created through
 * this package has a password set at registration, so a password re-auth always
 * applies. Passkey-based re-auth is noted as a later iteration in the roadmap.
 */
export async function verifyCurrentPassword<R extends string>(
  user: FullAuthUser<R>,
  password: string,
  deps: AuthDeps<R>
): Promise<boolean> {
  const result = await verifyPasswordWithMigration(
    password,
    user.passwordHash,
    deps.config.password
  );
  return result.valid;
}
