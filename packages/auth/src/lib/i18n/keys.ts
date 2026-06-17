export interface AuthLocale {
  auth: {
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
