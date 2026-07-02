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
 * `PrismaLike` intentionally leaves return values untyped — every consumer's
 * Prisma client generates its own row shapes from its schema. The adapter
 * implementations cast inside the methods, so a permissive return type
 * (`PrismaRow`) avoids the `Promise<PrismaRow>` cascade through every call.
 */
// biome-ignore lint/suspicious/noExplicitAny: Prisma rows are consumer-schema-specific; a permissive alias avoids a Promise<PrismaRow> cast cascade (see above).
type PrismaRow = any;

export interface PrismaLike {
  user: {
    findUnique: (args: unknown) => Promise<PrismaRow>;
    create: (args: unknown) => Promise<PrismaRow>;
    update: (args: unknown) => Promise<PrismaRow>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  invitation: {
    findUnique: (args: unknown) => Promise<PrismaRow>;
    findMany: (args?: unknown) => Promise<PrismaRow>;
    create: (args: unknown) => Promise<PrismaRow>;
    update: (args: unknown) => Promise<PrismaRow>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    delete: (args: unknown) => Promise<PrismaRow>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  notification?: {
    findUnique: (args: unknown) => Promise<PrismaRow>;
    findMany: (args?: unknown) => Promise<PrismaRow>;
    create: (args: unknown) => Promise<PrismaRow>;
    update: (args: unknown) => Promise<PrismaRow>;
    updateMany: (args: unknown) => Promise<PrismaRow>;
    delete: (args: unknown) => Promise<PrismaRow>;
    count: (args?: unknown) => Promise<number>;
  };
  pushSubscription?: {
    findUnique: (args: unknown) => Promise<PrismaRow>;
    findMany: (args?: unknown) => Promise<PrismaRow>;
    create: (args: unknown) => Promise<PrismaRow>;
    upsert: (args: unknown) => Promise<PrismaRow>;
    deleteMany: (args: unknown) => Promise<PrismaRow>;
  };
  notificationPreference?: {
    findMany: (args?: unknown) => Promise<PrismaRow>;
    upsert: (args: unknown) => Promise<PrismaRow>;
  };
  passkey?: {
    findMany: (args?: unknown) => Promise<PrismaRow>;
    findUnique: (args: unknown) => Promise<PrismaRow>;
    create: (args: unknown) => Promise<PrismaRow>;
    update: (args: unknown) => Promise<PrismaRow>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    delete: (args: unknown) => Promise<PrismaRow>;
  };
  refreshToken?: {
    findUnique: (args: unknown) => Promise<PrismaRow>;
    findMany: (args?: unknown) => Promise<PrismaRow>;
    create: (args: unknown) => Promise<PrismaRow>;
    update: (args: unknown) => Promise<PrismaRow>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<PrismaRow>;
  };
  twoFactorBackupCode?: {
    createMany: (args: unknown) => Promise<PrismaRow>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<PrismaRow>;
  };
  /**
   * Prisma's sequential (array-form) transaction. Used by `user.delete` to drop
   * the user's sent invitations and the user atomically. The real client takes
   * an array of lazy `PrismaPromise`s and runs them in one transaction; the
   * structural type stays permissive (`unknown[]`) at this boundary.
   */
  $transaction: (operations: unknown[]) => Promise<unknown[]>;
}

/**
 * Structural check for Prisma's unique-constraint error (`P2002`) — matched on
 * the `code` string so the adapter needs no value import from `@prisma/client`
 * (zero-dependency boundary). Used to tell a genuine "target email already
 * taken" collision apart from an unrelated DB fault.
 */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Structural check for Prisma's missing-row error (`P2025`). The repository
 * contract treats a write against a deleted user as a no-op (TOCTOU: the
 * account can vanish between the handler's read and this write) — most writes
 * use `updateMany` for that, but `recordFailedLogin` needs `update`'s returned
 * row for its atomic count and maps this error to the no-op instead.
 */
function isMissingRowError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2025'
  );
}

export function createPrismaUserRepository<R extends string>(
  prisma: PrismaLike
): UserRepository<R> {
  return {
    async findById(id) {
      const row = await prisma.user.findUnique({ where: { id } });
      return row ? mapUser<R>(row) : null;
    },

    async findByEmail(email) {
      const row = await prisma.user.findUnique({ where: { email } });
      return row ? mapUser<R>(row) : null;
    },

    async create(data: CreateUserData<R>) {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
          role: data.role,
          emailVerified: data.emailVerified ?? false,
          verificationToken: data.verificationToken ?? null,
          verificationTokenExpires: data.verificationTokenExpires ?? null
        }
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as R,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled ?? false
      };
    },

    async updatePassword(id, passwordHash) {
      // updateMany: a missing user is a contract no-op, not a P2025 throw.
      await prisma.user.updateMany({ where: { id }, data: { passwordHash } });
    },

    async setEmailVerified(id) {
      await prisma.user.updateMany({ where: { id }, data: { emailVerified: true } });
    },

    async setVerificationToken(id, tokenHash, expires) {
      await prisma.user.updateMany({
        where: { id },
        data: { verificationToken: tokenHash, verificationTokenExpires: expires }
      });
    },

    async consumeVerificationToken(tokenHash) {
      const now = new Date();
      const row = await prisma.user.findUnique({ where: { verificationToken: tokenHash } });
      if (!row) return null;
      // Atomic single-use claim: flip emailVerified + clear the token only if
      // the token still matches and has not expired. A null expiry means "no
      // expiry" (preserves prior behaviour). Concurrent verifies: the first
      // nulls the token, so the second matches nothing → count 0.
      const claimed = await prisma.user.updateMany({
        where: {
          id: row.id,
          verificationToken: tokenHash,
          OR: [{ verificationTokenExpires: null }, { verificationTokenExpires: { gt: now } }]
        },
        data: { emailVerified: true, verificationToken: null, verificationTokenExpires: null }
      });
      if (claimed.count !== 1) {
        // Expired (or lost the race): purge an expired artifact so it cannot linger.
        await prisma.user.updateMany({
          where: { id: row.id, verificationTokenExpires: { lte: now } },
          data: { verificationToken: null, verificationTokenExpires: null }
        });
        return null;
      }
      // Return the post-claim state, not the pre-read snapshot: the row we read
      // still said emailVerified:false / token set, but the claim just flipped
      // them. Patch the known mutations so callers see authoritative values.
      return mapUser<R>({
        ...row,
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null
      });
    },

    async setPasswordResetToken(id, tokenHash, expires) {
      await prisma.user.updateMany({
        where: { id },
        data: { passwordResetToken: tokenHash, passwordResetTokenExpires: expires }
      });
    },

    async consumeResetToken(tokenHash) {
      const now = new Date();
      const row = await prisma.user.findUnique({ where: { passwordResetToken: tokenHash } });
      if (!row) return null;
      // Atomic single-use claim: clear the token only if it still matches and
      // has not expired. The single-use guarantee lives here — a second
      // concurrent reset with the same token finds nothing to clear.
      const claimed = await prisma.user.updateMany({
        where: {
          id: row.id,
          passwordResetToken: tokenHash,
          OR: [{ passwordResetTokenExpires: null }, { passwordResetTokenExpires: { gt: now } }]
        },
        data: { passwordResetToken: null, passwordResetTokenExpires: null }
      });
      if (claimed.count !== 1) {
        await prisma.user.updateMany({
          where: { id: row.id, passwordResetTokenExpires: { lte: now } },
          data: { passwordResetToken: null, passwordResetTokenExpires: null }
        });
        return null;
      }
      // Return the post-claim state (token cleared), not the pre-read snapshot.
      return mapUser<R>({ ...row, passwordResetToken: null, passwordResetTokenExpires: null });
    },

    async incrementTokenVersion(id) {
      // Atomic increment (no read-modify-write) so parallel "logout everywhere"
      // invalidations cannot lose an increment. updateMany no-ops on a missing
      // row instead of throwing.
      await prisma.user.updateMany({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    },

    async getFailedLoginAttempts(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return {
        count: user?.failedLoginAttempts ?? 0,
        lockedUntil: user?.lockedUntil ?? null,
        lastFailedAt: user?.lastFailedLogin ?? null
      };
    },

    async recordFailedLogin(id, lockoutConfig) {
      // Atomic increment; Prisma returns the updated row so we can read the new
      // count without a separate read (which would race under credential
      // stuffing). `update` (not updateMany) is deliberate for that returned
      // row — the contract's missing-user no-op is mapped from P2025 below.
      let updated: PrismaRow;
      try {
        updated = await prisma.user.update({
          where: { id },
          data: { failedLoginAttempts: { increment: 1 }, lastFailedLogin: new Date() }
        });
      } catch (err) {
        if (isMissingRowError(err)) return; // user deleted concurrently — no-op
        throw err;
      }
      // Lock only when explicitly opted in and the threshold is crossed. The
      // lock write is GUARDED on the DB-side count (`failedLoginAttempts >=
      // maxAttempts`) via updateMany rather than blindly trusting the value we
      // just read — so concurrent failures can't set the lock based on a stale
      // count. Idempotent: repeated writes only push `lockedUntil` forward.
      //
      // Residual: a crash *between* the increment and this write leaves the
      // count over threshold with no lock. It is self-healing — the next failed
      // attempt re-crosses the threshold and sets the lock — and an attacker who
      // stops at exactly that point has gained nothing (no session), so we
      // accept it rather than pull in a transaction dependency.
      const maxAttempts = lockoutConfig?.maxAttempts ?? 5;
      if (lockoutConfig && updated.failedLoginAttempts >= maxAttempts) {
        const durationMs = (lockoutConfig.durationMinutes ?? 15) * 60_000;
        await prisma.user.updateMany({
          where: { id, failedLoginAttempts: { gte: maxAttempts } },
          data: { lockedUntil: new Date(Date.now() + durationMs) }
        });
      }
    },

    async resetFailedLogins(id) {
      await prisma.user.updateMany({
        where: { id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastFailedLogin: null }
      });
    },

    async updateProfile(id, data) {
      // Forward only the provided keys so a partial update never nulls a column
      // the caller didn't mean to touch. Skip the round-trip on an empty patch.
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (Object.keys(patch).length === 0) return;
      await prisma.user.updateMany({ where: { id }, data: patch });
    },

    async setEmailChangeToken(id, pendingEmail, tokenHash, expires) {
      await prisma.user.updateMany({
        where: { id },
        data: {
          pendingEmail,
          emailChangeToken: tokenHash,
          emailChangeTokenExpires: expires
        }
      });
    },

    async consumeEmailChangeToken(tokenHash) {
      const now = new Date();
      const row = await prisma.user.findUnique({ where: { emailChangeToken: tokenHash } });
      if (!row || row.pendingEmail == null) return null;
      // Capture the target before the claim: the write clears pendingEmail, and
      // we build the returned shape from it afterwards — reading row.pendingEmail
      // post-write would be stale.
      const target = row.pendingEmail as string;
      try {
        // Atomic single-use claim: swap email→pendingEmail, mark verified (the
        // new address proved control by clicking the link) and clear the pending
        // fields, only while the token still matches and hasn't expired. The DB
        // `email` unique constraint is the collision guard — if the target was
        // taken between request and confirm, this write throws (caught below).
        const claimed = await prisma.user.updateMany({
          where: {
            id: row.id,
            emailChangeToken: tokenHash,
            OR: [{ emailChangeTokenExpires: null }, { emailChangeTokenExpires: { gt: now } }]
          },
          data: {
            email: target,
            emailVerified: true,
            pendingEmail: null,
            emailChangeToken: null,
            emailChangeTokenExpires: null
          }
        });
        if (claimed.count !== 1) {
          // Expired or lost the race → purge an expired artifact so it can't linger.
          await prisma.user.updateMany({
            where: { id: row.id, emailChangeTokenExpires: { lte: now } },
            data: { pendingEmail: null, emailChangeToken: null, emailChangeTokenExpires: null }
          });
          return null;
        }
        // Post-claim state, not the pre-read snapshot.
        return mapUser<R>({
          ...row,
          email: target,
          emailVerified: true,
          pendingEmail: null,
          emailChangeToken: null,
          emailChangeTokenExpires: null
        });
      } catch (err) {
        // ONLY a unique-constraint violation (P2002) on `email` means the target
        // address was claimed since the request → a failed claim. Anything else
        // (connection drop, timeout, schema drift) is a real fault that must NOT
        // masquerade as an "invalid link", so rethrow it as the honest 500.
        if (!isUniqueConstraintError(err)) throw err;
        // Clear the now-doomed pending change so the user isn't stuck on a dead
        // token; a secondary failure here is opportunistic and must not mask the
        // P2002 we're reporting as a failed claim.
        try {
          await prisma.user.updateMany({
            where: { id: row.id, emailChangeToken: tokenHash },
            data: { pendingEmail: null, emailChangeToken: null, emailChangeTokenExpires: null }
          });
        } catch {
          /* cleanup is best-effort */
        }
        return null;
      }
    },

    async delete(id) {
      // Hard-delete (GDPR erasure). Invitations the user *sent* have an
      // `invitedBy` FK with no DB cascade, so remove them first, then the user,
      // in one transaction so the two can't diverge. The remaining dependents
      // (passkeys, refresh tokens, notifications, push subscriptions,
      // preferences) are removed by the schema's `onDelete: Cascade`. deleteMany
      // (not delete) keeps it idempotent — a concurrent double-delete no-ops.
      await prisma.$transaction([
        prisma.invitation.deleteMany({ where: { invitedById: id } }),
        prisma.user.deleteMany({ where: { id } })
      ]);
    },

    async setTotpSecret(id, encryptedSecret) {
      // Stage the encrypted secret and force 2FA off until the setup code is
      // confirmed (enableTotp). Overwrites any prior secret.
      await prisma.user.updateMany({
        where: { id },
        data: { totpSecret: encryptedSecret, totpEnabled: false, totpConfirmedAt: null }
      });
    },

    async enableTotp(id) {
      await prisma.user.updateMany({
        where: { id },
        data: { totpEnabled: true, totpConfirmedAt: new Date() }
      });
    },

    async disableTotp(id) {
      // Clear the secret and the flags in one write. Backup codes live in their
      // own table — the caller also calls BackupCodeRepository.deleteAll.
      await prisma.user.updateMany({
        where: { id },
        data: { totpSecret: null, totpEnabled: false, totpConfirmedAt: null }
      });
    }
  };
}

export function createPrismaInvitationRepository(prisma: PrismaLike): InvitationRepository {
  return {
    async findByEmail(email) {
      const row = await prisma.invitation.findUnique({ where: { email } });
      return row ? mapInvitation(row) : null;
    },

    async markUsedIfUnused(id) {
      // Atomic claim: only the first caller flips usedAt from null to now.
      const result = await prisma.invitation.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: new Date() }
      });
      return result.count === 1;
    },

    async create(data: CreateInvitationData) {
      const row = await prisma.invitation.create({
        data: {
          email: data.email,
          role: data.role,
          invitedById: data.invitedById
        }
      });
      return mapInvitation(row);
    },

    async list() {
      const rows = await prisma.invitation.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map(mapInvitation);
    },

    async delete(id) {
      await prisma.invitation.delete({ where: { id } });
    }
  };
}

export function createPrismaNotificationRepository(
  prisma: PrismaLike
): NotificationRepository | undefined {
  if (!prisma.notification) return undefined;
  const notif = prisma.notification;

  return {
    async create(data: CreateNotificationData): Promise<NotificationRecord> {
      const row = await notif.create({ data });
      return mapNotification(row);
    },

    async findByUser(userId, options) {
      const rows = await notif.findMany({
        where: {
          userId,
          ...(options?.unreadOnly ? { readAt: null } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit
      });
      return rows.map(mapNotification);
    },

    async markAsRead(id, userId) {
      await notif.update({
        where: { id, userId },
        data: { readAt: new Date() }
      });
    },

    async markAllAsRead(userId) {
      await notif.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() }
      });
    },

    async delete(id, userId) {
      await notif.delete({ where: { id, userId } });
    },

    async getUnreadCount(userId) {
      return notif.count({ where: { userId, readAt: null } });
    }
  };
}

export function createPrismaPushSubscriptionRepository(
  prisma: PrismaLike
): PushSubscriptionRepository | undefined {
  if (!prisma.pushSubscription) return undefined;
  const ps = prisma.pushSubscription;

  return {
    async findByUser(userId) {
      const rows = await ps.findMany({ where: { userId } });
      return rows.map(mapPushSubscription);
    },

    async create(userId, subscription: PushSubscriptionData) {
      // Upsert-by-endpoint per the repository contract: the browser re-sends
      // its existing subscription on every re-enable (a plain `create` would
      // 500 on the unique endpoint). Reassigning the endpoint to a DIFFERENT
      // user is gated on key possession: matching keys prove the caller holds
      // the browser subscription (user switch in the same browser); merely
      // knowing the endpoint URL must not take the row over.
      //
      // Read-then-write, made race-safe against the one interleaving that
      // would bypass the gate: a row APPEARING between our read and our write
      // (an unconditional upsert would then take its update branch and
      // reassign the fresh row ungated — silent-failure review M1). The
      // no-row path therefore uses a plain `create` and retries once on the
      // unique violation, re-running the gate against the row that won.
      // The existing-row path's residual window is harmless: only callers
      // that already passed the gate (owner or key possessor) ever reach the
      // write, so a row replaced inside the window was written by another
      // legitimate actor — last writer wins, same as serial execution.
      for (let attempt = 0; ; attempt++) {
        const existing = await ps.findUnique({ where: { endpoint: subscription.endpoint } });
        if (!existing) {
          try {
            await ps.create({
              data: { userId, endpoint: subscription.endpoint, keys: subscription.keys }
            });
            return 'created';
          } catch (err) {
            // Lost the insert race — loop once and gate against the winner.
            if (isUniqueConstraintError(err) && attempt === 0) continue;
            throw err;
          }
        }
        if (existing.userId !== userId && !pushKeysEqual(existing.keys ?? {}, subscription.keys)) {
          return 'rejected';
        }
        // Derive the outcome BEFORE the write: a client handing out live row
        // references (the conformance fake does; some Prisma-likes may) would
        // otherwise see `existing` mutated by the upsert.
        const outcome = existing.userId === userId ? 'updated' : 'reassigned';
        await ps.upsert({
          where: { endpoint: subscription.endpoint },
          create: { userId, endpoint: subscription.endpoint, keys: subscription.keys },
          update: { userId, keys: subscription.keys }
        });
        return outcome;
      }
    },

    async delete(userId, endpoint) {
      await ps.deleteMany({ where: { userId, endpoint } });
    }
  };
}

export function createPrismaNotificationPreferenceRepository(
  prisma: PrismaLike
): NotificationPreferenceRepository | undefined {
  if (!prisma.notificationPreference) return undefined;
  const np = prisma.notificationPreference;

  return {
    async findByUser(userId) {
      const rows = await np.findMany({ where: { userId } });
      return rows.map(mapNotificationPreference);
    },

    async upsert(userId, typeKey, prefs: PreferenceData) {
      await np.upsert({
        where: { userId_typeKey: { userId, typeKey } },
        create: {
          userId,
          typeKey,
          sse: prefs.sse ?? true,
          push: prefs.push ?? true,
          email: prefs.email ?? true
        },
        update: prefs
      });
    }
  };
}

export function createPrismaPasskeyRepository(prisma: PrismaLike): PasskeyRepository | undefined {
  if (!prisma.passkey) return undefined;
  const pk = prisma.passkey;

  return {
    async findByUserId(userId) {
      const rows = await pk.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
      return rows.map(mapPasskey);
    },

    async findByCredentialId(credentialId) {
      const row = await pk.findUnique({ where: { credentialId } });
      return row ? mapPasskey(row) : null;
    },

    async create(userId, data: CreatePasskeyData) {
      const row = await pk.create({
        data: {
          userId,
          credentialId: data.credentialId,
          publicKey: Buffer.from(data.publicKey),
          publicKeyAlg: data.publicKeyAlg,
          counter: data.counter,
          transports: data.transports ?? [],
          aaguid: data.aaguid,
          name: data.name ?? 'Passkey'
        }
      });
      return mapPasskey(row);
    },

    async updateCounter(credentialId, counter) {
      if (counter === 0) {
        // Authenticator keeps no signature counter — nothing to advance, just touch.
        await pk.update({ where: { credentialId }, data: { lastUsedAt: new Date() } });
        return true;
      }
      // CAS: advance only if the stored counter is strictly lower. A concurrent
      // replay with an equal/lower counter advances nothing → count 0 → caller
      // rejects it (closes the cloned-authenticator window).
      const result = await pk.updateMany({
        where: { credentialId, counter: { lt: counter } },
        data: { counter, lastUsedAt: new Date() }
      });
      return result.count === 1;
    },

    async updateLastUsed(credentialId) {
      await pk.update({ where: { credentialId }, data: { lastUsedAt: new Date() } });
    },

    async delete(credentialId, userId) {
      await pk.delete({ where: { credentialId, userId } });
    },

    async rename(credentialId, userId, name) {
      await pk.update({ where: { credentialId, userId }, data: { name } });
    }
  };
}

export function createPrismaRefreshTokenRepository(
  prisma: PrismaLike
): RefreshTokenRepository | undefined {
  if (!prisma.refreshToken) return undefined;
  const rt = prisma.refreshToken;

  return {
    async create(data: CreateRefreshTokenData): Promise<RefreshTokenRecord> {
      const row = await rt.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          family: data.family,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent ?? null,
          ip: data.ip ?? null
        }
      });
      return mapRefreshToken(row);
    },

    async findByHash(tokenHash) {
      const row = await rt.findUnique({ where: { tokenHash } });
      return row ? mapRefreshToken(row) : null;
    },

    async listActiveByUser(userId) {
      const rows = await rt.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' }
      });
      return rows.map(mapRefreshToken);
    },

    async revokeFamilyForUser(userId, family) {
      // Ownership-scoped CAS: revoke live tokens only when the family is this
      // user's. A foreign/guessed family matches no rows → count 0 → false.
      const result = await rt.updateMany({
        where: { userId, family, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return result.count > 0;
    },

    async revokeOtherFamiliesForUser(userId, keepFamily) {
      await rt.updateMany({
        where: { userId, family: { not: keepFamily }, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    },

    async revoke(id, replacedById) {
      // CAS: flip revokedAt null → now only if still live, returning whether
      // this call won. Lets rotation detect a concurrent revoke and roll back.
      const result = await rt.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: replacedById ?? null }
      });
      return result.count === 1;
    },

    async revokeFamily(family) {
      await rt.updateMany({
        where: { family, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    },

    async revokeAllForUser(userId) {
      await rt.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    },

    async deleteExpired() {
      const result = await rt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      return typeof result?.count === 'number' ? result.count : 0;
    }
  };
}

export function createPrismaBackupCodeRepository(
  prisma: PrismaLike
): BackupCodeRepository | undefined {
  if (!prisma.twoFactorBackupCode) return undefined;
  const bc = prisma.twoFactorBackupCode;

  return {
    async createMany(userId, codeHashes) {
      await bc.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) });
    },

    async consumeIfUnused(userId, codeHash) {
      // Atomic single-use claim, owner-scoped: flip usedAt null→now only while
      // the code is still unused. Two concurrent redemptions → exactly one
      // count === 1.
      const result = await bc.updateMany({
        where: { userId, codeHash, usedAt: null },
        data: { usedAt: new Date() }
      });
      return result.count === 1;
    },

    async deleteAll(userId) {
      await bc.deleteMany({ where: { userId } });
    }
  };
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  passwordHash: string;
  tokenVersion: number;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastFailedLogin?: Date | null;
  verificationToken?: string | null;
  verificationTokenExpires?: Date | null;
  passwordResetToken?: string | null;
  passwordResetTokenExpires?: Date | null;
  pendingEmail?: string | null;
  emailChangeToken?: string | null;
  emailChangeTokenExpires?: Date | null;
  totpEnabled?: boolean;
  totpSecret?: string | null;
  totpConfirmedAt?: Date | null;
}

/**
 * The typed seam for user reads. Casting the permissive `PrismaRow` to the
 * internal `FullAuthUser` shape *here* (rather than letting the row flow out
 * untyped) means a schema missing a required column — say `tokenVersion` —
 * surfaces as a TypeScript error against `UserRow`, not as a silent `any`.
 */
function mapUser<R extends string>(row: UserRow): FullAuthUser<R> {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as R,
    emailVerified: row.emailVerified,
    totpEnabled: row.totpEnabled ?? false,
    passwordHash: row.passwordHash,
    tokenVersion: row.tokenVersion,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil ?? null,
    lastFailedLogin: row.lastFailedLogin ?? null,
    verificationToken: row.verificationToken ?? null,
    verificationTokenExpires: row.verificationTokenExpires ?? null,
    passwordResetToken: row.passwordResetToken ?? null,
    passwordResetTokenExpires: row.passwordResetTokenExpires ?? null,
    pendingEmail: row.pendingEmail ?? null,
    emailChangeToken: row.emailChangeToken ?? null,
    emailChangeTokenExpires: row.emailChangeTokenExpires ?? null,
    totpSecret: row.totpSecret ?? null,
    totpConfirmedAt: row.totpConfirmedAt ?? null
  };
}

interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedById?: string | null;
  createdAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}

function mapRefreshToken(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    family: row.family,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt ?? null,
    replacedById: row.replacedById ?? null,
    createdAt: row.createdAt,
    userAgent: row.userAgent ?? null,
    ip: row.ip ?? null
  };
}

interface PasskeyRow {
  credentialId: string;
  userId: string;
  publicKey: Uint8Array | ArrayBufferLike | number[];
  publicKeyAlg: number;
  counter: number;
  transports?: string[];
  aaguid?: string;
  name?: string;
  createdAt: Date;
  lastUsedAt?: Date | null;
}

function mapPasskey(row: PasskeyRow): Passkey {
  return {
    credentialId: row.credentialId,
    userId: row.userId,
    publicKey:
      row.publicKey instanceof Uint8Array
        ? row.publicKey
        : new Uint8Array(row.publicKey as ArrayBuffer),
    publicKeyAlg: row.publicKeyAlg,
    counter: row.counter,
    transports: row.transports ?? [],
    aaguid: row.aaguid ?? '',
    name: row.name ?? '',
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null
  };
}

interface NotificationRow {
  id: string;
  userId: string;
  typeKey: string;
  title: string;
  body?: string | null;
  url?: string | null;
  icon?: string | null;
  readAt?: Date | null;
  createdAt: Date;
}

/**
 * Typed seam for notification reads — same rationale as {@link mapUser}: a
 * schema missing `typeKey`/`createdAt` surfaces as a TypeScript error against
 * `NotificationRow` here, not as a silent `any` flowing out to the service.
 */
function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    typeKey: row.typeKey,
    title: row.title,
    body: row.body ?? null,
    url: row.url ?? null,
    icon: row.icon ?? null,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt
  };
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  usedAt?: Date | null;
  createdAt: Date;
}

/**
 * Typed seam for invitation reads (see {@link mapUser}) — and a deliberate
 * projection: invitation results are serialized straight into the admin HTTP
 * response by `createInvitationHandlers`, so without this seam `invitedById`
 * and every consumer extra column on the table would leak to the client.
 */
function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    usedAt: row.usedAt ?? null,
    createdAt: row.createdAt
  };
}

interface PushSubscriptionRow {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Typed seam for push-subscription reads. Also narrows the row to exactly the
 * `{ endpoint, keys }` the push sender needs — extra columns (id, userId,
 * createdAt) do not leak into the returned shape.
 */
function mapPushSubscription(row: PushSubscriptionRow): PushSubscriptionData {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.keys.p256dh, auth: row.keys.auth }
  };
}

interface NotificationPreferenceRow {
  typeKey: string;
  sse: boolean;
  push: boolean;
  email: boolean;
}

/** Typed seam for notification-preference reads (see {@link mapUser}). */
function mapNotificationPreference(row: NotificationPreferenceRow): NotificationPreference {
  return {
    typeKey: row.typeKey,
    sse: row.sse,
    push: row.push,
    email: row.email
  };
}

export function createPrismaRepos<R extends string>(prisma: PrismaLike): Repositories<R> {
  return {
    user: createPrismaUserRepository<R>(prisma),
    invitation: createPrismaInvitationRepository(prisma),
    notification: createPrismaNotificationRepository(prisma),
    pushSubscription: createPrismaPushSubscriptionRepository(prisma),
    notificationPreference: createPrismaNotificationPreferenceRepository(prisma),
    passkey: createPrismaPasskeyRepository(prisma),
    refreshToken: createPrismaRefreshTokenRepository(prisma),
    backupCode: createPrismaBackupCodeRepository(prisma)
  };
}
