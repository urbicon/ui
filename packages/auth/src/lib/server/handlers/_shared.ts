import type { Cookies } from '@sveltejs/kit';
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
  validate: (raw: unknown) => ValidationResult<T>,
  options?: { headers?: HeadersInit }
): Promise<{ data: T } | Response> {
  const input = validate(await readJsonBody(request));
  if (!input.success) {
    return authError('validation_error', {
      message: input.errors[0].message,
      extra: { errors: input.errors },
      ...(options?.headers && { headers: options.headers })
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
 * `Cache-Control` for responses that carry session state or PII (the `me`
 * payload, freshly minted tokens, session/invitation lists, 2FA material) —
 * they must never park in a shared cache. One constant instead of the four
 * per-file copies counted.
 */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

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
