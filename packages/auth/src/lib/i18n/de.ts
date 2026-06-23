import type { AuthLocale } from './keys.js';

export const de = {
  auth: {
    errors: {
      invitationRequired: 'Eine Einladung ist erforderlich.',
      invitationUsed: 'Diese Einladung wurde bereits verwendet.',
      emailTaken: 'Diese E-Mail-Adresse ist bereits registriert.',
      emailInvited: 'Diese E-Mail-Adresse wurde bereits eingeladen.',
      invalidCredentials: 'Ungültige E-Mail oder Passwort.',
      accountLocked: 'Konto gesperrt. Bitte versuche es später erneut.',
      emailUnverified: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
      invalidToken: 'Dieser Link ist ungültig oder abgelaufen.',
      currentPasswordIncorrect: 'Das aktuelle Passwort ist falsch.',
      notAuthenticated: 'Bitte melde dich an, um fortzufahren.',
      forbidden: 'Dazu hast du keine Berechtigung.',
      invalidCode: 'Ungültiger Code. Bitte versuche es erneut.',
      no2faChallenge: 'Keine ausstehende Zwei-Faktor-Anfrage.',
      twoFactorChallengeExpired:
        'Die Zwei-Faktor-Anfrage ist abgelaufen. Bitte melde dich erneut an.',
      twoFactorAlreadyEnabled: 'Die Zwei-Faktor-Authentifizierung ist bereits aktiviert.',
      twoFactorSetupRequired: 'Starte zuerst die Einrichtung der Zwei-Faktor-Authentifizierung.',
      totpSecretUnreadable:
        'Der gespeicherte Schlüssel konnte nicht gelesen werden. Bitte erneut versuchen.',
      sessionNotFound: 'Sitzung nicht gefunden.',
      missingRefreshToken: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
      invalidRefreshToken: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
      featureUnavailable: 'Diese Funktion ist nicht verfügbar.',
      validationError: 'Bitte überprüfe deine Eingabe und versuche es erneut.',
      serverError: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
    },
    login: {
      title: 'Anmelden',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      rememberMe: 'Angemeldet bleiben',
      submit: 'Anmelden',
      noAccount: 'Noch kein Konto?',
      register: 'Konto erstellen',
      forgotPassword: 'Passwort vergessen?',
      errors: {
        invalid: 'Ungültige E-Mail oder Passwort',
        locked: 'Konto gesperrt. Bitte versuche es später erneut.',
        unverified: 'Bitte bestätige zuerst deine E-Mail-Adresse.'
      }
    },
    register: {
      title: 'Konto erstellen',
      name: 'Vollständiger Name',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      confirmPassword: 'Passwort bestätigen',
      submit: 'Konto erstellen',
      hasAccount: 'Bereits ein Konto?',
      login: 'Anmelden',
      requirements: {
        minLength: 'Mindestens 8 Zeichen',
        uppercase: 'Ein Großbuchstabe',
        lowercase: 'Ein Kleinbuchstabe',
        digit: 'Eine Ziffer',
        special: 'Ein Sonderzeichen'
      },
      strength: {
        weak: 'Schwach',
        fair: 'Mittel',
        good: 'Gut',
        strong: 'Stark'
      },
      errors: {
        invitationRequired: 'Eine Einladung ist erforderlich.',
        emailTaken: 'Diese E-Mail-Adresse ist bereits registriert.',
        passwordMismatch: 'Die Passwörter stimmen nicht überein'
      }
    },
    forgotPassword: {
      title: 'Passwort vergessen',
      description:
        'Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.',
      email: 'E-Mail-Adresse',
      submit: 'Link senden',
      backToLogin: 'Zurück zur Anmeldung',
      success: 'Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link gesendet.'
    },
    resetPassword: {
      title: 'Passwort zurücksetzen',
      password: 'Neues Passwort',
      confirmPassword: 'Neues Passwort bestätigen',
      submit: 'Passwort zurücksetzen',
      success: 'Dein Passwort wurde zurückgesetzt. Du kannst dich jetzt anmelden.',
      errors: {
        mismatch: 'Die Passwörter stimmen nicht überein.',
        invalidToken: 'Ungültiger oder abgelaufener Link.',
        expired: 'Dieser Link ist abgelaufen.'
      }
    },
    verifyEmail: {
      title: 'E-Mail bestätigen',
      verifying: 'E-Mail wird verifiziert...',
      success: 'Deine E-Mail-Adresse wurde bestätigt.',
      error: 'Ungültiger oder abgelaufener Bestätigungslink.',
      resend: 'Bestätigungsmail erneut senden'
    }
  },
  notifications: {
    center: {
      title: 'Benachrichtigungen',
      empty: 'Keine Benachrichtigungen',
      markAllRead: 'Alle als gelesen markieren',
      delete: 'Löschen'
    },
    push: {
      prompt: 'Push-Benachrichtigungen aktivieren?',
      enable: 'Aktivieren',
      dismiss: 'Nicht jetzt'
    }
  },
  invitations: {
    title: 'Einladungen',
    invite: 'Einladung senden',
    email: 'E-Mail-Adresse',
    role: 'Rolle',
    status: 'Status',
    pending: 'Ausstehend',
    used: 'Verwendet',
    delete: 'Löschen',
    send: 'Senden',
    empty: 'Noch keine Einladungen.',
    sendEmail: 'Einladungs-E-Mail senden',
    registered: 'Registriert'
  },
  passkeys: {
    title: 'Passkeys',
    add: 'Passkey hinzufügen',
    empty: 'Keine Passkeys registriert.',
    delete: 'Löschen',
    lastUsed: 'Zuletzt verwendet',
    loginWithPasskey: 'Mit Passkey anmelden',
    or: 'oder'
  },
  account: {
    title: 'Kontoeinstellungen',
    profile: {
      title: 'Profil',
      name: 'Name',
      save: 'Speichern',
      success: 'Profil aktualisiert.'
    },
    email: {
      title: 'E-Mail-Adresse',
      current: 'Aktuelle E-Mail',
      newEmail: 'Neue E-Mail',
      currentPassword: 'Aktuelles Passwort',
      submit: 'E-Mail ändern',
      success: 'Bitte bestätige die Änderung über den Link in deinem neuen Postfach.'
    },
    password: {
      title: 'Passwort',
      currentPassword: 'Aktuelles Passwort',
      newPassword: 'Neues Passwort',
      submit: 'Passwort ändern',
      success: 'Dein Passwort wurde geändert.'
    },
    delete: {
      title: 'Konto löschen',
      description:
        'Dies löscht dein Konto und alle zugehörigen Daten unwiderruflich. Dies kann nicht rückgängig gemacht werden.',
      currentPassword: 'Aktuelles Passwort',
      submit: 'Konto löschen',
      confirmTitle: 'Konto wirklich löschen?',
      confirmBody:
        'Dies löscht dein Konto unwiderruflich und kann nicht rückgängig gemacht werden.',
      confirm: 'Konto löschen',
      cancel: 'Abbrechen'
    }
  },
  sessions: {
    title: 'Aktive Sitzungen',
    thisDevice: 'Dieses Gerät',
    lastActive: 'Zuletzt aktiv',
    signOut: 'Abmelden',
    signOutOthers: 'Andere Geräte abmelden',
    unknownDevice: 'Unbekanntes Gerät',
    empty: 'Keine aktiven Sitzungen.',
    unavailable: 'Die Sitzungsübersicht erfordert Refresh-Token-Rotation.'
  },
  twoFactor: {
    title: 'Zwei-Faktor-Authentifizierung',
    description: 'Sichere die Anmeldung mit einem zweiten Schritt über eine Authenticator-App.',
    statusEnabled: 'Die Zwei-Faktor-Authentifizierung ist aktiv.',
    statusDisabled: 'Die Zwei-Faktor-Authentifizierung ist inaktiv.',
    enable: 'Zwei-Faktor-Authentifizierung aktivieren',
    disable: 'Zwei-Faktor-Authentifizierung deaktivieren',
    setupScan:
      'Scanne diesen QR-Code mit deiner Authenticator-App oder gib den Schlüssel manuell ein.',
    setupSecret: 'Einrichtungsschlüssel',
    setupCode: 'Gib den 6-stelligen Code ein',
    setupConfirm: 'Bestätigen und aktivieren',
    cancel: 'Abbrechen',
    backupTitle: 'Sichere deine Backup-Codes',
    backupDescription:
      'Jeder Code funktioniert einmalig, falls du keinen Zugriff mehr auf deine Authenticator-App hast. Bewahre sie sicher auf — sie werden nicht erneut angezeigt.',
    backupDownload: 'Codes herunterladen',
    backupDone: 'Ich habe meine Codes gespeichert',
    disableTitle: 'Zwei-Faktor-Authentifizierung deaktivieren',
    disableDescription:
      'Gib dein Passwort ein, um die Zwei-Faktor-Authentifizierung zu deaktivieren.',
    disablePassword: 'Aktuelles Passwort',
    disableConfirm: 'Deaktivieren',
    loginTitle: 'Bestätigung in zwei Schritten',
    loginPrompt: 'Gib den Code aus deiner Authenticator-App ein.',
    loginCode: 'Authentifizierungscode',
    loginSubmit: 'Bestätigen',
    loginBackupHint: 'Du kannst auch einen deiner Backup-Codes verwenden.',
    invalidCode: 'Ungültiger Code. Bitte versuche es erneut.',
    enabledSuccess: 'Die Zwei-Faktor-Authentifizierung ist jetzt aktiv.',
    disabledSuccess: 'Die Zwei-Faktor-Authentifizierung wurde deaktiviert.'
  },
  common: {
    loading: 'Laden...',
    error: 'Ein Fehler ist aufgetreten',
    timeAgo: {
      now: 'Gerade eben',
      minutes: 'Vor {n} Min.',
      hours: 'Vor {n} Std.',
      days: 'Vor {n} T.'
    }
  }
} satisfies AuthLocale;
