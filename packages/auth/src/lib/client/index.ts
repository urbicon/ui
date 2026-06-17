// Component prop types
export type {
  AccountSettingsProps,
  AuthPageSlotClasses,
  ForgotPasswordPageProps,
  InvitationManagerProps,
  LoginPageProps,
  NotificationBadgeProps,
  NotificationCenterProps,
  NotificationListenerProps,
  PasskeyManagerProps,
  PushPermissionPromptProps,
  RegisterPageProps,
  ResetPasswordPageProps,
  RoleOption,
  SessionManagerProps,
  TwoFactorManagerProps,
  VerifyEmailPageProps
} from './components/index.js';
// Components (with JSDoc metadata + blocks-based UI)
export {
  AccountSettings,
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
  SessionManager,
  TwoFactorManager,
  VerifyEmailPage
} from './components/index.js';
export type { CsrfClientOptions } from './csrf.js';
// CSRF helpers for the Double-Submit-Cookie pattern (server-side opt-in
// via `config.csrf.doubleSubmit`).
export { csrfFetch, readCsrfToken, withCsrfHeader } from './csrf.js';
export type { AuthStoreConfig } from './stores/auth.svelte.js';
export { createAuthStore } from './stores/auth.svelte.js';
export type { NotificationStoreConfig } from './stores/notifications.svelte.js';
export { createNotificationStore } from './stores/notifications.svelte.js';
export {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush
} from './utils/service-worker.js';
