export type {
  AccountSettingsProps,
  AuthPageSlotClasses,
  AuthStoreConfig,
  CsrfClientOptions,
  ForgotPasswordPageProps,
  InvitationManagerProps,
  LoginPageProps,
  NotificationBadgeProps,
  NotificationCenterProps,
  NotificationListenerProps,
  NotificationStoreConfig,
  PasskeyManagerProps,
  PushPermissionPromptProps,
  PushSubscribeResult,
  RegisterPageProps,
  ResetPasswordPageProps,
  RoleOption,
  SessionManagerProps,
  TwoFactorManagerProps,
  VerifyEmailPageProps
} from './client/index.js';

// Client-side exports
export {
  AccountSettings,
  createAuthStore,
  createNotificationStore,
  csrfFetch,
  errorMessageFromCode,
  ForgotPasswordPage,
  InvitationManager,
  LoginPage,
  NotificationBadge,
  NotificationCenter,
  NotificationListener,
  PasskeyManager,
  PushPermissionPrompt,
  RegisterPage,
  ResetPasswordPage,
  readCsrfToken,
  registerServiceWorker,
  SessionManager,
  subscribeToPush,
  TwoFactorManager,
  unsubscribeFromPush,
  VerifyEmailPage,
  withCsrfHeader
} from './client/index.js';
export type { AuthLocale, PartialAuthLocale } from './i18n/index.js';
// i18n — bundle-based: read the active bundle with useAuthLocale, merge
// consumer overrides with mergeAuthLocale (see docs/AUTH.md)
export { mergeAuthLocale, useAuthLocale } from './i18n/index.js';
// Open-redirect guard for the handle hook's ?redirectTo=… deep-link param
export { sanitizeRedirect } from './redirect.js';
export type {
  AuthConfig,
  AuthLogger,
  AuthSession,
  AuthUser,
  CsrfConfig,
  EmailConfig,
  JwtConfig,
  LockoutConfig,
  PasswordConfig,
  RateLimitConfig
} from './types.js';
