import type { AuthLocale } from './keys.js';

export const en = {
  auth: {
    errors: {
      invitationRequired: 'An invitation is required to register.',
      invitationUsed: 'This invitation has already been used.',
      emailTaken: 'This email is already registered.',
      emailInvited: 'This email has already been invited.',
      invalidCredentials: 'Invalid email or password.',
      accountLocked: 'Account locked. Please try again later.',
      emailUnverified: 'Please verify your email first.',
      invalidToken: 'This link is invalid or has expired.',
      currentPasswordIncorrect: 'Current password is incorrect.',
      notAuthenticated: 'Please sign in to continue.',
      forbidden: "You don't have permission to do that.",
      invalidCode: 'Invalid code. Please try again.',
      no2faChallenge: 'No pending two-factor challenge.',
      twoFactorChallengeExpired: 'Two-factor challenge expired. Please sign in again.',
      twoFactorAlreadyEnabled: 'Two-factor authentication is already enabled.',
      twoFactorSetupRequired: 'Start two-factor setup first.',
      totpSecretUnreadable: 'Could not read the stored secret. Please try again.',
      sessionNotFound: 'Session not found.',
      missingRefreshToken: 'Your session has expired. Please sign in again.',
      invalidRefreshToken: 'Your session has expired. Please sign in again.',
      featureUnavailable: 'This feature is not available.',
      validationError: 'Please check your input and try again.',
      rateLimited: 'Too many requests. Please try again later.',
      serverError: 'Something went wrong. Please try again.',
      networkError: 'Network error. Please check your connection and try again.'
    },
    login: {
      title: 'Sign in',
      email: 'Email address',
      password: 'Password',
      rememberMe: 'Remember me',
      submit: 'Sign in',
      noAccount: "Don't have an account?",
      register: 'Create account',
      forgotPassword: 'Forgot password?',
      errors: {
        invalid: 'Invalid email or password'
      }
    },
    register: {
      title: 'Create account',
      name: 'Full name',
      email: 'Email address',
      password: 'Password',
      confirmPassword: 'Confirm password',
      submit: 'Create account',
      hasAccount: 'Already have an account?',
      login: 'Sign in',
      requirementsLabel: 'Password requirements',
      requirements: {
        minLength: 'At least {n} characters',
        uppercase: 'One uppercase letter',
        lowercase: 'One lowercase letter',
        digit: 'One digit',
        special: 'One special character'
      },
      errors: {
        passwordMismatch: 'Passwords do not match'
      }
    },
    forgotPassword: {
      title: 'Forgot password',
      description: 'Enter your email address and we will send you a link to reset your password.',
      email: 'Email address',
      submit: 'Send reset link',
      backToLogin: 'Back to sign in',
      success: 'If an account with that email exists, we sent you a reset link.'
    },
    resetPassword: {
      title: 'Reset password',
      password: 'New password',
      confirmPassword: 'Confirm new password',
      submit: 'Reset password',
      success: 'Your password has been reset. You can now sign in.',
      errors: {
        mismatch: 'Passwords do not match.',
        invalidToken: 'Invalid or expired reset link.'
      }
    },
    verifyEmail: {
      title: 'Verify email',
      verifying: 'Verifying your email...',
      success: 'Your email has been verified.',
      error: 'Invalid or expired verification link.'
    },
    emails: {
      verification: {
        subject: 'Verify your email — {appName}',
        heading: 'Welcome, {name}!',
        body: 'Please confirm your email address for {appName} to finish setting up your account.',
        cta: 'Verify email',
        ignore: "If you didn't create an account, you can safely ignore this email."
      },
      passwordReset: {
        subject: 'Reset your password — {appName}',
        heading: 'Password reset',
        body: 'We received a request to reset your password. This link expires in 1 hour.',
        cta: 'Reset password',
        ignore: "If you didn't request this, you can safely ignore this email."
      },
      invitation: {
        subject: "You've been invited to {appName}",
        heading: "You've been invited",
        body: "You've been invited to create an account on {appName}. Click below to get started.",
        cta: 'Create your account',
        ignore: "If you weren't expecting this invitation, you can safely ignore this email."
      },
      changeEmail: {
        subject: 'Confirm your new email address — {appName}',
        heading: 'Confirm your email',
        body: 'Confirm this address to use it for your {appName} account. This link expires in 1 hour.',
        cta: 'Confirm email',
        ignore: "If you didn't request this, you can safely ignore this email."
      },
      changeEmailNotice: {
        subject: 'Email change requested — {appName}',
        heading: 'Email change requested',
        body: 'A change of your account email to {email} was requested. It only takes effect once confirmed from the new address.',
        ignore:
          "If this wasn't you, please secure your account — your email has not been changed yet."
      }
    }
  },
  notifications: {
    center: {
      title: 'Notifications',
      empty: 'No notifications',
      markAllRead: 'Mark all as read',
      delete: 'Delete'
    },
    push: {
      prompt: 'Enable push notifications?',
      enable: 'Enable',
      dismiss: 'Not now',
      error: 'Enabling push notifications failed. Please try again.',
      errorConflict: 'This device is already registered to another account.',
      errorLimit: 'Device limit reached — remove a device before adding this one.',
      errorRateLimited: 'Too many attempts. Please try again later.'
    }
  },
  invitations: {
    title: 'Invitations',
    email: 'Email address',
    role: 'Role',
    pending: 'Pending',
    delete: 'Delete',
    send: 'Send',
    empty: 'No invitations yet.',
    sendEmail: 'Send invitation email',
    registered: 'Registered'
  },
  passkeys: {
    title: 'Passkeys',
    add: 'Add passkey',
    empty: 'No passkeys registered.',
    delete: 'Delete',
    lastUsed: 'Last used',
    loginWithPasskey: 'Sign in with passkey',
    or: 'or',
    loginFailed: 'Passkey sign-in failed. Please try again.',
    cancelled: 'Passkey setup was cancelled.',
    addFailed: 'Adding the passkey failed. Please try again.'
  },
  account: {
    title: 'Account settings',
    profile: {
      title: 'Profile',
      name: 'Name',
      save: 'Save',
      success: 'Profile updated.'
    },
    email: {
      title: 'Email address',
      current: 'Current email',
      newEmail: 'New email',
      currentPassword: 'Current password',
      submit: 'Change email',
      success: 'Check your new inbox to confirm the change.'
    },
    password: {
      title: 'Password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      submit: 'Change password',
      success: 'Your password has been changed.'
    },
    delete: {
      title: 'Delete account',
      description:
        'This permanently deletes your account and all associated data. This cannot be undone.',
      currentPassword: 'Current password',
      submit: 'Delete account',
      confirmTitle: 'Delete your account?',
      confirmBody: 'This permanently erases your account and cannot be undone.',
      confirm: 'Delete account',
      cancel: 'Cancel'
    }
  },
  sessions: {
    title: 'Active sessions',
    thisDevice: 'This device',
    lastActive: 'Last active',
    signOut: 'Sign out',
    signOutOthers: 'Sign out other devices',
    unknownDevice: 'Unknown device',
    empty: 'No active sessions.',
    unavailable: 'Session history requires refresh-token rotation.'
  },
  twoFactor: {
    title: 'Two-factor authentication',
    description: 'Add a second step to sign-in using an authenticator app.',
    statusEnabled: 'Two-factor authentication is on.',
    enable: 'Enable two-factor authentication',
    disable: 'Disable two-factor authentication',
    setupScan: 'Scan this QR code with your authenticator app, or enter the key manually.',
    setupSecret: 'Setup key',
    setupCode: 'Enter the 6-digit code',
    setupConfirm: 'Confirm and enable',
    cancel: 'Cancel',
    backupTitle: 'Save your backup codes',
    backupDescription:
      'Each code works once if you lose access to your authenticator. Store them somewhere safe — they will not be shown again.',
    backupDownload: 'Download codes',
    backupDone: "I've saved my codes",
    disableTitle: 'Disable two-factor authentication',
    disableDescription: 'Enter your password to turn off two-factor authentication.',
    disablePassword: 'Current password',
    disableConfirm: 'Disable',
    loginTitle: 'Two-step verification',
    loginPrompt: 'Enter the code from your authenticator app.',
    loginCode: 'Authentication code',
    loginSubmit: 'Verify',
    loginBackupHint: 'You can also enter one of your backup codes.',
    invalidCode: 'Invalid code. Please try again.'
  },
  common: {
    error: 'An error occurred',
    timeAgo: {
      now: 'Just now',
      minutes: '{n} min ago',
      hours: '{n}h ago',
      days: '{n}d ago'
    }
  }
} satisfies AuthLocale;
