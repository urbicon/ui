// Auth core

// The password policy: one definition of the rules, shared by the server check
// (`validatePasswordStrength`), `createPasswordPolicyHandler` and the client
// checklist.
export type { PasswordPolicy, PasswordRuleId } from '../password-policy.js';
export {
  activePasswordRules,
  DEFAULT_PASSWORD_POLICY,
  isPasswordRuleMet,
  PASSWORD_RULES,
  resolvePasswordPolicy,
  unmetPasswordRules
} from '../password-policy.js';
// Open-redirect guard for the handle hook's ?redirectTo=… deep-link param
// (also exported from the package root for client-side use)
export { sanitizeRedirect } from '../redirect.js';
// Types re-export
export type {
  AuthConfig,
  AuthLogger,
  AuthSession,
  AuthUser,
  CsrfConfig,
  EmailConfig,
  Es256PrivateJwk,
  Es256PublicJwk,
  JwtConfig,
  LockoutConfig,
  PasswordConfig,
  RateLimitConfig,
  RefreshTokenConfig,
  TokenTtlConfig,
  TwoFactorConfig
} from '../types.js';
// Full in-memory adapter — dev/test fixture and five-minute quickstart. Never
// production (heap-only, single-process). Every single-repository factory takes
// the store handle from `createInMemoryStore()`; see `./adapters/in-memory` for
// the rest of them.
export {
  createInMemoryBackupCodeRepository,
  createInMemoryFederatedAccountRepository,
  createInMemoryRefreshTokenRepository,
  createInMemoryRepos,
  createInMemoryStore,
  type InMemoryStore
} from './adapters/in-memory.js';
// Adapter types
export type {
  BackupCodeRepository,
  CreateInvitationData,
  CreateNotificationData,
  CreatePasskeyData,
  CreateRefreshTokenData,
  CreateUserData,
  FailedLoginLock,
  FederatedAccount,
  FederatedAccountRepository,
  FullAuthUser,
  Invitation,
  InvitationRepository,
  NotificationPreference,
  NotificationPreferenceRepository,
  NotificationRecord,
  NotificationRepository,
  Passkey,
  PasskeyRepository,
  PreferenceData,
  PushSubscriptionData,
  PushSubscriptionRepository,
  PushSubscriptionWriteOutcome,
  RefreshTokenRecord,
  RefreshTokenRepository,
  Repositories,
  UserRepository
} from './adapters/types.js';
export { generateSecureToken, hashToken, sanitizeUser } from './auth.js';
// CSRF — validateCsrf gates mutating requests (used by the handle hook);
// ensureCsrfCookie seeds the double-submit cookie and returns the token for
// SSR scenarios that inline it into a form.
export type { CsrfValidateOptions, EnsureCsrfCookieOptions } from './csrf.js';
export { ensureCsrfCookie, validateCsrf } from './csrf.js';
export type { AuthDeps } from './deps.js';
// Deps
export { createAuthDeps } from './deps.js';
// Refresh-token rotation (opt-in via `config.refreshToken`)
export { parseDurationSeconds } from './duration.js';
// Per-mail builder hook types + the rendered-mail shape (default builders +
// consumer hooks return this). See the `*Email` options on the handlers below.
export type {
  ChangeEmailNoticeContext,
  MailBuilder,
  MailBuilderContext
} from './email/builders.js';
export type { BuiltEmail } from './email/templates.js';
// Email transport types
export type { EmailTransport, SendEmailParams } from './email/types.js';
// Federated identity (SSO) — consumer side: verifies the IdP's ES256 session
// JWT against its JWKS (served by createJWKSHandler on the IdP) and maps the
// proven identity to a local user via resolveUser. Identity ≠ authorization:
// resolveUser is where THIS app decides access; the IdP's role never arrives.
export type { FederatedAuthHandleOptions, FederatedIdentity } from './federated-handle.js';
export { createFederatedAuthHandle } from './federated-handle.js';
export type { AuthHandleOptions, PublicRoute } from './handle.js';
// Handle hook. DEFAULT_PUBLIC_ROUTES is the guard's default exemption list —
// `publicRoutes` replaces it, so extending means spreading this.
export { createAuthHandle, DEFAULT_PUBLIC_ROUTES } from './handle.js';
export type { ChangeEmailHandlerOptions } from './handlers/change-email.js';
export { createChangeEmailHandler } from './handlers/change-email.js';
// Account management (authenticated; see docs/AUTH.md → Account Management)
export { createChangePasswordHandler } from './handlers/change-password.js';
export { createDeleteAccountHandler } from './handlers/delete-account.js';
// Machine error codes returned alongside the English `error` prose, for
// localized clients (see `errorMessageFromCode` in the client utils).
export type { AuthErrorCode } from './handlers/errors.js';
export { AUTH_ERROR_CODES } from './handlers/errors.js';
export type { ForgotPasswordHandlerOptions } from './handlers/forgot-password.js';
export { createForgotPasswordHandler } from './handlers/forgot-password.js';
export type { InvitationHandlerOptions } from './handlers/invitation.js';
export { createInvitationHandlers } from './handlers/invitation.js';
// JWKS endpoint (RFC 7517) — publishes the ES256 public key set so consuming
// services can verify this IdP's session JWTs (requires jwt.algorithm 'ES256')
export { createJWKSHandler } from './handlers/jwks.js';
// Handlers
export { createLoginHandler } from './handlers/login.js';
export { createLogoutHandler } from './handlers/logout.js';
export { createMeHandler } from './handlers/me.js';
// Publishes `config.password` as the five-field policy the client forms gate
// against, so the rule is not restated in component props (see docs/AUTH.md →
// Password policy).
export { createPasswordPolicyHandler } from './handlers/password-policy.js';
export { createRefreshHandler } from './handlers/refresh.js';
export type { RegisterHandlerOptions } from './handlers/register.js';
export { createRegisterHandler } from './handlers/register.js';
export { createResetPasswordHandler } from './handlers/reset-password.js';
export type { SessionSummary } from './handlers/sessions.js';
// Session management route group (requires config.refreshToken; see
// docs/AUTH.md → Sessions)
export { createSessionsHandlers } from './handlers/sessions.js';
// Two-factor auth route group (TOTP; requires config.twoFactor +
// repos.backupCode; see docs/AUTH.md → Two-Factor). setup/enable/disable are
// authenticated; verify is the unauthenticated second login step (reads the
// pending-2FA cookie). The login handler gates on `totpEnabled` automatically.
export { createTwoFactorHandlers } from './handlers/two-factor.js';
export { createUpdateProfileHandler } from './handlers/update-profile.js';
export { createVerifyEmailHandler } from './handlers/verify-email.js';
export { createVerifyEmailChangeHandler } from './handlers/verify-email-change.js';
// Session JWT (HS256 default / ES256 opt-in) + generic short-lived signed
// tokens (always HMAC) on Web Crypto. generateES256KeyPair mints the JWK pair
// for jwt.algorithm 'ES256'; computeJwkThumbprint derives the RFC 7638 kid of
// an existing key (e.g. for a hand-built previousPublicKeys entry). Every
// token is purpose-bound: session tokens carry purpose SESSION_TOKEN_PURPOSE
// ('session'); createSignedToken/verifySignedToken take an explicit purpose.
// All verifiers cap their input at MAX_TOKEN_LENGTH before parsing.
export {
  computeJwkThumbprint,
  createSessionToken,
  createSignedToken,
  generateES256KeyPair,
  MAX_TOKEN_LENGTH,
  SESSION_TOKEN_PURPOSE,
  verifySessionToken,
  verifySignedToken
} from './jwt.js';
export { createNotificationsHandlers } from './notifications/handlers/notifications.js';
export type { PreferencesHandlerOptions } from './notifications/handlers/preferences.js';
export { createPreferencesHandler } from './notifications/handlers/preferences.js';
export { createPushKeyHandler } from './notifications/handlers/push-key.js';
export type { PushSubscriptionHandlerOptions } from './notifications/handlers/push-subscription.js';
export { createPushSubscriptionHandler } from './notifications/handlers/push-subscription.js';
export type { StreamHandlerOptions } from './notifications/handlers/stream.js';
export { createStreamHandler } from './notifications/handlers/stream.js';
export type {
  OwnedPushSubscription,
  PushPayload,
  PushRateLimitConfig,
  PushResult,
  PushService,
  PushServiceOptions,
  VapidConfig,
  VapidKeys
} from './notifications/push.js';
export { createPushService, generateVapidKeys } from './notifications/push.js';
export { isAllowedPushEndpoint, isPublicHttpsEndpoint } from './notifications/push-endpoint.js';
export type { NotificationRegistry } from './notifications/registry.js';
// Notifications & Web Push
// Server-side stack powering <NotificationListener>/<NotificationCenter>: the
// event registry, the dispatch service, the SSE connection manager, the Web
// Push service (RFC 8291/8292) and the route handlers a consumer mounts under
// its auth API — SSE stream, preferences, push key, push subscription, and
// the notification CRUD group (`createNotificationsHandlers`) that serves
// `createNotificationStore`. See docs/AUTH.md → "Notifications & Web Push".
export { createNotificationRegistry } from './notifications/registry.js';
export type { NotificationService, NotificationServiceDeps } from './notifications/service.js';
export { createNotificationService } from './notifications/service.js';
export type { SSEManager } from './notifications/sse.js';
export { createSSEManager } from './notifications/sse.js';
export type { NotificationTypeDefinition } from './notifications/types.js';
// Challenge storage for the WebAuthn ceremonies — the types a consumer needs
// to supply a persistent `WebAuthnConfig.challengeStore` (Redis/Prisma/…).
export type { ChallengeEntry, ChallengeStore } from './passkey/challenge-store.js';
export { createInMemoryChallengeStore } from './passkey/challenge-store.js';
export { WebAuthnError } from './passkey/errors.js';
// Passkey / WebAuthn route group (requires repos.passkey; the WebAuthn
// ceremony config rides as the factory's second argument)
export { createPasskeyHandlers } from './passkey/handlers.js';
export type {
  VerifiedAssertion,
  VerifiedRegistration,
  WebAuthnConfig
} from './passkey/webauthn.js';
export {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAssertion,
  verifyRegistration
} from './passkey/webauthn.js';
// Password hashing (PBKDF2 + legacy bcrypt migration) + the server-side
// strength check (the rules themselves: `password-policy.ts`, exported above)
export type { PasswordVerifyResult } from './password.js';
export {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
  verifyPasswordWithMigration
} from './password.js';
export type { RateLimiter, RateLimitResult, RateLimitStore } from './rate-limit.js';
// Rate limiting
export { createRateLimiter } from './rate-limit.js';
export type { RotateOutcome, SessionMeta } from './refresh-token.js';
export {
  clearRefreshCookie,
  issueRefreshToken,
  readRefreshCookie,
  refreshCookieName,
  resolveJwtConfig,
  revokeRefreshFromCookie,
  rotateRefreshToken,
  setRefreshCookie
} from './refresh-token.js';
export type { SecurityHeadersConfig } from './security-headers.js';
// Security headers
export { applySecurityHeaders } from './security-headers.js';
// Session
export {
  applyRotationOutcome,
  clearSessionCookie,
  endSession,
  establishSession,
  getSessionFromCookie,
  resolveSessionMeta,
  sessionPayload,
  setSessionCookie
} from './session.js';
export type { TotpAlgorithm } from './totp.js';
// TOTP primitives + 2FA plumbing for consumers building custom flows.
export {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  verifyTotp
} from './totp.js';
