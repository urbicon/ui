/**
 * In-memory wiring for the `/test-fixtures/auth/*` routes exercised by the
 * E2E auth suite. Not shipped to users — this file is a test harness that
 * lets Playwright walk through the full auth flow (register → login →
 * protected route → rotation → logout) without needing a real database.
 *
 * State lives in module scope, so routes in the same Node process share
 * it. A `POST /test-fixtures/auth/api/reset` handler seeds a fresh world
 * between tests.
 */

import { randomUUID } from 'node:crypto';
import type {
  CreateInvitationData,
  CreateUserData,
  FullAuthUser,
  Invitation,
  InvitationRepository,
  Repositories,
  UserRepository
} from '@urbicon-ui/auth/server';
import {
  type AuthDeps,
  createAuthDeps,
  createInMemoryRefreshTokenRepository,
  hashPassword
} from '@urbicon-ui/auth/server';

type AppRole = 'ADMIN' | 'USER';

const store = {
  users: new Map<string, FullAuthUser<AppRole>>(),
  usersByEmail: new Map<string, string>(),
  invitations: new Map<string, Invitation>(),
  invitationsByEmail: new Map<string, string>()
};

const refreshRepo = createInMemoryRefreshTokenRepository();

function makeUserRepo(): UserRepository<AppRole> {
  return {
    async findById(id) {
      return store.users.get(id) ?? null;
    },
    async findByEmail(email) {
      const id = store.usersByEmail.get(email);
      return id ? (store.users.get(id) ?? null) : null;
    },
    async create(data: CreateUserData<AppRole>) {
      const id = randomUUID();
      const user: FullAuthUser<AppRole> = {
        id,
        email: data.email,
        name: data.name,
        role: data.role,
        emailVerified: data.emailVerified ?? false,
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
        totpEnabled: false,
        totpConfirmedAt: null
      };
      store.users.set(id, user);
      store.usersByEmail.set(data.email, id);
      return {
        id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled
      };
    },
    async updatePassword(id, passwordHash) {
      const user = store.users.get(id);
      if (user) user.passwordHash = passwordHash;
    },
    async setEmailVerified(id) {
      const user = store.users.get(id);
      if (user) user.emailVerified = true;
    },
    async setVerificationToken(id, tokenHash, expires) {
      const user = store.users.get(id);
      if (user) {
        user.verificationToken = tokenHash;
        user.verificationTokenExpires = expires;
      }
    },
    async consumeVerificationToken(tokenHash) {
      // Atomic single-use claim (mirrors the in-memory adapter): find + clear +
      // set emailVerified with no await between read and write.
      for (const user of store.users.values()) {
        if (user.verificationToken === tokenHash) {
          const expired =
            user.verificationTokenExpires != null && user.verificationTokenExpires <= new Date();
          user.verificationToken = null;
          user.verificationTokenExpires = null;
          if (expired) return null;
          user.emailVerified = true;
          return user;
        }
      }
      return null;
    },
    async setPasswordResetToken(id, tokenHash, expires) {
      const user = store.users.get(id);
      if (user) {
        user.passwordResetToken = tokenHash;
        user.passwordResetTokenExpires = expires;
      }
    },
    async consumeResetToken(tokenHash) {
      // Atomic single-use claim (mirrors the in-memory adapter).
      for (const user of store.users.values()) {
        if (user.passwordResetToken === tokenHash) {
          const expired =
            user.passwordResetTokenExpires != null && user.passwordResetTokenExpires <= new Date();
          user.passwordResetToken = null;
          user.passwordResetTokenExpires = null;
          if (expired) return null;
          return user;
        }
      }
      return null;
    },
    async incrementTokenVersion(id) {
      const user = store.users.get(id);
      if (user) user.tokenVersion += 1;
    },
    async getFailedLoginAttempts(id) {
      const user = store.users.get(id);
      return {
        count: user?.failedLoginAttempts ?? 0,
        lockedUntil: user?.lockedUntil ?? null,
        lastFailedAt: user?.lastFailedLogin ?? null
      };
    },
    async recordFailedLogin(id) {
      const user = store.users.get(id);
      if (user) {
        user.failedLoginAttempts += 1;
        user.lastFailedLogin = new Date();
      }
    },
    async resetFailedLogins(id) {
      const user = store.users.get(id);
      if (user) {
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.lastFailedLogin = null;
      }
    },
    async updateProfile(id, data) {
      const user = store.users.get(id);
      // Only the provided keys — an absent key leaves the column untouched.
      if (user && data.name !== undefined) user.name = data.name;
    },
    async setEmailChangeToken(id, pendingEmail, tokenHash, expires) {
      const user = store.users.get(id);
      if (user) {
        user.pendingEmail = pendingEmail;
        user.emailChangeToken = tokenHash;
        user.emailChangeTokenExpires = expires;
      }
    },
    async consumeEmailChangeToken(tokenHash) {
      // Atomic single-use claim (mirrors the in-memory adapter): find + clear +
      // email swap with no await between read and write.
      for (const user of store.users.values()) {
        if (user.emailChangeToken !== tokenHash) continue;
        if (user.pendingEmail == null) return null;
        const expired =
          user.emailChangeTokenExpires != null && user.emailChangeTokenExpires <= new Date();
        if (expired) {
          user.pendingEmail = null;
          user.emailChangeToken = null;
          user.emailChangeTokenExpires = null;
          return null;
        }
        // Respect email uniqueness: a collision is a failed claim, not a duplicate.
        const conflictId = store.usersByEmail.get(user.pendingEmail);
        if (conflictId != null && conflictId !== user.id) {
          user.pendingEmail = null;
          user.emailChangeToken = null;
          user.emailChangeTokenExpires = null;
          return null;
        }
        store.usersByEmail.delete(user.email);
        user.email = user.pendingEmail;
        store.usersByEmail.set(user.email, user.id);
        user.emailVerified = true;
        user.pendingEmail = null;
        user.emailChangeToken = null;
        user.emailChangeTokenExpires = null;
        return user;
      }
      return null;
    },
    async delete(id) {
      const user = store.users.get(id);
      if (!user) return;
      store.users.delete(id);
      store.usersByEmail.delete(user.email);
    },
    async setTotpSecret(id, encryptedSecret) {
      const user = store.users.get(id);
      if (user) {
        user.totpSecret = encryptedSecret;
        user.totpEnabled = false;
        user.totpConfirmedAt = null;
      }
    },
    async enableTotp(id) {
      const user = store.users.get(id);
      if (user) {
        user.totpEnabled = true;
        user.totpConfirmedAt = new Date();
      }
    },
    async disableTotp(id) {
      const user = store.users.get(id);
      if (user) {
        user.totpSecret = null;
        user.totpEnabled = false;
        user.totpConfirmedAt = null;
      }
    }
  };
}

function makeInvitationRepo(): InvitationRepository {
  return {
    async findByEmail(email) {
      const id = store.invitationsByEmail.get(email);
      return id ? (store.invitations.get(id) ?? null) : null;
    },
    async markUsedIfUnused(id) {
      // CAS: flip usedAt null→now only if still unused; return whether we won.
      const inv = store.invitations.get(id);
      if (inv && inv.usedAt === null) {
        inv.usedAt = new Date();
        return true;
      }
      return false;
    },
    async create(data: CreateInvitationData) {
      const id = randomUUID();
      const inv: Invitation = {
        id,
        email: data.email,
        role: data.role,
        usedAt: null,
        createdAt: new Date()
      };
      store.invitations.set(id, inv);
      store.invitationsByEmail.set(data.email, id);
      return inv;
    },
    async list() {
      return Array.from(store.invitations.values());
    },
    async delete(id) {
      const inv = store.invitations.get(id);
      if (inv) {
        store.invitations.delete(id);
        store.invitationsByEmail.delete(inv.email);
      }
    }
  };
}

export const testAuthRepos: Repositories<AppRole> = {
  user: makeUserRepo(),
  invitation: makeInvitationRepo(),
  refreshToken: refreshRepo
};

export const testAuthDeps: AuthDeps<AppRole> = createAuthDeps<AppRole>({
  config: {
    appUrl: 'http://localhost:5173',
    jwt: {
      secret: 'test-e2e-secret-do-not-use-in-prod',
      cookieSecure: false
    },
    refreshToken: {
      accessTokenTtl: '15m',
      refreshTokenTtl: '30d',
      cookieSecure: false
    },
    routes: {
      afterLogin: '/test-fixtures/auth/protected',
      loginPage: '/test-fixtures/auth/login'
    }
  },
  repos: testAuthRepos,
  email: {
    async send() {
      // e2e harness: drop emails on the floor.
    }
  }
});

/** Seed the world for a fresh test run. */
export async function resetTestAuthWorld(): Promise<void> {
  store.users.clear();
  store.usersByEmail.clear();
  store.invitations.clear();
  store.invitationsByEmail.clear();

  const inviter = await testAuthRepos.user.create({
    email: 'seed-admin@test.local',
    name: 'Seed Admin',
    role: 'ADMIN',
    passwordHash: await hashPassword('admin-pass-123'),
    emailVerified: true
  });

  await testAuthRepos.invitation.create({
    email: 'alice@test.local',
    role: 'USER',
    invitedById: inviter.id
  });
}
