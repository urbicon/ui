import type { AuthLocale } from './keys.js';

export const de = {
  auth: {
    errors: {
      invitationRequired: 'Eine Einladung ist erforderlich.',
      invitationUsed: 'Diese Einladung wurde bereits verwendet.',
      invitationExpired: 'Diese Einladung ist abgelaufen. Bitte um eine neue.',
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
      rateLimited: 'Zu viele Anfragen. Bitte versuche es später erneut.',
      connectionLimit:
        'Zu viele offene Verbindungen. Schließe einen anderen Tab und versuche es erneut.',
      csrfFailed: 'Diese Seite war zu lange geöffnet. Bitte lade sie neu und versuche es erneut.',
      passkeyVerificationFailed:
        'Dein Passkey konnte nicht geprüft werden. Bitte versuche es erneut.',
      serverError: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
      networkError: 'Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.'
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
        invalid: 'Ungültige E-Mail oder Passwort'
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
      errors: {
        passwordMismatch: 'Die Passwörter stimmen nicht überein'
      }
    },
    passwordRequirements: {
      label: 'Passwort-Anforderungen',
      met: 'Erfüllt',
      notMet: 'Nicht erfüllt',
      failed: 'Dein Passwort erfüllt die Anforderungen nicht: {rules}',
      rules: {
        minLength: 'Mindestens {n} Zeichen',
        uppercase: 'Ein Großbuchstabe',
        lowercase: 'Ein Kleinbuchstabe',
        digit: 'Eine Ziffer',
        special: 'Ein Sonderzeichen'
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
        invalidToken: 'Ungültiger oder abgelaufener Link.'
      }
    },
    verifyEmail: {
      title: 'E-Mail bestätigen',
      verifying: 'E-Mail wird verifiziert...',
      success: 'Deine E-Mail-Adresse wurde bestätigt.',
      error: 'Ungültiger oder abgelaufener Bestätigungslink.'
    },
    emails: {
      verification: {
        subject: 'Bestätige deine E-Mail — {appName}',
        heading: 'Willkommen, {name}!',
        body: 'Bitte bestätige deine E-Mail-Adresse für {appName}, um die Einrichtung deines Kontos abzuschließen.',
        cta: 'E-Mail bestätigen',
        ignore: 'Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.'
      },
      passwordReset: {
        subject: 'Setze dein Passwort zurück — {appName}',
        heading: 'Passwort zurücksetzen',
        body: 'Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Dieser Link läuft in 1 Stunde ab.',
        cta: 'Passwort zurücksetzen',
        ignore: 'Falls du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.'
      },
      invitation: {
        subject: 'Du wurdest zu {appName} eingeladen',
        heading: 'Du wurdest eingeladen',
        body: 'Du wurdest eingeladen, ein Konto bei {appName} zu erstellen. Klicke unten, um loszulegen.',
        cta: 'Konto erstellen',
        ignore: 'Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.'
      },
      changeEmail: {
        subject: 'Bestätige deine neue E-Mail-Adresse — {appName}',
        heading: 'E-Mail bestätigen',
        body: 'Bestätige diese Adresse, um sie für dein {appName}-Konto zu verwenden. Dieser Link läuft in 1 Stunde ab.',
        cta: 'E-Mail bestätigen',
        ignore: 'Falls du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.'
      },
      changeEmailNotice: {
        subject: 'Änderung der E-Mail-Adresse angefordert — {appName}',
        heading: 'Änderung der E-Mail-Adresse angefordert',
        body: 'Es wurde angefordert, die E-Mail-Adresse deines Kontos zu {email} zu ändern. Sie wird erst wirksam, wenn sie über die neue Adresse bestätigt wird.',
        ignore:
          'Falls du das nicht warst, sichere bitte dein Konto — deine E-Mail-Adresse wurde noch nicht geändert.'
      }
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
      dismiss: 'Nicht jetzt',
      error: 'Push-Benachrichtigungen konnten nicht aktiviert werden. Bitte versuche es erneut.',
      errorConflict: 'Dieses Gerät ist bereits einem anderen Konto zugeordnet.',
      errorLimit: 'Gerätelimit erreicht – entferne zuerst ein Gerät.',
      errorRateLimited: 'Zu viele Versuche. Bitte versuche es später erneut.'
    }
  },
  invitations: {
    title: 'Einladungen',
    email: 'E-Mail-Adresse',
    role: 'Rolle',
    pending: 'Ausstehend',
    delete: 'Löschen',
    send: 'Senden',
    empty: 'Noch keine Einladungen.',
    sendEmail: 'Einladungs-E-Mail senden',
    registered: 'Registriert',
    linkSentAndCopyable: 'Einladung an {email} versendet. Der Link wird einmalig angezeigt:',
    linkNotSent: 'Einladung für {email} erstellt. Es wurde keine E-Mail versendet — Link kopieren:',
    linkCopy: 'Link kopieren',
    linkCopied: 'Kopiert',
    linkTrustNote:
      'Wer diesen Link hat, kann das Konto anlegen. Ein kopierter Link belegt nicht, dass die empfangende Person die Adresse besitzt — ein damit angelegtes Konto muss seine E-Mail-Adresse weiterhin bestätigen.'
  },
  passkeys: {
    title: 'Passkeys',
    add: 'Passkey hinzufügen',
    empty: 'Keine Passkeys registriert.',
    delete: 'Löschen',
    lastUsed: 'Zuletzt verwendet',
    loginWithPasskey: 'Mit Passkey anmelden',
    or: 'oder',
    loginFailed: 'Passkey-Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
    cancelled: 'Der Passkey-Vorgang wurde abgebrochen.',
    addFailed: 'Passkey konnte nicht hinzugefügt werden. Bitte versuche es erneut.'
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
    invalidCode: 'Ungültiger Code. Bitte versuche es erneut.'
  },
  common: {
    error: 'Ein Fehler ist aufgetreten',
    timeAgo: {
      now: 'Gerade eben',
      minutes: 'Vor {n} Min.',
      hours: 'Vor {n} Std.',
      days: 'Vor {n} T.'
    }
  }
} satisfies AuthLocale;
