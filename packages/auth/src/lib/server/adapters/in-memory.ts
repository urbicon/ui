import { randomUUID } from 'node:crypto';
import type { AuthUser, LockoutConfig } from '../../types.js';
import { pushKeysEqual } from '../notifications/push-keys.js';
import type {
  BackupCodeRepository,
  CreateInvitationData,
  CreateNotificationData,
  CreatePasskeyData,
  CreateRefreshTokenData,
  CreateUserData,
  FullAuthUser,
  Invitation,
  InvitationRepository,
  NotificationPreference,
  NotificationPreferenceRepository,
  NotificationRecord,
  NotificationRepository,
  Passkey,
  PasskeyRepository,
  PreferenceData,
  PushSubscriptionData,
  PushSubscriptionRepository,
  RefreshTokenRecord,
  RefreshTokenRepository,
  Repositories,
  UserRepository
} from './types.js';

/**
 * In-memory implementation of the full {@link Repositories} contract.
 *
 * **Dev / test only.** State lives in plain `Map`s on the heap — it is wiped on
 * restart and not shared across processes or instances. Use it for the
 * five-minute quickstart, local development, and as the fixture every adapter
 * conformance run executes against. **Never** ship it to production; pass a
 * persistent adapter (`createPrismaRepos`, or your own) instead.
 *
 * ### Why this is a faithful reference (not just a stub)
 *
 * The atomicity the interface demands of a real database — single-use token
 * claims, compare-and-set rotation/counter bumps, lossless increments — is
 * reproduced here the only way single-threaded JavaScript can: every claim
 * method performs its **read and conditional write with no `await` in
 * between**, so two concurrent calls can never interleave through the decision.
 * That is exactly the property the exported conformance suite asserts, which is
 * why this adapter passes it. An implementation that `await`ed mid-claim would
 * fail the same suite — see `conformance.ts`.
 */
export function createInMemoryRepos<R extends string = string>(): Repositories<R> {
  const user = createInMemoryUserRepository<R>();
  const invitation = createInMemoryInvitationRepositoryInternal();
  const notification = createInMemoryNotificationRepository();
  const pushSubscription = createInMemoryPushSubscriptionRepository();
  const notificationPreference = createInMemoryNotificationPreferenceRepository();
  const passkey = createInMemoryPasskeyRepository();
  const refreshToken = createInMemoryRefreshTokenRepository();
  const backupCode = createInMemoryBackupCodeRepository();

  return {
    user: {
      ...user,
      // The contract's delete-cascade MUST (types.ts): a relational adapter
      // gets the dependent rows via `onDelete: Cascade` plus an explicit
      // transaction for the invitations the user *sent*; this bundle models
      // the same end state across its sibling stores. (The standalone
      // `createInMemoryUserRepository` cannot — it does not know them.)
      async delete(id) {
        invitation.deleteByInviter(id);
        for (const p of await passkey.findByUserId(id)) {
          await passkey.delete(id, p.credentialId);
        }
        for (const n of await notification.findByUser(id)) {
          await notification.delete(id, n.id);
        }
        for (const s of await pushSubscription.findByUser(id)) {
          await pushSubscription.delete(id, s.endpoint);
        }
        await backupCode.deleteAll(id);
        // The contract has no hard-delete for refresh tokens; revoking every
        // live token is the observable equivalent (nothing lists or rotates).
        await refreshToken.revokeAllForUser(id);
        await user.delete(id);
      }
    },
    invitation: invitation.repo,
    notification,
    pushSubscription,
    notificationPreference,
    passkey,
    refreshToken,
    backupCode
  };
}

// --- User ------------------------------------------------------------------

export function createInMemoryUserRepository<R extends string = string>(): UserRepository<R> {
  const byId = new Map<string, FullAuthUser<R>>();
  const byEmail = new Map<string, string>(); // email → id (enforces @unique)

  const find = (predicate: (u: FullAuthUser<R>) => boolean): FullAuthUser<R> | undefined => {
    for (const u of byId.values()) if (predicate(u)) return u;
    return undefined;
  };

  // Reads return a fully detached copy: a shallow spread would share the
  // `Date` references with the live store entry, so a caller mutating a
  // returned date would corrupt the store. Mirrors the Prisma adapter, which
  // always hands back fresh objects from `mapUser`.
  const cloneUser = (u: FullAuthUser<R>): FullAuthUser<R> => ({
    ...u,
    lockedUntil: u.lockedUntil ? new Date(u.lockedUntil) : null,
    lastFailedLogin: u.lastFailedLogin ? new Date(u.lastFailedLogin) : null,
    verificationTokenExpires: u.verificationTokenExpires
      ? new Date(u.verificationTokenExpires)
      : null,
    passwordResetTokenExpires: u.passwordResetTokenExpires
      ? new Date(u.passwordResetTokenExpires)
      : null,
    emailChangeTokenExpires: u.emailChangeTokenExpires ? new Date(u.emailChangeTokenExpires) : null,
    totpConfirmedAt: u.totpConfirmedAt ? new Date(u.totpConfirmedAt) : null
  });

  return {
    async findById(id) {
      const u = byId.get(id);
      return u ? cloneUser(u) : null;
    },

    async findByEmail(email) {
      const id = byEmail.get(email);
      const u = id ? byId.get(id) : undefined;
      return u ? cloneUser(u) : null;
    },

    async create(data: CreateUserData<R>): Promise<AuthUser<R>> {
      if (byEmail.has(data.email)) {
        throw new Error(`[auth:in-memory] user with email ${data.email} already exists`);
      }
      const user: FullAuthUser<R> = {
        id: randomUUID(),
        email: data.email,
        name: data.name,
        role: data.role,
        emailVerified: data.emailVerified ?? false,
        totpEnabled: false,
        passwordHash: data.passwordHash,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
        verificationToken: data.verificationToken ?? null,
        verificationTokenExpires: data.verificationTokenExpires ?? null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeTokenExpires: null,
        totpSecret: null,
        totpConfirmedAt: null
      };
      byId.set(user.id, user);
      byEmail.set(user.email, user.id);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled
      };
    },

    async updatePassword(id, passwordHash) {
      const u = byId.get(id);
      if (u) u.passwordHash = passwordHash;
    },

    async setEmailVerified(id) {
      const u = byId.get(id);
      if (u) u.emailVerified = true;
    },

    async setVerificationToken(id, tokenHash, expires) {
      const u = byId.get(id);
      if (u) {
        u.verificationToken = tokenHash;
        u.verificationTokenExpires = expires;
      }
    },

    async consumeVerificationToken(tokenHash) {
      const u = find((x) => x.verificationToken === tokenHash);
      if (!u) return null;
      // Atomic single-use claim: read + conditional write with no await between
      // them, so two concurrent verifies cannot both succeed.
      const expired =
        u.verificationTokenExpires != null && u.verificationTokenExpires <= new Date();
      if (expired) {
        // Purge the expired artifact so it cannot linger / be reused.
        u.verificationToken = null;
        u.verificationTokenExpires = null;
        return null;
      }
      u.emailVerified = true;
      u.verificationToken = null;
      u.verificationTokenExpires = null;
      return cloneUser(u);
    },

    async setPasswordResetToken(id, tokenHash, expires) {
      const u = byId.get(id);
      if (u) {
        u.passwordResetToken = tokenHash;
        u.passwordResetTokenExpires = expires;
      }
    },

    async consumeResetToken(tokenHash) {
      const u = find((x) => x.passwordResetToken === tokenHash);
      if (!u) return null;
      const expired =
        u.passwordResetTokenExpires != null && u.passwordResetTokenExpires <= new Date();
      if (expired) {
        u.passwordResetToken = null;
        u.passwordResetTokenExpires = null;
        return null;
      }
      u.passwordResetToken = null;
      u.passwordResetTokenExpires = null;
      return cloneUser(u);
    },

    async incrementTokenVersion(id) {
      const u = byId.get(id);
      if (u) u.tokenVersion += 1; // atomic in single-threaded JS (no await)
    },

    async getFailedLoginAttempts(id) {
      const u = byId.get(id);
      return {
        count: u?.failedLoginAttempts ?? 0,
        lockedUntil: u?.lockedUntil ?? null,
        lastFailedAt: u?.lastFailedLogin ?? null
      };
    },

    async recordFailedLogin(id, lockoutConfig?: LockoutConfig) {
      const u = byId.get(id);
      if (!u) return;
      u.failedLoginAttempts += 1;
      u.lastFailedLogin = new Date();
      if (lockoutConfig && u.failedLoginAttempts >= (lockoutConfig.maxAttempts ?? 5)) {
        const durationMs = (lockoutConfig.durationMinutes ?? 15) * 60_000;
        u.lockedUntil = new Date(Date.now() + durationMs);
      }
    },

    async resetFailedLogins(id) {
      const u = byId.get(id);
      if (u) {
        u.failedLoginAttempts = 0;
        u.lockedUntil = null;
        u.lastFailedLogin = null;
      }
    },

    async updateProfile(id, data) {
      const u = byId.get(id);
      if (!u) return;
      // Only the provided keys — an absent key leaves the column untouched.
      if (data.name !== undefined) u.name = data.name;
    },

    async setEmailChangeToken(id, pendingEmail, tokenHash, expires) {
      const u = byId.get(id);
      if (u) {
        u.pendingEmail = pendingEmail;
        u.emailChangeToken = tokenHash;
        u.emailChangeTokenExpires = expires;
      }
    },

    async consumeEmailChangeToken(tokenHash) {
      const u = find((x) => x.emailChangeToken === tokenHash);
      if (!u || u.pendingEmail == null) return null;
      // Atomic single-use claim: read + conditional write with no await between
      // them, so two concurrent confirms cannot both succeed.
      const expired = u.emailChangeTokenExpires != null && u.emailChangeTokenExpires <= new Date();
      if (expired) {
        u.pendingEmail = null;
        u.emailChangeToken = null;
        u.emailChangeTokenExpires = null;
        return null;
      }
      // Respect email uniqueness: if the target was taken by *another* account
      // between request and confirm, the change is no longer possible. Clear the
      // doomed pending change so the user isn't stuck on a dead token.
      const conflictId = byEmail.get(u.pendingEmail);
      if (conflictId != null && conflictId !== u.id) {
        u.pendingEmail = null;
        u.emailChangeToken = null;
        u.emailChangeTokenExpires = null;
        return null;
      }
      // Swap the email + reindex; the new address is verified by virtue of the
      // link having been delivered to (and clicked from) it.
      byEmail.delete(u.email);
      u.email = u.pendingEmail;
      byEmail.set(u.email, u.id);
      u.emailVerified = true;
      u.pendingEmail = null;
      u.emailChangeToken = null;
      u.emailChangeTokenExpires = null;
      return cloneUser(u);
    },

    async delete(id) {
      // Removes the user row only: this standalone factory does not know its
      // sibling stores. The contract's cross-repository cascade (invitations
      // sent, passkeys, …) is modeled by `createInMemoryRepos`, which wires
      // the stores together — mirroring how the Prisma adapter gets it from
      // `onDelete: Cascade` plus the delete transaction.
      const u = byId.get(id);
      if (!u) return;
      byId.delete(id);
      byEmail.delete(u.email);
    },

    async setTotpSecret(id, encryptedSecret) {
      const u = byId.get(id);
      if (u) {
        u.totpSecret = encryptedSecret;
        u.totpEnabled = false;
        u.totpConfirmedAt = null;
      }
    },

    async enableTotp(id) {
      const u = byId.get(id);
      if (u) {
        u.totpEnabled = true;
        u.totpConfirmedAt = new Date();
      }
    },

    async disableTotp(id) {
      const u = byId.get(id);
      if (u) {
        u.totpSecret = null;
        u.totpEnabled = false;
        u.totpConfirmedAt = null;
      }
    }
  };
}

// --- Invitation ------------------------------------------------------------

// Rows keep `invitedById` internally (like a real table) so the bundle
// factory can model the sent-invitations cascade of `user.delete`; the
// contract-facing reads below project it away (the `Invitation` type
// deliberately excludes it).
interface StoredInvitation extends Invitation {
  invitedById: string;
}

function createInMemoryInvitationRepositoryInternal(): {
  repo: InvitationRepository;
  /** Cascade seam for the bundle's `user.delete` — not part of the contract. */
  deleteByInviter(inviterId: string): void;
} {
  const byId = new Map<string, StoredInvitation>();
  const byEmail = new Map<string, string>(); // email → id (enforces @unique)

  const project = (inv: StoredInvitation): Invitation => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    usedAt: inv.usedAt,
    createdAt: inv.createdAt
  });

  const repo: InvitationRepository = {
    async findByEmail(email) {
      const id = byEmail.get(email);
      const inv = id ? byId.get(id) : undefined;
      return inv ? project(inv) : null;
    },

    async markUsedIfUnused(id) {
      const inv = byId.get(id);
      // Atomic claim: only the first caller to see a live invitation wins.
      if (!inv || inv.usedAt) return false;
      inv.usedAt = new Date();
      return true;
    },

    async create(data: CreateInvitationData) {
      if (byEmail.has(data.email)) {
        throw new Error(`[auth:in-memory] invitation for ${data.email} already exists`);
      }
      const inv: StoredInvitation = {
        id: randomUUID(),
        email: data.email,
        role: data.role,
        invitedById: data.invitedById,
        usedAt: null,
        createdAt: new Date()
      };
      byId.set(inv.id, inv);
      byEmail.set(inv.email, inv.id);
      return project(inv);
    },

    async list() {
      return [...byId.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(project);
    },

    async delete(id) {
      const inv = byId.get(id);
      if (inv) {
        byId.delete(id);
        byEmail.delete(inv.email);
      }
    }
  };

  return {
    repo,
    deleteByInviter(inviterId) {
      for (const [id, inv] of byId) {
        if (inv.invitedById === inviterId) {
          byId.delete(id);
          byEmail.delete(inv.email);
        }
      }
    }
  };
}

export function createInMemoryInvitationRepository(): InvitationRepository {
  return createInMemoryInvitationRepositoryInternal().repo;
}

// --- Notification ----------------------------------------------------------

export function createInMemoryNotificationRepository(): NotificationRepository {
  const byId = new Map<string, NotificationRecord>();

  return {
    async create(data: CreateNotificationData) {
      const record: NotificationRecord = {
        id: randomUUID(),
        userId: data.userId,
        typeKey: data.typeKey,
        title: data.title,
        body: data.body ?? null,
        url: data.url ?? null,
        icon: data.icon ?? null,
        readAt: null,
        createdAt: new Date()
      };
      byId.set(record.id, record);
      return { ...record };
    },

    async findByUser(userId, options) {
      let rows = [...byId.values()].filter((n) => n.userId === userId);
      if (options?.unreadOnly) rows = rows.filter((n) => n.readAt === null);
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (options?.limit != null) rows = rows.slice(0, options.limit);
      return rows.map((n) => ({ ...n }));
    },

    async markAsRead(userId, id) {
      const n = byId.get(id);
      // Scope to userId: another user's id must not flip the read state.
      if (n && n.userId === userId && !n.readAt) n.readAt = new Date();
    },

    async markAllAsRead(userId) {
      const now = new Date();
      for (const n of byId.values()) {
        if (n.userId === userId && !n.readAt) n.readAt = now;
      }
    },

    async delete(userId, id) {
      const n = byId.get(id);
      // Scope to userId: an attacker knowing an id cannot delete another
      // user's notification.
      if (n && n.userId === userId) byId.delete(id);
    },

    async getUnreadCount(userId) {
      let count = 0;
      for (const n of byId.values()) if (n.userId === userId && !n.readAt) count++;
      return count;
    }
  };
}

// --- Push subscription -----------------------------------------------------

interface StoredPushSubscription extends PushSubscriptionData {
  userId: string;
}

export function createInMemoryPushSubscriptionRepository(): PushSubscriptionRepository {
  // endpoint is globally @unique in the schema; key the store by it.
  const byEndpoint = new Map<string, StoredPushSubscription>();

  return {
    async findByUser(userId) {
      return [...byEndpoint.values()]
        .filter((s) => s.userId === userId)
        .map((s) => ({ endpoint: s.endpoint, keys: { ...s.keys } }));
    },

    async create(userId, subscription: PushSubscriptionData) {
      // Upsert-by-endpoint per the repository contract: a re-subscribe updates
      // the row in place. Reassigning the endpoint to a DIFFERENT user is
      // gated on key possession — matching keys prove the caller holds the
      // browser subscription (user switch in the same browser); merely
      // knowing the endpoint URL must not take the row over.
      const existing = byEndpoint.get(subscription.endpoint);
      if (
        existing &&
        existing.userId !== userId &&
        !pushKeysEqual(existing.keys, subscription.keys)
      ) {
        return 'rejected';
      }
      byEndpoint.set(subscription.endpoint, {
        userId,
        endpoint: subscription.endpoint,
        keys: { ...subscription.keys }
      });
      return !existing ? 'created' : existing.userId === userId ? 'updated' : 'reassigned';
    },

    async delete(userId, endpoint) {
      const s = byEndpoint.get(endpoint);
      // Scope to userId: knowing the endpoint URL must not let one user delete
      // another's subscription (and silence their security notifications).
      if (s && s.userId === userId) byEndpoint.delete(endpoint);
    }
  };
}

// --- Notification preference ----------------------------------------------

interface StoredPreference extends NotificationPreference {
  userId: string;
}

export function createInMemoryNotificationPreferenceRepository(): NotificationPreferenceRepository {
  const byKey = new Map<string, StoredPreference>(); // `${userId}:${typeKey}` → pref

  return {
    async findByUser(userId) {
      return [...byKey.values()]
        .filter((p) => p.userId === userId)
        .map((p) => ({ typeKey: p.typeKey, sse: p.sse, push: p.push, email: p.email }));
    },

    async upsert(userId, typeKey, prefs: PreferenceData) {
      const key = `${userId}:${typeKey}`;
      const existing = byKey.get(key);
      if (existing) {
        if (prefs.sse !== undefined) existing.sse = prefs.sse;
        if (prefs.push !== undefined) existing.push = prefs.push;
        if (prefs.email !== undefined) existing.email = prefs.email;
      } else {
        byKey.set(key, {
          userId,
          typeKey,
          sse: prefs.sse ?? true,
          push: prefs.push ?? true,
          email: prefs.email ?? true
        });
      }
    }
  };
}

// --- Passkey ---------------------------------------------------------------

export function createInMemoryPasskeyRepository(): PasskeyRepository {
  const byCredentialId = new Map<string, Passkey>();

  // Copy both nested mutables — the `Uint8Array` public key and the transports
  // array — so neither the caller's input nor a returned handle aliases the
  // stored record (the Prisma adapter likewise re-wraps via `Buffer.from` /
  // `new Uint8Array`).
  const clone = (p: Passkey): Passkey => ({
    ...p,
    publicKey: new Uint8Array(p.publicKey),
    transports: [...p.transports]
  });

  return {
    async findByUserId(userId) {
      return [...byCredentialId.values()]
        .filter((p) => p.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(clone);
    },

    async findByCredentialId(credentialId) {
      const p = byCredentialId.get(credentialId);
      return p ? clone(p) : null;
    },

    async create(userId, data: CreatePasskeyData) {
      if (byCredentialId.has(data.credentialId)) {
        throw new Error(`[auth:in-memory] passkey ${data.credentialId} already exists`);
      }
      const passkey: Passkey = {
        credentialId: data.credentialId,
        userId,
        publicKey: new Uint8Array(data.publicKey),
        publicKeyAlg: data.publicKeyAlg,
        counter: data.counter,
        transports: data.transports ?? [],
        aaguid: data.aaguid,
        name: data.name ?? 'Passkey',
        createdAt: new Date(),
        lastUsedAt: null
      };
      byCredentialId.set(passkey.credentialId, passkey);
      return clone(passkey);
    },

    async updateCounter(credentialId, counter) {
      const p = byCredentialId.get(credentialId);
      if (!p) return false;
      if (counter === 0) {
        // Counterless authenticator — nothing to advance, just touch.
        p.lastUsedAt = new Date();
        return true;
      }
      // CAS: advance only if strictly higher; a concurrent replay with an
      // equal/lower counter advances nothing → false → caller rejects it.
      if (p.counter < counter) {
        p.counter = counter;
        p.lastUsedAt = new Date();
        return true;
      }
      return false;
    },

    async delete(userId, credentialId) {
      const p = byCredentialId.get(credentialId);
      // Scope to userId: another user must not delete this credential.
      if (p && p.userId === userId) byCredentialId.delete(credentialId);
    },

    async rename(userId, credentialId, name) {
      const p = byCredentialId.get(credentialId);
      if (p && p.userId === userId) p.name = name;
    }
  };
}

// --- Refresh token -----------------------------------------------------------

/**
 * In-memory default for `RefreshTokenRepository`. Suitable only for single-process
 * deployments and tests — production consumers should pass a persistent
 * implementation (Prisma, Redis, etc.) via `repos.refreshToken`.
 */
export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  const byId = new Map<string, RefreshTokenRecord>();
  const byHash = new Map<string, string>();

  // Reads (and create's echo) return a fully detached copy — same doctrine as
  // `cloneUser` above: a caller mutating a returned record or one of its Dates
  // must never corrupt the live store entry.
  const cloneRecord = (r: RefreshTokenRecord): RefreshTokenRecord => ({
    ...r,
    expiresAt: new Date(r.expiresAt),
    revokedAt: r.revokedAt ? new Date(r.revokedAt) : null,
    createdAt: new Date(r.createdAt)
  });

  return {
    async create(data: CreateRefreshTokenData): Promise<RefreshTokenRecord> {
      const record: RefreshTokenRecord = {
        id: randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        family: data.family,
        expiresAt: new Date(data.expiresAt),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null
      };
      byId.set(record.id, record);
      byHash.set(record.tokenHash, record.id);
      return cloneRecord(record);
    },

    async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
      const id = byHash.get(tokenHash);
      if (!id) return null;
      const record = byId.get(id);
      return record ? cloneRecord(record) : null;
    },

    async revoke(id: string, replacedById?: string | null): Promise<boolean> {
      const record = byId.get(id);
      // CAS: only the first caller to see a live token wins. Single-threaded
      // JS makes this check-and-set atomic (no await between read and write).
      if (!record || record.revokedAt) return false;
      record.revokedAt = new Date();
      record.replacedById = replacedById ?? null;
      return true;
    },

    async revokeFamily(family: string): Promise<void> {
      const now = new Date();
      for (const record of byId.values()) {
        if (record.family === family && !record.revokedAt) {
          record.revokedAt = now;
        }
      }
    },

    async revokeAllForUser(userId: string): Promise<void> {
      const now = new Date();
      for (const record of byId.values()) {
        if (record.userId === userId && !record.revokedAt) {
          record.revokedAt = now;
        }
      }
    },

    async deleteExpired(): Promise<number> {
      const now = Date.now();
      let deleted = 0;
      for (const [id, record] of byId) {
        if (record.expiresAt.getTime() < now) {
          byId.delete(id);
          byHash.delete(record.tokenHash);
          deleted++;
        }
      }
      return deleted;
    },

    async listActiveByUser(userId: string): Promise<RefreshTokenRecord[]> {
      const now = Date.now();
      return [...byId.values()]
        .filter((r) => r.userId === userId && !r.revokedAt && r.expiresAt.getTime() > now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(cloneRecord);
    },

    async revokeFamilyForUser(userId: string, family: string): Promise<boolean> {
      const now = new Date();
      let revoked = false;
      // Ownership-scoped: only revoke live tokens that are BOTH this family and
      // this user's. A foreign family id touches nothing → returns false.
      for (const record of byId.values()) {
        if (record.userId === userId && record.family === family && !record.revokedAt) {
          record.revokedAt = now;
          revoked = true;
        }
      }
      return revoked;
    },

    async revokeOtherFamiliesForUser(userId: string, keepFamily: string): Promise<void> {
      const now = new Date();
      for (const record of byId.values()) {
        if (record.userId === userId && record.family !== keepFamily && !record.revokedAt) {
          record.revokedAt = now;
        }
      }
    }
  };
}

// --- Two-factor backup codes -----------------------------------------------

interface StoredBackupCode {
  userId: string;
  codeHash: string;
  usedAt: Date | null;
}

export function createInMemoryBackupCodeRepository(): BackupCodeRepository {
  const codes: StoredBackupCode[] = [];

  return {
    async createMany(userId, codeHashes) {
      for (const codeHash of codeHashes) codes.push({ userId, codeHash, usedAt: null });
    },

    async consumeIfUnused(userId, codeHash) {
      // Atomic single-use claim: find an unused, owner-scoped match and flip it
      // with no await in between, so two concurrent redemptions can't both win.
      const row = codes.find(
        (c) => c.userId === userId && c.codeHash === codeHash && c.usedAt === null
      );
      if (!row) return false;
      row.usedAt = new Date();
      return true;
    },

    async deleteAll(userId) {
      for (let i = codes.length - 1; i >= 0; i--) {
        if (codes[i].userId === userId) codes.splice(i, 1);
      }
    }
  };
}
