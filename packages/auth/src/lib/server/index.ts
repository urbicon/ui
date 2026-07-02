// Auth core

// Types re-export
export type {
  AuthConfig,
  AuthSession,
  AuthUser,
  CsrfConfig,
  EmailConfig,
  JwtConfig,
  LockoutConfig,
  PasswordConfig,
  RateLimitConfig,
  RefreshTokenConfig,
  TwoFactorConfig
} from '../types.js';
// Full in-memory adapter — dev/test fixture and five-minute quickstart. Never
// production (heap-only, single-process). See `./adapters/in-memory` for the
// per-repository factories.
export { createInMemoryBackupCodeRepository, createInMemoryRepos } from './adapters/in-memory.js';
export { createInMemoryRefreshTokenRepository } from './adapters/in-memory-refresh-token.js';
// Adapter types
export type {
  BackupCodeRepository,
  CreateInvitationData,
  CreateNotificationData,
  CreatePasskeyData,
  CreateRefreshTokenData,
  CreateUserData,
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
  RefreshTokenRecord,
  RefreshTokenRepository,
  Repositories,
  UserRepository
} from './adapters/types.js';
export type { PasswordVerifyResult } from './auth.js';
export {
  createSessionToken,
  createSignedToken,
  generateSecureToken,
  hashPassword,
  hashToken,
  sanitizeUser,
  validatePasswordStrength,
  verifyPassword,
  verifyPasswordWithMigration,
  verifySessionToken,
  verifySignedToken
} from './auth.js';
// CSRF
export { validateCsrf } from './csrf.js';
export type { AuthDeps } from './deps.js';
// Deps
export { createAuthDeps } from './deps.js';
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
export type { AuthHandleOptions } from './handle.js';
// Handle hook
export { createAuthHandle } from './handle.js';
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
// Handlers
export { createLoginHandler } from './handlers/login.js';
export { createLogoutHandler } from './handlers/logout.js';
export { createMeHandler } from './handlers/me.js';
export { createRefreshHandler } from './handlers/refresh.js';
export type { RegisterHandlerOptions } from './handlers/register.js';
export { createRegisterHandler } from './handlers/register.js';
export { createResetPasswordHandler } from './handlers/reset-password.js';
export type { SessionSummary } from './handlers/sessions.js';
// Session listing (requires config.refreshToken; see docs/AUTH.md → Sessions)
export {
  createListSessionsHandler,
  createRevokeOtherSessionsHandler,
  createRevokeSessionHandler
} from './handlers/sessions.js';
// Two-factor auth (TOTP; requires config.twoFactor + repos.backupCode; see
// docs/AUTH.md → Two-Factor). setup/enable/disable are authenticated; verify is
// the unauthenticated second login step (reads the pending-2FA cookie). The
// login handler gates on `totpEnabled` automatically.
export {
  createTwoFactorDisableHandler,
  createTwoFactorEnableHandler,
  createTwoFactorSetupHandler,
  createTwoFactorVerifyHandler
} from './handlers/two-factor.js';
export { createUpdateProfileHandler } from './handlers/update-profile.js';
export { createVerifyEmailHandler } from './handlers/verify-email.js';
export { createVerifyEmailChangeHandler } from './handlers/verify-email-change.js';
export { createNotificationsHandlers } from './notifications/handlers/notifications.js';
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
export type { SSEConnection, SSEManager } from './notifications/sse.js';
export { createSSEManager } from './notifications/sse.js';
export type { NotificationTypeDefinition } from './notifications/types.js';
export type { PasskeyHandlerDeps } from './passkey/handlers.js';
// Passkey / WebAuthn
export {
  createPasskeyAuthenticationOptionsHandler,
  createPasskeyAuthenticationVerifyHandler,
  createPasskeyDeleteHandler,
  createPasskeyListHandler,
  createPasskeyRegistrationOptionsHandler,
  createPasskeyRegistrationVerifyHandler
} from './passkey/handlers.js';
export type {
  VerifiedAssertion,
  VerifiedRegistration,
  WebAuthnConfig
} from './passkey/webauthn.js';
export {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAssertion,
  verifyRegistration,
  WebAuthnError
} from './passkey/webauthn.js';
export type { RateLimiter, RateLimitResult, RateLimitStore } from './rate-limit.js';
// Rate limiting
export { checkRateLimit, createRateLimiter } from './rate-limit.js';
export type { RotateOutcome, SessionMeta } from './refresh-token.js';
// Refresh-token rotation (opt-in via `config.refreshToken`)
export {
  clearRefreshCookie,
  issueRefreshToken,
  parseDurationSeconds,
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
  clearSessionCookie,
  endSession,
  establishSession,
  getSessionFromCookie,
  resolveSessionMeta,
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
