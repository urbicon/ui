/* eslint-disable @typescript-eslint/no-explicit-any */
// The fake Prisma client below mirrors the real `PrismaLike` boundary, which is
// deliberately `unknown`-in / `any`-out (see adapters/prisma.ts). Typing the
// fake's query args precisely would re-leak the row model the boundary exists
// to hide, so `any` is the pragmatic, intentional choice here.

import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  type ConformanceHarness,
  conformanceChecks,
  describeRepositoryConformance
} from './conformance.js';
import { createInMemoryRepos } from './in-memory.js';
import { createPrismaRepos, type PrismaLike } from './prisma.js';
import type { FullAuthUser, UserRepository } from './types.js';

const ALL_CAPS = {
  refreshToken: true,
  passkey: true,
  notification: true,
  pushSubscription: true,
  notificationPreference: true,
  backupCode: true
} as const;

// === 1. The shipped in-memory adapter must pass every check ================

describeRepositoryConformance('in-memory', {
  role: 'USER',
  capabilities: ALL_CAPS,
  setup: () => createInMemoryRepos()
});

// === 2. The shipped Prisma adapter must pass every check ===================
//
// We run it against a faithful in-memory `PrismaLike` fake rather than a real
// database. The fake reproduces the one property the atomicity checks hinge on:
// a conditional `updateMany({ where, data })` evaluates its `where` and applies
// its write **synchronously**, exactly like a single SQL statement — so the
// adapter's compare-and-set claims serialise the same way they would against
// Postgres. This gives `adapters/prisma.ts` its first real test coverage and
// proves the suite runs against a second, structurally different adapter.

interface FakeTable {
  findUnique(args: any): Promise<any>;
  findMany(args?: any): Promise<any>;
  create(args: any): Promise<any>;
  createMany(args: any): Promise<{ count: number }>;
  update(args: any): Promise<any>;
  updateMany(args: any): Promise<{ count: number }>;
  delete(args: any): Promise<any>;
  deleteMany(args: any): Promise<{ count: number }>;
  count(args?: any): Promise<number>;
  upsert(args: any): Promise<any>;
}

function makeTable(opts: { defaults?: () => Record<string, any>; uniques?: string[] }): FakeTable {
  const rows: Record<string, any>[] = [];
  const uniques = opts.uniques ?? ['id'];

  const eq = (a: any, b: any) =>
    a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

  const matchCond = (cell: any, cond: any): boolean => {
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('lt' in cond && !(cell < cond.lt)) return false;
      if ('lte' in cond && !(cell <= cond.lte)) return false;
      if ('gt' in cond && !(cell > cond.gt)) return false;
      if ('gte' in cond && !(cell >= cond.gte)) return false;
      if ('not' in cond && eq(cell, cond.not)) return false;
      return true;
    }
    return eq(cell, cond);
  };

  const matchWhere = (row: Record<string, any>, where: Record<string, any>): boolean => {
    for (const [key, val] of Object.entries(where)) {
      if (key === 'OR') {
        if (!(val as any[]).some((cond) => matchWhere(row, cond))) return false;
      } else if (!matchCond(row[key], val)) {
        return false;
      }
    }
    return true;
  };

  const applyData = (row: Record<string, any>, data: Record<string, any>) => {
    for (const [key, val] of Object.entries(data)) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date) && 'increment' in val) {
        row[key] = (row[key] ?? 0) + val.increment;
      } else {
        row[key] = val;
      }
    }
  };

  // Mirror Prisma's unique-constraint error: a `P2002` code, so adapters that
  // narrow their catch to that code (e.g. consumeEmailChangeToken) are exercised
  // by the suite rather than swallowing every thrown error blindly.
  const uniqueError = (field: string) =>
    Object.assign(new Error(`[fake-prisma] unique constraint failed on '${field}'`), {
      code: 'P2002'
    });

  const enforceUnique = (candidate: Record<string, any>) => {
    for (const field of uniques) {
      if (candidate[field] == null) continue;
      if (rows.some((r) => eq(r[field], candidate[field]))) {
        throw uniqueError(field);
      }
    }
  };

  return {
    async findUnique(args) {
      return rows.find((r) => matchWhere(r, args.where)) ?? null;
    },
    async findMany(args) {
      let out = args?.where ? rows.filter((r) => matchWhere(r, args.where)) : [...rows];
      if (args?.orderBy) {
        const [field, dir] = Object.entries(args.orderBy)[0] as [string, string];
        out.sort((a, b) => {
          const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
          return dir === 'desc' ? -cmp : cmp;
        });
      }
      if (typeof args?.take === 'number') out = out.slice(0, args.take);
      return out;
    },
    async create(args) {
      const row = { id: randomUUID(), ...(opts.defaults?.() ?? {}), ...args.data };
      enforceUnique(row);
      rows.push(row);
      return row;
    },
    async createMany(args) {
      const data = args.data as Record<string, any>[];
      for (const entry of data) {
        const row = { id: randomUUID(), ...(opts.defaults?.() ?? {}), ...entry };
        enforceUnique(row);
        rows.push(row);
      }
      return { count: data.length };
    },
    async update(args) {
      const row = rows.find((r) => matchWhere(r, args.where));
      // Mirror Prisma's missing-row error shape (code P2025), so adapter code
      // that maps it to the contract's no-op (recordFailedLogin) is exercised
      // rather than seeing an unstructured error it must rethrow.
      if (!row) {
        throw Object.assign(new Error('[fake-prisma] update: no row matched'), {
          code: 'P2025'
        });
      }
      applyData(row, args.data);
      return row;
    },
    async updateMany(args) {
      const matched = rows.filter((r) => matchWhere(r, args.where));
      // Enforce unique constraints the way a real DB does on UPDATE: setting a
      // unique column to a value already held by a *different* row fails. Only
      // non-null scalar writes can collide — null clears and {increment} are
      // exempt. (This is what lets the email-change collision check have teeth.)
      for (const field of uniques) {
        const val = args.data?.[field];
        if (val == null || (typeof val === 'object' && !(val instanceof Date))) continue;
        if (rows.some((r) => !matched.includes(r) && eq(r[field], val))) {
          throw uniqueError(field);
        }
      }
      let count = 0;
      for (const row of matched) {
        applyData(row, args.data);
        count++;
      }
      return { count };
    },
    async delete(args) {
      const i = rows.findIndex((r) => matchWhere(r, args.where));
      if (i === -1) throw new Error('[fake-prisma] delete: no row matched (P2025)');
      return rows.splice(i, 1)[0];
    },
    async deleteMany(args) {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (!args?.where || matchWhere(rows[i], args.where)) {
          rows.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
    async count(args) {
      return args?.where ? rows.filter((r) => matchWhere(r, args.where)).length : rows.length;
    },
    async upsert(args) {
      // Models the two upsert where-shapes the adapters issue: a Prisma
      // compound unique `{ userId_typeKey: { userId, typeKey } }` (object
      // value) and a plain unique column `{ endpoint }` (scalar value).
      // find-or-create runs in one synchronous body, so it is atomic the same
      // way a real upsert is.
      const [key, val] = Object.entries(args.where)[0] as [string, any];
      const isCompound = val !== null && typeof val === 'object' && !(val instanceof Date);
      const existing = isCompound
        ? rows.find((r) => Object.entries(val).every(([k, v]) => eq(r[k], v)))
        : rows.find((r) => eq(r[key], val));
      if (existing) {
        applyData(existing, args.update);
        return existing;
      }
      const row = { id: randomUUID(), ...(opts.defaults?.() ?? {}), ...args.create };
      rows.push(row);
      return row;
    }
  };
}

function createFakePrisma(): PrismaLike {
  return {
    user: makeTable({
      uniques: ['id', 'email', 'verificationToken', 'passwordResetToken', 'emailChangeToken'],
      defaults: () => ({
        emailVerified: false,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
        verificationToken: null,
        verificationTokenExpires: null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeTokenExpires: null,
        totpEnabled: false,
        totpSecret: null,
        totpConfirmedAt: null
      })
    }),
    invitation: makeTable({
      uniques: ['id', 'email'],
      defaults: () => ({ usedAt: null, createdAt: new Date() })
    }),
    notification: makeTable({
      defaults: () => ({ body: null, url: null, icon: null, readAt: null, createdAt: new Date() })
    }),
    pushSubscription: makeTable({
      uniques: ['id', 'endpoint'],
      defaults: () => ({ createdAt: new Date() })
    }),
    notificationPreference: makeTable({}),
    passkey: makeTable({
      uniques: ['id', 'credentialId'],
      defaults: () => ({ transports: [], name: 'Passkey', createdAt: new Date(), lastUsedAt: null })
    }),
    refreshToken: makeTable({
      uniques: ['id', 'tokenHash'],
      defaults: () => ({
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        userAgent: null,
        ip: null
      })
    }),
    twoFactorBackupCode: makeTable({
      defaults: () => ({ usedAt: null, createdAt: new Date() })
    }),
    // The fake's table methods execute eagerly, so the array operations have
    // already run by the time $transaction awaits them — Promise.all is enough
    // to model the sequential array form. True rollback is a real-DB guarantee
    // the suite doesn't claim to exercise (same compromise as the updateMany
    // synchrony note above); the delete check only asserts the success path.
    $transaction: (operations: unknown[]) => Promise.all(operations)
  };
}

describeRepositoryConformance('prisma (in-memory fake)', {
  role: 'USER',
  capabilities: ALL_CAPS,
  setup: () => createPrismaRepos(createFakePrisma())
});

// === 2a. Prisma-specific: user.delete cascades the invitations they sent ====
//
// The shared `user.delete removes the user row` check is adapter-agnostic, but
// the invitation cleanup is Prisma-adapter behaviour (a `$transaction` of
// `invitation.deleteMany({ invitedById }) + user.deleteMany`): the in-memory
// adapter intentionally doesn't model the inviter relationship. So we assert it
// against the fake, which DOES store `invitedById` and runs the transaction.
describe('prisma adapter — user.delete cascades sent invitations', () => {
  it('removes the invitations a deleted user sent (transaction cleanup)', async () => {
    const repos = createPrismaRepos(createFakePrisma());
    const inviter = await repos.user.create({
      email: `inviter-${randomUUID()}@conformance.test`,
      name: 'Inviter',
      passwordHash: 'x',
      role: 'USER'
    });
    const other = await repos.user.create({
      email: `other-${randomUUID()}@conformance.test`,
      name: 'Other',
      passwordHash: 'x',
      role: 'USER'
    });
    await repos.invitation.create({
      email: `invitee-${randomUUID()}@conformance.test`,
      role: 'USER',
      invitedById: inviter.id
    });
    const keep = await repos.invitation.create({
      email: `keep-${randomUUID()}@conformance.test`,
      role: 'USER',
      invitedById: other.id
    });

    await repos.user.delete(inviter.id);

    const remaining = await repos.invitation.list();
    expect(remaining, 'only the other user’s invitation survives').toHaveLength(1);
    expect(remaining[0]?.id).toBe(keep.id);
    expect(await repos.user.findById(inviter.id), 'inviter gone').toBeNull();
    expect(await repos.user.findById(other.id), 'unrelated user untouched').not.toBeNull();
  });
});

// === 2a'. Prisma-specific: push-subscription gate edge cases =================
//
// The agnostic suite pins the four write outcomes; these pin the Prisma
// adapter's two sharp edges: the insert race (a row appearing between the
// pre-write read and the insert must RE-RUN the key gate, not fall into an
// ungated upsert — silent-failure review M1) and legacy rows whose `keys`
// column is null/garbage (fail-closed: unreassignable, never a throw).
describe('prisma adapter — push-subscription gate edge cases', () => {
  const ENDPOINT = 'https://push.test/gate-edge';
  const KEYS_OWNER = { p256dh: 'cDE', auth: 'YTE' };
  const KEYS_OTHER = { p256dh: 'cDI', auth: 'YTI' };

  function repoOver(ps: Record<string, unknown>) {
    const repo = createPrismaRepos({
      ...createFakePrisma(),
      pushSubscription: ps
    } as unknown as PrismaLike).pushSubscription;
    if (!repo) throw new Error('pushSubscription repo missing');
    return repo;
  }

  it('re-runs the gate when a row appears between read and insert (insert race)', async () => {
    // Interleaving: our read sees no row → the victim's create wins the race
    // (our insert hits the unique violation) → the retry must gate against
    // the winner's row. An unconditional upsert here would reassign the
    // victim's fresh row to the attacker without any key check.
    let reads = 0;
    const winnerRow = { userId: 'victim', endpoint: ENDPOINT, keys: KEYS_OWNER };
    const upsert = vi.fn();
    const repo = repoOver({
      findUnique: vi.fn(async () => (++reads === 1 ? null : winnerRow)),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => {
        throw Object.assign(new Error('[fake] unique constraint'), { code: 'P2002' });
      }),
      upsert,
      deleteMany: vi.fn()
    });

    const outcome = await repo.create('attacker', { endpoint: ENDPOINT, keys: KEYS_OTHER });
    expect(outcome, 'gate applies to the row that won the race').toBe('rejected');
    expect(upsert, 'no ungated write may happen').not.toHaveBeenCalled();
  });

  it("matching keys still pass after losing the insert race ('reassigned')", async () => {
    let reads = 0;
    const winnerRow = { userId: 'previous-user', endpoint: ENDPOINT, keys: KEYS_OWNER };
    const upsert = vi.fn();
    const repo = repoOver({
      findUnique: vi.fn(async () => (++reads === 1 ? null : winnerRow)),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => {
        throw Object.assign(new Error('[fake] unique constraint'), { code: 'P2002' });
      }),
      upsert,
      deleteMany: vi.fn()
    });

    // Same-browser user switch: the caller holds the real keys.
    const outcome = await repo.create('next-user', { endpoint: ENDPOINT, keys: KEYS_OWNER });
    expect(outcome).toBe('reassigned');
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('a non-P2002 create failure propagates (no infinite retry, no false outcome)', async () => {
    const repo = repoOver({
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => {
        throw Object.assign(new Error('db down'), { code: 'P1001' });
      }),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    });
    await expect(repo.create('u1', { endpoint: ENDPOINT, keys: KEYS_OWNER })).rejects.toThrow(
      'db down'
    );
  });

  it("a legacy row with keys: null is unreassignable cross-user ('rejected', not a 500)", async () => {
    const repo = repoOver({
      findUnique: vi.fn(async () => ({ userId: 'other', endpoint: ENDPOINT, keys: null })),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    });
    // pushKeysEqual fails closed on the undecodable `?? {}` shape — the
    // deliberate consequence: such a row can only be healed by its owner.
    expect(await repo.create('me', { endpoint: ENDPOINT, keys: KEYS_OWNER })).toBe('rejected');
  });

  it("the owner's own re-subscribe heals a keys: null row ('updated')", async () => {
    const upsert = vi.fn();
    const repo = repoOver({
      findUnique: vi.fn(async () => ({ userId: 'me', endpoint: ENDPOINT, keys: null })),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      upsert,
      deleteMany: vi.fn()
    });
    expect(await repo.create('me', { endpoint: ENDPOINT, keys: KEYS_OWNER })).toBe('updated');
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

// === 2b. Prisma-specific: consumeEmailChangeToken must not mask a real DB fault ==
//
// The collision path (target taken since the request) is a P2002 the adapter
// reports as a failed claim. A *non*-unique error (connection drop, timeout)
// must be rethrown as the honest 500 instead of masquerading as "invalid link".
describe('prisma adapter — consumeEmailChangeToken error handling', () => {
  it('rethrows a non-P2002 DB error instead of reporting an invalid link', async () => {
    const prisma = createFakePrisma();
    await prisma.user.create({
      data: {
        email: `a-${randomUUID()}@conformance.test`,
        name: 'A',
        passwordHash: 'x',
        role: 'USER',
        pendingEmail: `b-${randomUUID()}@conformance.test`,
        emailChangeToken: 'tok',
        emailChangeTokenExpires: new Date(Date.now() + 60 * 60_000)
      }
    });
    // The claim write fails with a generic (non-unique) error.
    prisma.user.updateMany = async () => {
      throw new Error('connection reset');
    };
    const repos = createPrismaRepos(prisma);

    await expect(repos.user.consumeEmailChangeToken('tok')).rejects.toThrow('connection reset');
  });
});

// === 3. Negative control — the suite must REJECT a non-atomic adapter ======
//
// Proof that the atomicity check has teeth: a user repository whose
// `consumeResetToken` performs a read-modify-write across an `await` lets two
// concurrent claims both win, and the reset-token check must catch it.

function brokenAtomicityUserRepo(): UserRepository {
  const byId = new Map<string, FullAuthUser>();
  const notExercised = () => {
    throw new Error('not exercised by the reset-token check');
  };

  return {
    async create(data) {
      const u: FullAuthUser = {
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
        verificationToken: null,
        verificationTokenExpires: null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeTokenExpires: null,
        totpSecret: null,
        totpConfirmedAt: null
      };
      byId.set(u.id, u);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        emailVerified: u.emailVerified,
        totpEnabled: u.totpEnabled
      };
    },
    async findById(id) {
      const u = byId.get(id);
      return u ? { ...u } : null;
    },
    async setPasswordResetToken(id, tokenHash, expires) {
      const u = byId.get(id);
      if (u) {
        u.passwordResetToken = tokenHash;
        u.passwordResetTokenExpires = expires;
      }
    },
    async consumeResetToken(tokenHash) {
      const u = [...byId.values()].find((x) => x.passwordResetToken === tokenHash);
      if (!u) return null;
      // THE BUG: capture the decision, then yield to the event loop *before*
      // committing the clear. Two concurrent claims both captured `matches:true`
      // and both clear → both "win". This is the read-modify-write race the
      // atomicity check exists to catch.
      const matches = u.passwordResetToken === tokenHash;
      await Promise.resolve();
      if (!matches) return null;
      u.passwordResetToken = null;
      u.passwordResetTokenExpires = null;
      return { ...u };
    },
    findByEmail: notExercised,
    updatePassword: notExercised,
    setEmailVerified: notExercised,
    setVerificationToken: notExercised,
    consumeVerificationToken: notExercised,
    incrementTokenVersion: notExercised,
    getFailedLoginAttempts: notExercised,
    recordFailedLogin: notExercised,
    resetFailedLogins: notExercised,
    updateProfile: notExercised,
    setEmailChangeToken: notExercised,
    consumeEmailChangeToken: notExercised,
    delete: notExercised,
    setTotpSecret: notExercised,
    enableTotp: notExercised,
    disableTotp: notExercised
  } as UserRepository;
}

describe('conformance suite — negative control', () => {
  it('rejects a non-atomic consumeResetToken (proves the atomicity check has teeth)', async () => {
    const brokenHarness: ConformanceHarness = {
      role: 'USER',
      setup: () => ({ ...createInMemoryRepos(), user: brokenAtomicityUserRepo() })
    };
    const resetCheck = conformanceChecks.find(
      (c) => c.name === 'user.consumeResetToken is single-use under concurrent claims'
    );
    expect(resetCheck, 'reset-token check must exist').toBeDefined();
    await expect(resetCheck!.run(brokenHarness)).rejects.toThrow();
  });
});

describe('recordFailedLogin error handling (prisma adapter)', () => {
  it('rethrows non-P2025 errors instead of swallowing them as the no-op', async () => {
    // Mutation-test finding: a catch-all in the P2025 mapping survived the
    // suite — a DB outage while counting failed logins would silently degrade
    // the lockout brake. Only the missing-row shape maps to the contract
    // no-op; everything else must stay loud.
    const fake = createFakePrisma();
    fake.user.update = async () => {
      throw Object.assign(new Error('[fake-prisma] cannot reach database'), { code: 'P1001' });
    };
    const repos = createPrismaRepos(fake);
    await expect(
      repos.user.recordFailedLogin('any-user', { maxAttempts: 5, durationMinutes: 15 })
    ).rejects.toThrow('cannot reach database');
  });
});
