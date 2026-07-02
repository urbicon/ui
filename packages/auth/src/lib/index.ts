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
export type { AuthLocale, AuthTranslationKey } from './i18n/index.js';

// i18n — auto-registers auth translations with @urbicon-ui/i18n
export {
  at,
  authI18n,
  authT,
  getAuthLocales,
  hasAuthTranslation,
  useAuthLocale
} from './i18n/index.js';
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
