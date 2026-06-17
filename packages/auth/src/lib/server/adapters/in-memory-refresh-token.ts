import { randomUUID } from 'node:crypto';
import type {
  CreateRefreshTokenData,
  RefreshTokenRecord,
  RefreshTokenRepository
} from './types.js';

/**
 * In-memory default for `RefreshTokenRepository`. Suitable only for single-process
 * deployments and tests — production consumers should pass a persistent
 * implementation (Prisma, Redis, etc.) via `repos.refreshToken`.
 */
export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  const byId = new Map<string, RefreshTokenRecord>();
  const byHash = new Map<string, string>();

  return {
    async create(data: CreateRefreshTokenData): Promise<RefreshTokenRecord> {
      const record: RefreshTokenRecord = {
        id: randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        family: data.family,
        expiresAt: data.expiresAt,
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null
      };
      byId.set(record.id, record);
      byHash.set(record.tokenHash, record.id);
      return record;
    },

    async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
      const id = byHash.get(tokenHash);
      if (!id) return null;
      return byId.get(id) ?? null;
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
        .map((r) => ({ ...r }));
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
