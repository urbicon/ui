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
  FederatedAccount,
  FederatedAccountRepository,
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

// --- Store -----------------------------------------------------------------

// Rows keep `invitedById` (like a real table) so `user.delete` can erase the
// invitations a user sent; the contract-facing reads project it away (the
// `Invitation` type deliberately excludes it).
interface StoredInvitation extends Invitation {
  invitedById: string;
  /** Projected away by the contract-facing reads — the hash never leaves here. */
  tokenHash: string;
}

interface StoredPushSubscription extends PushSubscriptionData {
  userId: string;
}

interface StoredPreference extends NotificationPreference {
  userId: string;
}

interface StoredBackupCode {
  userId: string;
  codeHash: string;
  usedAt: Date | null;
}

/** Every table of the adapter, one row map (plus its unique indexes) each. */
interface Tables<R extends string> {
  users: Map<string, FullAuthUser<R>>;
  usersByEmail: Map<string, string>; // email → id (enforces @unique)
  invitations: Map<string, StoredInvitation>;
  invitationsByEmail: Map<string, string>; // email → id (enforces @unique)
  invitationsByTokenHash: Map<string, string>; // tokenHash → id (also @unique)
  notifications: Map<string, NotificationRecord>;
  pushSubscriptions: Map<string, StoredPushSubscription>; // endpoint is globally @unique
  notificationPreferences: Map<string, StoredPreference>; // `${userId}:${typeKey}` → pref
  passkeys: Map<string, Passkey>; // by credentialId
  refreshTokens: Map<string, RefreshTokenRecord>;
  refreshTokensByHash: Map<string, string>;
  backupCodes: StoredBackupCode[];
  federatedAccounts: Map<string, FederatedAccount>; // JSON.stringify([issuer, subject]) → row
}

const TABLES: unique symbol = Symbol('auth:in-memory-store');

/**
 * The database behind the in-memory adapter — one handle, every table.
 *
 * Every `createInMemory*Repository(store)` factory is a view on the store it
 * is given: repositories built on the same store share rows, and
 * `user.delete` erases a user's dependents from every table of that store.
 * Rows on a different store are as far away as another database. The handle
 * exposes no state of its own; `createInMemoryStore()` is the only way to get
 * one.
 */
export interface InMemoryStore<R extends string = string> {
  readonly [TABLES]: Tables<R>;
}

export function createInMemoryStore<R extends string = string>(): InMemoryStore<R> {
  return {
    [TABLES]: {
      users: new Map(),
      usersByEmail: new Map(),
      invitations: new Map(),
      invitationsByEmail: new Map(),
      invitationsByTokenHash: new Map(),
      notifications: new Map(),
      pushSubscriptions: new Map(),
      notificationPreferences: new Map(),
      passkeys: new Map(),
      refreshTokens: new Map(),
      refreshTokensByHash: new Map(),
      backupCodes: [],
      federatedAccounts: new Map()
    }
  };
}

function tablesOf<R extends string>(store: InMemoryStore<R>): Tables<R> {
  const tables = store?.[TABLES];
  if (!tables) {
    throw new Error(
      '[auth:in-memory] not a store handle — pass the value returned by createInMemoryStore()'
    );
  }
  return tables;
}

/**
 * In-memory implementation of the full {@link Repositories} contract: a fresh
 * {@link createInMemoryStore} with every repository built on it.
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
  const store = createInMemoryStore<R>();
  return {
    user: createInMemoryUserRepository(store),
    invitation: createInMemoryInvitationRepository(store),
    notification: createInMemoryNotificationRepository(store),
    pushSubscription: createInMemoryPushSubscriptionRepository(store),
    notificationPreference: createInMemoryNotificationPreferenceRepository(store),
    passkey: createInMemoryPasskeyRepository(store),
    refreshToken: createInMemoryRefreshTokenRepository(store),
    backupCode: createInMemoryBackupCodeRepository(store),
    federatedAccount: createInMemoryFederatedAccountRepository(store)
  };
}

// --- User ------------------------------------------------------------------

/**
 * The `onDelete: Cascade` of this store: every row that hangs off `userId`,
 * from every table, in one synchronous sweep — so nothing can interleave
 * between the user row going and its dependents going. Erasure, not
 * revocation: a revoked refresh token still holds the `ip` and `userAgent` it
 * was issued with.
 */
function eraseDependents<R extends string>(t: Tables<R>, userId: string): void {
  for (const [id, inv] of t.invitations) {
    if (inv.invitedById === userId) {
      t.invitations.delete(id);
      t.invitationsByEmail.delete(inv.email);
      t.invitationsByTokenHash.delete(inv.tokenHash);
    }
  }
  for (const [id, n] of t.notifications) if (n.userId === userId) t.notifications.delete(id);
  for (const [endpoint, s] of t.pushSubscriptions) {
    if (s.userId === userId) t.pushSubscriptions.delete(endpoint);
  }
  for (const [key, p] of t.notificationPreferences) {
    if (p.userId === userId) t.notificationPreferences.delete(key);
  }
  for (const [credentialId, p] of t.passkeys) {
    if (p.userId === userId) t.passkeys.delete(credentialId);
  }
  for (const [id, r] of t.refreshTokens) {
    if (r.userId === userId) {
      t.refreshTokens.delete(id);
      t.refreshTokensByHash.delete(r.tokenHash);
    }
  }
  for (let i = t.backupCodes.length - 1; i >= 0; i--) {
    if (t.backupCodes[i].userId === userId) t.backupCodes.splice(i, 1);
  }
  for (const [k, row] of t.federatedAccounts) {
    if (row.userId === userId) t.federatedAccounts.delete(k);
  }
}

export function createInMemoryUserRepository<R extends string = string>(
  store: InMemoryStore<R>
): UserRepository<R> {
  const t = tablesOf(store);
  const byId = t.users;
  const byEmail = t.usersByEmail;

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

  const clearFailedLogins = (u: FullAuthUser<R>): void => {
    u.failedLoginAttempts = 0;
    u.lockedUntil = null;
    u.lastFailedLogin = null;
  };

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
      if (u) clearFailedLogins(u);
    },

    async resetFailedLoginsIfStale(id, cutoff) {
      const u = byId.get(id);
      // Guard and write with no await between them: a failure recorded after
      // the caller's read has re-dated the row past `cutoff`, and the reset
      // must then leave it — and the lock it may carry — untouched.
      if (!u?.lastFailedLogin || u.lastFailedLogin > cutoff) return;
      clearFailedLogins(u);
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
      // The contract's delete-cascade MUST (types.ts): every dependent row on
      // this store goes with the user, the end state a relational adapter gets
      // from `onDelete: Cascade` plus its explicit transaction for the
      // invitations the user *sent*. A missing user still sweeps the
      // dependents — the same idempotent no-op as `deleteMany`.
      eraseDependents(t, id);
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

export function createInMemoryInvitationRepository<R extends string = string>(
  store: InMemoryStore<R>
): InvitationRepository {
  const t = tablesOf(store);
  const byId = t.invitations;
  const byEmail = t.invitationsByEmail;
  const byTokenHash = t.invitationsByTokenHash;

  const project = (inv: StoredInvitation): Invitation => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    usedAt: inv.usedAt,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    emailedAt: inv.emailedAt
  });

  return {
    async findByTokenHash(tokenHash) {
      const id = byTokenHash.get(tokenHash);
      const inv = id ? byId.get(id) : undefined;
      return inv ? project(inv) : null;
    },

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

    async markEmailed(id, at) {
      // Silent no-op for a missing id, per the missing-target contract.
      const inv = byId.get(id);
      if (inv) inv.emailedAt = at;
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
        createdAt: new Date(),
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        emailedAt: null
      };
      byId.set(inv.id, inv);
      byEmail.set(inv.email, inv.id);
      byTokenHash.set(inv.tokenHash, inv.id);
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
        // Not a safety property — `findByTokenHash` resolves through `byId`, so a
        // stale entry here would miss anyway. This is a plain map-leak fix: the
        // process would otherwise hold one string per invitation ever revoked.
        byTokenHash.delete(inv.tokenHash);
      }
    }
  };
}

// --- Notification ----------------------------------------------------------

export function createInMemoryNotificationRepository<R extends string = string>(
  store: InMemoryStore<R>
): NotificationRepository {
  const byId = tablesOf(store).notifications;

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

export function createInMemoryPushSubscriptionRepository<R extends string = string>(
  store: InMemoryStore<R>
): PushSubscriptionRepository {
  const byEndpoint = tablesOf(store).pushSubscriptions;

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

export function createInMemoryNotificationPreferenceRepository<R extends string = string>(
  store: InMemoryStore<R>
): NotificationPreferenceRepository {
  const byKey = tablesOf(store).notificationPreferences;

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

export function createInMemoryPasskeyRepository<R extends string = string>(
  store: InMemoryStore<R>
): PasskeyRepository {
  const byCredentialId = tablesOf(store).passkeys;

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
 * In-memory `RefreshTokenRepository`. Suitable only for single-process
 * deployments and tests — production consumers should pass a persistent
 * implementation (Prisma, Redis, etc.) via `repos.refreshToken`.
 */
export function createInMemoryRefreshTokenRepository<R extends string = string>(
  store: InMemoryStore<R>
): RefreshTokenRepository {
  const t = tablesOf(store);
  const byId = t.refreshTokens;
  const byHash = t.refreshTokensByHash;

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

export function createInMemoryBackupCodeRepository<R extends string = string>(
  store: InMemoryStore<R>
): BackupCodeRepository {
  const codes = tablesOf(store).backupCodes;

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

// --- Federated accounts ----------------------------------------------------

export function createInMemoryFederatedAccountRepository<R extends string = string>(
  store: InMemoryStore<R>
): FederatedAccountRepository {
  const links = tablesOf(store).federatedAccounts;
  // Collision-proof composite key — issuer/subject are consumer-provided
  // strings, so a naive `${issuer}:${subject}` join could be forged across
  // the boundary; JSON.stringify keeps the pair unambiguous.
  const key = (issuer: string, subject: string) => JSON.stringify([issuer, subject]);

  return {
    async findByFederatedId(issuer, subject) {
      const row = links.get(key(issuer, subject));
      return row ? { ...row } : null;
    },

    async linkFederatedAccount(userId, identity) {
      // Read + conditional write with no await in between (see the atomicity
      // note on this module): two concurrent links of the same pair serialize,
      // exactly one creates — the other sees the winner below.
      const k = key(identity.issuer, identity.subject);
      const existing = links.get(k);
      if (existing) {
        // Idempotent for the same user; a different user must never silently
        // take the link over (account-takeover primitive — see the contract).
        if (existing.userId === userId) return { ...existing };
        throw new Error(
          '[auth] linkFederatedAccount: this federated identity is already linked to a different user — refusing to re-link (unlink it explicitly first via unlinkFederatedAccount).'
        );
      }
      const row: FederatedAccount = {
        issuer: identity.issuer,
        subject: identity.subject,
        userId,
        createdAt: new Date()
      };
      links.set(k, row);
      return { ...row };
    },

    async unlinkFederatedAccount(userId, identity) {
      // Owner-scoped conditional delete with no await between read and write
      // (see the atomicity note on this module) — a non-owner can never free
      // the pair for a takeover re-link.
      const k = key(identity.issuer, identity.subject);
      const existing = links.get(k);
      if (!existing || existing.userId !== userId) return false;
      links.delete(k);
      return true;
    }
  };
}
