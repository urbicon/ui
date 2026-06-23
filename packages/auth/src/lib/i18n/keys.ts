export interface AuthLocale {
  auth: {
    /**
     * Localized copy for the machine `AuthErrorCode` values the server handlers
     * return alongside the English `error` prose. The client `errorMessageFromCode`
     * maps a code here; an unknown/missing code falls back to the server prose.
     * Keys mirror the `AuthErrorCode` union exactly.
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
      serverError: string;
    };
    login: {
      title: string;
      email: string;
      password: string;
      rememberMe?: string;
      submit: string;
      noAccount: string;
      register: string;
      forgotPassword: string;
      errors: {
        invalid: string;
        locked: string;
        unverified: string;
      };
    };
    register: {
      title: string;
      name: string;
      email: string;
      password: string;
      confirmPassword?: string;
      submit: string;
      hasAccount: string;
      login: string;
      requirements?: {
        minLength: string;
        uppercase: string;
        lowercase: string;
        digit: string;
        special?: string;
      };
      strength?: {
        weak: string;
        fair: string;
        good: string;
        strong: string;
      };
      errors: {
        invitationRequired: string;
        emailTaken: string;
        passwordMismatch?: string;
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
        expired: string;
      };
    };
    verifyEmail: {
      title: string;
      verifying?: string;
      success: string;
      error: string;
      resend: string;
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
      delete?: string;
    };
    push: {
      prompt: string;
      enable: string;
      dismiss: string;
    };
  };
  invitations: {
    title: string;
    invite: string;
    email: string;
    role: string;
    status: string;
    pending: string;
    used: string;
    delete: string;
    send: string;
    empty?: string;
    sendEmail?: string;
    registered?: string;
  };
  passkeys?: {
    title: string;
    add: string;
    empty: string;
    delete: string;
    lastUsed: string;
    loginWithPasskey: string;
    or: string;
  };
  account?: {
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
  sessions?: {
    title: string;
    thisDevice: string;
    lastActive: string;
    signOut: string;
    signOutOthers: string;
    unknownDevice: string;
    empty: string;
    unavailable: string;
  };
  twoFactor?: {
    // Manager — status
    title: string;
    description: string;
    statusEnabled: string;
    statusDisabled: string;
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
    enabledSuccess: string;
    disabledSuccess: string;
  };
  common?: {
    loading?: string;
    error?: string;
    timeAgo?: {
      now: string;
      minutes: string;
      hours: string;
      days: string;
    };
  };
}
