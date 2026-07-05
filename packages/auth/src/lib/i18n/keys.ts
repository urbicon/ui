/**
 * The complete auth locale bundle. Every key is required: the bundles this
 * package ships (`en`, `de`) satisfy the full shape, and consumer overrides
 * enter as {@link PartialAuthLocale} — deep-merged over the active built-in
 * bundle by `mergeAuthLocale` — so component markup reads keys directly,
 * without per-key `?? '…'` fallback literals (review R19).
 *
 * Placeholder convention: dynamic values use **single-brace** tokens
 * (`{n}`, `{name}`, `{email}`) that the consuming component substitutes itself
 * via `String.replace('{token}', value)`. There is deliberately **no**
 * `{{…}}` runtime interpolator in this package — the key-based translator twin
 * (`authT`/`at`) was removed in R21 — so `{{…}}` here would render verbatim.
 */
export interface AuthLocale {
  auth: {
    /**
     * Localized copy for the machine `AuthErrorCode` values the server handlers
     * return alongside the English `error` prose. The client `errorMessageFromCode`
     * maps a code here; an unknown/missing code falls back to the server prose.
     * Keys mirror the `AuthErrorCode` union exactly — plus `networkError` for the
     * client-synthesized `network_error` (a request that never reached the server).
     */
    errors: {
      invitationRequired: string;
      invitationUsed: string;
      emailTaken: string;
      emailInvited: string;
      invalidCredentials: string;
      accountLocked: string;
      emailUnverified: string;
      invalidToken: string;
      currentPasswordIncorrect: string;
      notAuthenticated: string;
      forbidden: string;
      invalidCode: string;
      no2faChallenge: string;
      twoFactorChallengeExpired: string;
      twoFactorAlreadyEnabled: string;
      twoFactorSetupRequired: string;
      totpSecretUnreadable: string;
      sessionNotFound: string;
      missingRefreshToken: string;
      invalidRefreshToken: string;
      featureUnavailable: string;
      validationError: string;
      /** 429 — request/connection limits. */
      rateLimited: string;
      serverError: string;
      /** Client-side only: the request never reached the server (offline, DNS, CORS). */
      networkError: string;
    };
    login: {
      title: string;
      email: string;
      password: string;
      rememberMe: string;
      submit: string;
      noAccount: string;
      register: string;
      forgotPassword: string;
      errors: {
        /** Generic credentials failure — the fallback when a login error carries no known code. */
        invalid: string;
      };
    };
    register: {
      title: string;
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      submit: string;
      hasAccount: string;
      login: string;
      /** aria-label of the live requirements checklist. */
      requirementsLabel: string;
      requirements: {
        /** `{n}` is replaced with the page's `passwordMinLength` prop. */
        minLength: string;
        uppercase: string;
        lowercase: string;
        digit: string;
        special: string;
      };
      errors: {
        passwordMismatch: string;
      };
    };
    forgotPassword: {
      title: string;
      description: string;
      email: string;
      submit: string;
      backToLogin: string;
      success: string;
    };
    resetPassword: {
      title: string;
      password: string;
      confirmPassword: string;
      submit: string;
      success: string;
      errors: {
        mismatch: string;
        invalidToken: string;
      };
    };
    verifyEmail: {
      title: string;
      verifying: string;
      success: string;
      error: string;
    };
    /**
     * Copy for the default transactional emails the server sends (verification,
     * password-reset, email-change, invitation). Localized via `config.email.locale`;
     * a per-mail builder hook (`verificationEmail`, `resetEmail`, …) replaces these.
     * Placeholders: `{name}`, `{appName}`, `{email}` — substituted by the builder.
     */
    emails: {
      verification: {
        subject: string;
        heading: string;
        body: string;
        cta: string;
        ignore: string;
      };
      passwordReset: {
        subject: string;
        heading: string;
        body: string;
        cta: string;
        ignore: string;
      };
      invitation: {
        subject: string;
        heading: string;
        body: string;
        cta: string;
        ignore: string;
      };
      changeEmail: {
        subject: string;
        heading: string;
        body: string;
        cta: string;
        ignore: string;
      };
      /** Awareness notice sent to the OLD address when an email change is requested. */
      changeEmailNotice: {
        subject: string;
        heading: string;
        body: string;
        ignore: string;
      };
    };
  };
  notifications: {
    center: {
      title: string;
      empty: string;
      markAllRead: string;
      delete: string;
    };
    push: {
      prompt: string;
      enable: string;
      dismiss: string;
      /** Shown (aria-live) when subscribing fails — the prompt stays open for a retry. */
      error: string;
      /** 409 push_endpoint_conflict — this device is registered to another account; retrying cannot succeed. */
      errorConflict: string;
      /** 409 push_subscription_limit — per-user device cap reached; remove a device first. */
      errorLimit: string;
      /** 429 — too many attempts right now. */
      errorRateLimited: string;
    };
  };
  invitations: {
    title: string;
    email: string;
    role: string;
    pending: string;
    delete: string;
    send: string;
    empty: string;
    sendEmail: string;
    registered: string;
  };
  passkeys: {
    title: string;
    add: string;
    empty: string;
    delete: string;
    lastUsed: string;
    loginWithPasskey: string;
    or: string;
    /** Passkey sign-in failed client-side (browser error other than a user cancel). */
    loginFailed: string;
    /**
     * The browser's passkey dialog (setup or sign-in) ended without a
     * credential — user cancel, timeout, or an iframe policy denial
     * (indistinguishable by design: NotAllowedError).
     */
    cancelled: string;
    /** Registering a new passkey failed client-side. */
    addFailed: string;
  };
  account: {
    title: string;
    profile: {
      title: string;
      name: string;
      save: string;
      success: string;
    };
    email: {
      title: string;
      current: string;
      newEmail: string;
      currentPassword: string;
      submit: string;
      success: string;
    };
    password: {
      title: string;
      currentPassword: string;
      newPassword: string;
      submit: string;
      success: string;
    };
    delete: {
      title: string;
      description: string;
      currentPassword: string;
      submit: string;
      confirmTitle: string;
      confirmBody: string;
      confirm: string;
      cancel: string;
    };
  };
  sessions: {
    title: string;
    thisDevice: string;
    lastActive: string;
    signOut: string;
    signOutOthers: string;
    unknownDevice: string;
    empty: string;
    unavailable: string;
  };
  twoFactor: {
    // Manager — status
    title: string;
    description: string;
    statusEnabled: string;
    enable: string;
    disable: string;
    // Setup
    setupScan: string;
    setupSecret: string;
    setupCode: string;
    setupConfirm: string;
    cancel: string;
    // Backup codes
    backupTitle: string;
    backupDescription: string;
    backupDownload: string;
    backupDone: string;
    // Disable
    disableTitle: string;
    disableDescription: string;
    disablePassword: string;
    disableConfirm: string;
    // Login step
    loginTitle: string;
    loginPrompt: string;
    loginCode: string;
    loginSubmit: string;
    loginBackupHint: string;
    // Feedback
    invalidCode: string;
  };
  common: {
    error: string;
    timeAgo: {
      now: string;
      minutes: string;
      hours: string;
      days: string;
    };
  };
}

/** Recursive partial: every branch and leaf becomes optional. */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/**
 * Consumer-facing locale input: any subset of {@link AuthLocale}. Components
 * accept this as their `t` prop and deep-merge it over the active built-in
 * bundle, so overriding a single string never silently blanks the rest.
 */
export type PartialAuthLocale = DeepPartial<AuthLocale>;
