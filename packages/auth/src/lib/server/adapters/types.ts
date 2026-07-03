import type { AuthUser, LockoutConfig } from '../../types.js';

export interface FullAuthUser<R extends string = string> extends AuthUser<R> {
  passwordHash: string;
  tokenVersion: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLogin: Date | null;
  verificationToken: string | null;
  verificationTokenExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetTokenExpires: Date | null;
  /**
   * Address a pending email change will switch to once confirmed. Set by
   * `setEmailChangeToken`, cleared by `consumeEmailChangeToken`; null when no
   * change is in flight. One pending change per user is supported.
   */
  pendingEmail: string | null;
  emailChangeToken: string | null;
  emailChangeTokenExpires: Date | null;
  /**
   * The user's TOTP secret, **encrypted at rest** (AES-256-GCM, see
   * `server/totp.ts` `encryptSecret`). Set during 2FA setup (with
   * `totpEnabled: false`), kept after enable, and cleared by `disableTotp`. Never
   * decrypt it outside the verify path, and never expose it through
   * `sanitizeUser`. `null` when 2FA was never set up.
   */
  totpSecret: string | null;
  /** When the user confirmed (enabled) TOTP. `null` until enable; cleared on disable. */
  totpConfirmedAt: Date | null;
}

export interface CreateUserData<R extends string = string> {
  email: string;
  name: string;
  passwordHash: string;
  role: R;
  emailVerified?: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
}

/**
 * The public invitation shape. `create()`/`list()`/`findByEmail()` results are
 * serialized straight into the admin HTTP response by
 * `createInvitationHandlers`, so adapters MUST project rows down to exactly
 * these fields (see `mapInvitation` in the Prisma adapter; enforced by the
 * conformance suite). `invitedById` is deliberately NOT part of the contract —
 * it is a persistence/audit detail, and exposing it would link the inviting
 * admin's user id into an API response.
 */
export interface Invitation {
  id: string;
  email: string;
  role: string;
  usedAt: Date | null;
  createdAt: Date;
}

export interface CreateInvitationData {
  email: string;
  role: string;
  invitedById: string;
}

/**
 * **Missing-target semantics:** unless a method documents otherwise, every
 * write method MUST treat a missing user as a silent no-op — never a throw.
 * The account can be deleted concurrently between a handler's session check
 * and its write (TOCTOU); a throwing adapter turns that harmless race into a
 * 500. The claim methods (`consume*`) signal "nothing claimed" via their
 * `null`/`false` return instead. Enforced by the conformance suite.
 *
 * **Email normalization:** every email reaching this repository — as a lookup
 * argument or inside `CreateUserData` — arrives pre-normalized (trimmed,
 * lowercased) by the package's input validation. Adapters MUST NOT normalize
 * again and MUST match/store the value verbatim; whether the underlying store
 * compares case-sensitively is therefore irrelevant to the contract.
 *
 * **Feature tiers:** the interface is one repository (the columns live on one
 * user row), but its sections below map to features. `findById`…`delete` up to
 * the lockout group serve the core password flow; the email-change trio only
 * runs when `createChangeEmailHandler` is mounted; the TOTP trio only when
 * `config.twoFactor` is wired (alongside the separate, optional
 * {@link BackupCodeRepository}). An adapter for an app that will never mount a
 * feature may stub that section with throwing methods — nothing in the package
 * calls a section whose feature is not mounted — but the shipped adapters
 * implement everything.
 */
export interface UserRepository<R extends string = string> {
  // ---- Identity & credentials (core) ----
  findById(id: string): Promise<FullAuthUser<R> | null>;
  findByEmail(email: string): Promise<FullAuthUser<R> | null>;
  create(data: CreateUserData<R>): Promise<AuthUser<R>>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  setEmailVerified(id: string): Promise<void>;

  // ---- Email verification ----
  setVerificationToken(id: string, tokenHash: string, expires: Date): Promise<void>;
  /**
   * Atomically claim an email-verification token: mark the matching user as
   * verified **and** clear the token in a single conditional write, so two
   * concurrent verify requests cannot both succeed. Returns the user (in its
   * post-claim state: `emailVerified: true`, token cleared) on a successful
   * claim, or `null` when the token is unknown, already consumed, or expired.
   * Implementations MUST clear an expired token's hash on a failed claim so no
   * reusable artifact remains in the store.
   */
  consumeVerificationToken(tokenHash: string): Promise<FullAuthUser<R> | null>;

  // ---- Password reset ----
  setPasswordResetToken(id: string, tokenHash: string, expires: Date): Promise<void>;
  /**
   * Atomically claim a password-reset token: clear it in a single conditional
   * write and return the owning user, or `null` when the token is unknown,
   * already consumed, or expired. The single-use guarantee is enforced here —
   * a second concurrent reset attempt with the same token MUST return `null`.
   * Implementations MUST clear an expired token's hash on a failed claim.
   */
  consumeResetToken(tokenHash: string): Promise<FullAuthUser<R> | null>;

  // ---- Session invalidation & lockout (core) ----
  /**
   * Atomically increment the user's token version (invalidates every issued
   * access token). MUST be a single atomic `increment`, not a read-modify-write,
   * so parallel "log out everywhere" calls cannot lose an increment.
   */
  incrementTokenVersion(id: string): Promise<void>;

  getFailedLoginAttempts(
    id: string
  ): Promise<{ count: number; lockedUntil: Date | null; lastFailedAt: Date | null }>;
  /**
   * Atomically increment the failed-login counter (single `increment`, never a
   * read-modify-write — under credential stuffing a lost update would let the
   * lockout under-count). When `lockoutConfig` is supplied and the new count
   * reaches `maxAttempts`, also set `lockedUntil` to `now + durationMinutes`.
   * Without `lockoutConfig`, only the counter is bumped (back-compat / stubs).
   */
  recordFailedLogin(id: string, lockoutConfig?: LockoutConfig): Promise<void>;
  resetFailedLogins(id: string): Promise<void>;

  // ---- Profile & account lifecycle (core) ----
  /**
   * Patch mutable profile fields. v1 mutates only `name`; the object shape keeps
   * the contract extensible (more package-owned profile fields later) without an
   * interface break. Implementations MUST only write the keys present in `data`
   * — an absent key leaves its column untouched — and treat a missing user as a
   * no-op. Email is changed only through the verified
   * `setEmailChangeToken`/`consumeEmailChangeToken` flow; `role` is never
   * self-service and is intentionally not patchable here.
   */
  updateProfile(id: string, data: { name?: string }): Promise<void>;

  // ---- Email change (createChangeEmailHandler) ----
  /**
   * Stage a pending email change: store `pendingEmail` plus the SHA-256 token
   * hash and its expiry on the user, overwriting any in-flight change (one
   * pending change per user). The token is verified later via
   * `consumeEmailChangeToken`. No-op on a missing user.
   */
  setEmailChangeToken(
    id: string,
    pendingEmail: string,
    tokenHash: string,
    expires: Date
  ): Promise<void>;

  /**
   * Atomically confirm a pending email change: in a single conditional write,
   * set `email = pendingEmail`, mark `emailVerified: true` (the new address was
   * proven controlled by clicking the link sent to it), and clear the pending
   * fields — but only if the token still matches and has not expired. Returns
   * the post-claim user on the winning call, or `null` when the token is
   * unknown/already-consumed/expired **or** when the target address was claimed
   * by another account between request and confirm (the `email` uniqueness must
   * be respected: a collision is reported as a failed claim, never a duplicate
   * email). Single-use under concurrency: exactly one of N concurrent confirms
   * may win. Implementations MUST clear an expired token's artifacts on a failed
   * claim.
   */
  consumeEmailChangeToken(tokenHash: string): Promise<FullAuthUser<R> | null>;

  /**
   * Hard-delete the user (GDPR erasure — no soft-delete flag). Implementations
   * MUST also remove rows that would otherwise be orphaned: a relational
   * adapter relies on `onDelete: Cascade` for passkeys/refresh-tokens/
   * notifications/push-subscriptions/preferences, but MUST additionally delete
   * the invitations this user *sent* (the `invitedBy` FK has no cascade) —
   * ideally in one transaction with the user delete so the two cannot diverge.
   * A missing user is a safe no-op. Fire `onAccountDeleted` *before* calling
   * this (the row, and the data to archive, must still exist).
   */
  delete(id: string): Promise<void>;

  // ---- TOTP two-factor (config.twoFactor; see also BackupCodeRepository) ----
  /**
   * Stage a TOTP secret during 2FA setup: store the **encrypted** secret and
   * force `totpEnabled: false` / `totpConfirmedAt: null`, overwriting any prior
   * (pending or active) secret. Two-factor is not yet in effect — `enableTotp`
   * activates it after the user proves possession with a valid code. No-op on a
   * missing user.
   */
  setTotpSecret(id: string, encryptedSecret: string): Promise<void>;

  /**
   * Activate TOTP after the setup code verified: set `totpEnabled: true` and
   * `totpConfirmedAt: now`, leaving the staged `totpSecret` in place. No-op on a
   * missing user. The caller is responsible for (re)generating backup codes; the
   * secret must already be staged via `setTotpSecret`.
   */
  enableTotp(id: string): Promise<void>;

  /**
   * Turn TOTP off: clear `totpSecret`, set `totpEnabled: false` and
   * `totpConfirmedAt: null` in one write. The user's backup codes are a separate
   * table — the caller MUST also call `BackupCodeRepository.deleteAll` (a disable
   * with orphaned codes is still safe because the verify path is gated on
   * `totpEnabled`, but they should not linger). No-op on a missing user.
   */
  disableTotp(id: string): Promise<void>;
}

/**
 * Single-use TOTP backup (recovery) codes, stored as SHA-256 hashes — never in
 * the clear. A user is shown 8–10 codes once at enable; each can be redeemed
 * exactly once if they lose their authenticator. Backed by its own table
 * (`TwoFactorBackupCode`) with a cascade on the user.
 */
export interface BackupCodeRepository {
  /**
   * Insert a fresh batch of code hashes for the user. The caller generates the
   * plaintext codes, shows them once, and passes only their hashes here.
   * Implementations MUST NOT deduplicate against existing rows — `enableTotp`
   * clears the old set first (see `deleteAll`), so this is always a clean batch.
   */
  createMany(userId: string, codeHashes: string[]): Promise<void>;
  /**
   * Atomically redeem one backup code: flip a matching **unused** row to used in
   * a single conditional write, scoped to `userId`. Returns `true` iff this call
   * performed the transition (the code existed, belonged to the user, and was
   * unused), else `false`. The single-use guarantee lives here — two concurrent
   * redemptions of the same code yield exactly one `true`. Implement as a single
   * `updateMany({ where: { userId, codeHash, usedAt: null }, … })` and return
   * `count === 1`; never `SELECT` then `UPDATE` across an `await`.
   */
  consumeIfUnused(userId: string, codeHash: string): Promise<boolean>;
  /** Remove every backup code for the user (on disable, or before re-issuing at enable). */
  deleteAll(userId: string): Promise<void>;
}

export interface InvitationRepository {
  /** Emails arrive pre-normalized (see {@link UserRepository}); match verbatim. */
  findByEmail(email: string): Promise<Invitation | null>;
  /**
   * Atomically claim an invitation: flip `usedAt` from null to now in a single
   * conditional write. Returns `true` when this call performed the transition
   * (the caller "won"), `false` when the invitation was already used or does
   * not exist. Used to gate registration so one invitation creates one user.
   */
  markUsedIfUnused(id: string): Promise<boolean>;
  create(data: CreateInvitationData): Promise<Invitation>;
  list(): Promise<Invitation[]>;
  delete(id: string): Promise<void>;
}

/**
 * **Owner-scope convention:** every method that mutates a single owned row
 * takes the owner first — `(userId, id)` — matching the rest of the adapter
 * surface (pushSubscription, backupCode, refreshToken `*ForUser`). With two
 * `string` parameters a swapped call still compiles; one fixed order across
 * all repositories is what keeps such a swap greppable and reviewable.
 */
export interface NotificationRepository {
  create(data: CreateNotificationData): Promise<NotificationRecord>;
  findByUser(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<NotificationRecord[]>;
  /** Scoped to the owner: a non-owner's call MUST NOT flip the read state. */
  markAsRead(userId: string, id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  /** Scoped to the owner: a non-owner's call MUST NOT delete the row. */
  delete(userId: string, id: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}

/**
 * What `PushSubscriptionRepository.create` did with the write:
 * - `'created'` — no row existed for the endpoint; a new one was inserted.
 * - `'updated'` — the caller already owned the row; keys updated in place
 *   (the browser's normal re-subscribe).
 * - `'reassigned'` — the row belonged to another user and the submitted keys
 *   matched the stored ones, proving possession of the browser subscription:
 *   ownership moved to the caller (the user-switch-in-the-same-browser case).
 * - `'rejected'` — the row belongs to another user and the keys do NOT match:
 *   nothing was written. The handler surfaces this as `409`.
 */
export type PushSubscriptionWriteOutcome = 'created' | 'updated' | 'reassigned' | 'rejected';

export interface PushSubscriptionRepository {
  findByUser(userId: string): Promise<PushSubscriptionData[]>;
  /**
   * Create the subscription — or, when a row with the same `endpoint` already
   * exists, update that row in place (upsert-by-endpoint). The endpoint URL is
   * the natural key of a browser push subscription: re-enabling notifications
   * re-sends the browser's *existing* subscription, so a duplicate POST is the
   * normal case and MUST NOT fail on the unique endpoint.
   *
   * Ownership on conflict is gated on key possession: when the existing row
   * belongs to a **different** user, reassign it to the caller **only if** the
   * submitted `keys` equal the stored ones (compare the decoded bytes,
   * constant-time — see `pushKeysEqual`), and MUST return `'rejected'`
   * without writing otherwise. The keys are what distinguishes holding the
   * browser subscription (the legitimate user-switch case re-sends endpoint
   * *and* keys) from merely knowing the endpoint URL (e.g. from a log) —
   * ungated, the latter would let any authenticated account take the row
   * over and mute the previous owner's push channel. Same-owner writes always
   * update in place. Endpoint URLs are still worth keeping out of logs (they
   * are the push target), but takeover no longer rides on them alone.
   *
   * Enforced by the conformance suite for all four outcomes.
   */
  create(userId: string, subscription: PushSubscriptionData): Promise<PushSubscriptionWriteOutcome>;
  /**
   * Delete a subscription scoped to a specific user. Scoping by user-id
   * prevents an authenticated attacker from deleting another user's
   * subscription (and thereby silencing security notifications) just by
   * knowing the endpoint URL. Should no-op (or throw a not-found that the
   * handler swallows) when no row matches.
   */
  delete(userId: string, endpoint: string): Promise<void>;
}

export interface NotificationPreferenceRepository {
  findByUser(userId: string): Promise<NotificationPreference[]>;
  upsert(userId: string, typeKey: string, prefs: PreferenceData): Promise<void>;
}

export interface CreateNotificationData {
  userId: string;
  typeKey: string;
  title: string;
  body?: string;
  url?: string;
  icon?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  typeKey: string;
  title: string;
  body: string | null;
  url: string | null;
  icon: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPreference {
  typeKey: string;
  sse: boolean;
  push: boolean;
  /**
   * Reserved: there is currently no email delivery channel (see
   * `NotificationTypeDefinition.channels`). The flag is persisted and
   * round-tripped so existing schemas/rows stay valid and a future email
   * channel can honour stored preferences, but nothing reads it today.
   */
  email: boolean;
}

export interface PreferenceData {
  sse?: boolean;
  push?: boolean;
  /** Reserved — see {@link NotificationPreference.email}. */
  email?: boolean;
}

export interface Passkey {
  credentialId: string;
  userId: string;
  publicKey: Uint8Array;
  publicKeyAlg: number;
  counter: number;
  transports: string[];
  aaguid: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface CreatePasskeyData {
  credentialId: string;
  publicKey: Uint8Array;
  publicKeyAlg: number;
  counter: number;
  transports?: string[];
  aaguid: string;
  name?: string;
}

export interface PasskeyRepository {
  findByUserId(userId: string): Promise<Passkey[]>;
  findByCredentialId(credentialId: string): Promise<Passkey | null>;
  create(userId: string, passkey: CreatePasskeyData): Promise<Passkey>;
  /**
   * Compare-and-set the signature counter: bump it to `counter` **only if the
   * stored value is strictly lower** (`where: { credentialId, counter: { lt } }`),
   * also touching `lastUsedAt`. Returns `true` on a successful bump, `false`
   * when no row advanced — which, after a passed assertion, signals a
   * concurrent replay the caller should reject (cloned-authenticator window).
   * A reported `counter` of 0 means the authenticator keeps no counter; in that
   * case implementations only refresh `lastUsedAt` and return `true`.
   */
  updateCounter(credentialId: string, counter: number): Promise<boolean>;
  /** Scoped to the owner (owner-first, see {@link NotificationRepository}). */
  delete(userId: string, credentialId: string): Promise<void>;
  /** Scoped to the owner (owner-first, see {@link NotificationRepository}). */
  rename(userId: string, credentialId: string, name: string): Promise<void>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
  /** Client user-agent captured at issue (device recognition in session lists). */
  userAgent: string | null;
  /** Client IP — only persisted when the consumer opts in via `sessions.storeIp`. */
  ip: string | null;
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

export interface RefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Compare-and-set revoke of a single token: flip `revokedAt` from null to now
   * (optionally recording the successor) **only if the token is still live**.
   * Returns `true` when this call performed the transition, `false` when the
   * token was already revoked. This is the atomicity primitive that makes
   * rotation race-safe — two concurrent rotations of the same token both create
   * a successor, but only the one whose `revoke` returns `true` may keep it;
   * the loser rolls its successor back. Implement via a conditional
   * `updateMany({ where: { id, revokedAt: null }, … })` and return `count === 1`.
   */
  revoke(id: string, replacedById?: string | null): Promise<boolean>;
  /** Revoke every non-revoked token in a family (used on reuse detection). */
  revokeFamily(family: string): Promise<void>;
  /** Revoke every non-revoked token for a user (used on logout-everywhere). */
  revokeAllForUser(userId: string): Promise<void>;
  /** Remove expired tokens. Returns the number deleted. */
  deleteExpired(): Promise<number>;

  /**
   * List a user's currently-active refresh tokens — non-revoked and unexpired.
   * Rotation keeps exactly one live token per family, so each row corresponds to
   * one active session. Ordered newest-first. Powers the session-listing feature
   * (`createListSessionsHandler`).
   */
  listActiveByUser(userId: string): Promise<RefreshTokenRecord[]>;
  /**
   * Ownership-scoped family revoke: revoke every live token in `family` **only
   * if it belongs to `userId`**. Returns `true` iff this call revoked at least
   * one token (the family was the user's and still live), else `false`. Unlike
   * the unscoped {@link RefreshTokenRepository.revokeFamily}, the `userId` guard
   * is mandatory — it stops one user from revoking (DoS'ing) another's session
   * just by knowing/guessing a family id (IDOR). Implement as a single
   * `updateMany({ where: { userId, family, revokedAt: null }, … })` and return
   * `count > 0`.
   */
  revokeFamilyForUser(userId: string, family: string): Promise<boolean>;
  /**
   * Revoke every live token for `userId` **except** those in `keepFamily`
   * (the "sign out all other sessions" action). Scope by `userId` so it can
   * never touch another user. A single
   * `updateMany({ where: { userId, family: { not: keepFamily }, revokedAt: null }, … })`.
   */
  revokeOtherFamiliesForUser(userId: string, keepFamily: string): Promise<void>;
}

export interface Repositories<R extends string = string> {
  user: UserRepository<R>;
  invitation: InvitationRepository;
  notification?: NotificationRepository;
  pushSubscription?: PushSubscriptionRepository;
  notificationPreference?: NotificationPreferenceRepository;
  passkey?: PasskeyRepository;
  refreshToken?: RefreshTokenRepository;
  /** Optional — required only when `config.twoFactor` (TOTP 2FA) is wired. */
  backupCode?: BackupCodeRepository;
}
