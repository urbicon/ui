// The fake Prisma client below mirrors the real `PrismaLike` boundary, which is
// deliberately `unknown`-in / `any`-out (see adapters/prisma.ts). Typing the
// fake's query args precisely would re-leak the row model the boundary exists
// to hide, so `any` is the pragmatic, intentional choice here.

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  type ConformanceCapabilities,
  type ConformanceHarness,
  conformanceChecks,
  describeRepositoryConformance
} from './conformance.js';
import { createInMemoryRepos } from './in-memory.js';
import {
  createPrismaFederatedAccountRepository,
  createPrismaRepos,
  type PrismaLike
} from './prisma.js';
import type { FailedLoginLock, FullAuthUser, UserRepository } from './types.js';

// `Required`, not `as const`: a capability added to the interface has to be
// declared here or this file stops compiling — the one thing an omitted key
// otherwise does silently is drop its checks.
const ALL_CAPS: Required<ConformanceCapabilities> = {
  refreshToken: true,
  passkey: true,
  notification: true,
  pushSubscription: true,
  notificationPreference: true,
  backupCode: true,
  federatedAccount: true
};

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

function makeTable(opts: {
  defaults?: () => Record<string, any>;
  /** Plain entries are single-column uniques; array entries are composite (`@@unique([a, b])`). */
  uniques?: (string | string[])[];
}): FakeTable {
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

  const OPERATOR_KEYS = ['lt', 'lte', 'gt', 'gte', 'not'];

  const matchWhere = (row: Record<string, any>, where: Record<string, any>): boolean => {
    for (const [key, val] of Object.entries(where)) {
      if (key === 'OR') {
        if (!(val as any[]).some((cond) => matchWhere(row, cond))) return false;
      } else if (
        !(key in row) &&
        val !== null &&
        typeof val === 'object' &&
        !(val instanceof Date) &&
        !OPERATOR_KEYS.some((op) => op in val)
      ) {
        // Prisma's compound-unique where syntax (`{ issuer_subject: { issuer,
        // subject } }`): the synthetic key is no row column, so match its
        // sub-conditions against the row instead. Without this branch the
        // object would fall through matchCond's operator scan and match
        // EVERY row (no operator keys → vacuous true).
        if (!Object.entries(val).every(([k, v]) => matchCond(row[k], v))) return false;
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
      if (Array.isArray(field)) {
        // Composite unique (`@@unique([a, b])`) — enforced on create; no
        // shipped adapter rewrites composite-key columns via update.
        if (field.some((f) => candidate[f] == null)) continue;
        if (rows.some((r) => field.every((f) => eq(r[f], candidate[f])))) {
          throw uniqueError(field.join('_'));
        }
        continue;
      }
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
        if (Array.isArray(field)) continue; // composite uniques: create-only (see enforceUnique)
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

/** `[delegate name, foreign-key column]` for one cascading relation. */
type CascadeRelation = [string, string];

/**
 * The `onDelete: Cascade` relations a Prisma schema puts on `User`.
 *
 * The adapter leaves these deletes to the database, so this is the half of
 * `user.delete` the fake has to supply: without it every dependent row is still
 * there afterwards, and the erasure check reports an adapter defect that is not
 * in the adapter. Deriving the list from `auth-schema.prisma` rather than
 * restating it is what keeps a model added there from being absent here.
 *
 * `//` comments are stripped first — a commented-out relation is one the schema
 * no longer declares, and it is the only malformation that would otherwise pass
 * silently (a removed `onDelete`, a `User?` field or a composite FK all drop
 * out of the match and turn the erasure check red).
 */
function parseCascadingUserRelations(schema: string): CascadeRelation[] {
  const source = schema.replace(/\/\/[^\n]*/g, '');
  const relations: CascadeRelation[] = [];
  for (const [, model, body] of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    for (const [, args] of body.matchAll(/\s+User\s+@relation\(([^)]*)\)/g)) {
      if (!/onDelete:\s*Cascade/.test(args)) continue;
      const column = /fields:\s*\[(\w+)\]/.exec(args)?.[1];
      if (column) relations.push([model[0].toLowerCase() + model.slice(1), column]);
    }
  }
  return relations;
}

function cascadingUserRelations(): CascadeRelation[] {
  return parseCascadingUserRelations(
    readFileSync(new URL('../../../../prisma/auth-schema.prisma', import.meta.url), 'utf8')
  );
}

function createFakePrisma(relations: CascadeRelation[] = cascadingUserRelations()): PrismaLike {
  const tables = {
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
    federatedAccount: makeTable({
      uniques: ['id', ['issuer', 'subject']],
      defaults: () => ({ createdAt: new Date() })
    }),
    // The fake's table methods execute eagerly, so the array operations have
    // already run by the time $transaction awaits them — Promise.all is enough
    // to model the sequential array form. True rollback is a real-DB guarantee
    // the suite doesn't claim to exercise (same compromise as the updateMany
    // synchrony note above); the delete check only asserts the success path.
    $transaction: (operations: unknown[]) => Promise.all(operations)
  };

  // `onDelete: Cascade`, the half of `user.delete` the adapter never writes.
  // The dependent rows go with the user row, in the same call, the way the
  // database does it.
  //
  // A relation the schema declares and this fake has no table for is a fault in
  // the fake, refused here rather than skipped at erasure time — otherwise the
  // derived list would grow while the modelled behaviour did not.
  const byModel = tables as unknown as Record<string, FakeTable | undefined>;
  for (const [model] of relations) {
    if (!byModel[model]) {
      throw new Error(
        `[fake-prisma] auth-schema.prisma cascades '${model}' from User, but this fake has no such table`
      );
    }
  }
  const erased = async (doomed: Record<string, any>[]) => {
    for (const row of doomed) {
      for (const [model, column] of relations) {
        await byModel[model]!.deleteMany({ where: { [column]: row.id } });
      }
    }
  };
  // Only `deleteMany`: the adapter's `user.delete` runs
  // `$transaction([invitation.deleteMany, user.deleteMany])`, and `PrismaLike`
  // declares no singular `delete` on `user` at all, so wrapping one would be a
  // branch no call can reach.
  const { deleteMany } = tables.user;
  tables.user.deleteMany = async (args: any) => {
    const doomed = await tables.user.findMany(args);
    const result = await deleteMany(args);
    await erased(doomed);
    return result;
  };

  return tables;
}

// === 1a. The fake's cascade is derived, so the derivation needs its own guard ==
//
// Every other malformation of the schema is fail-loud through the erasure check
// (a dropped `onDelete`, a `User?` field, a composite FK, a parser that returns
// nothing — all of them leave dependent rows behind and turn it red). These two
// are the exceptions: a relation the schema only mentions in a comment still
// cascading, and a relation the schema declares that the fake cannot model.

describe('fake prisma — the cascade derivation', () => {
  const SYNTHETIC = `
model Live {
  id     String @id
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CommentedOut {
  id     String @id
  userId String
  // user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model NoCascade {
  id     String @id
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
`;

  it('takes a declared relation, and neither a commented-out nor an uncascaded one', () => {
    expect(parseCascadingUserRelations(SYNTHETIC)).toEqual([['live', 'userId']]);
  });

  it('reads the reference schema, invitation’s `invitedById` FK included', () => {
    const relations = parseCascadingUserRelations(
      readFileSync(new URL('../../../../prisma/auth-schema.prisma', import.meta.url), 'utf8')
    );
    // Every dependent model in the schema, so a model added there without a
    // table in the fake is caught by createFakePrisma's guard, not skipped.
    expect(relations.map(([model]) => model).sort()).toEqual([
      'federatedAccount',
      'invitation',
      'notification',
      'notificationPreference',
      'passkey',
      'pushSubscription',
      'refreshToken',
      'twoFactorBackupCode'
    ]);
    expect(relations, 'the one FK that is not named userId').toContainEqual([
      'invitation',
      'invitedById'
    ]);
  });

  it('refuses a schema relation it has no table for, rather than cascading nothing', () => {
    expect(() => createFakePrisma([...cascadingUserRelations(), ['auditLog', 'userId']])).toThrow(
      /auditLog/
    );
  });
});

describeRepositoryConformance('prisma (in-memory fake)', {
  role: 'USER',
  capabilities: ALL_CAPS,
  setup: () => createPrismaRepos(createFakePrisma())
});

// === 1b. The same adapter against typed id columns =========================
//
// The fake above models `String @id` — a `text` column, which holds any string,
// so it can never produce the error a native `uuid` (or integer) key raises for
// a malformed id. That is the one thing the id contract in `types.ts` is about,
// and without this run the adapter's guard would ship untested: the suite would
// stay green whether or not it exists.
//
// This wrapper adds exactly the missing behaviour and runs the whole suite
// again through it. The error it raises is the shape measured against a live
// Postgres with Prisma 7.9.1 + @prisma/adapter-pg: top-level `P2007`, with
// Postgres' own `22P02` down in `meta.driverAdapterError.cause`. (Matching
// `P2023` alone — which an earlier draft of the adapter did — never fires
// there; that code belongs to Prisma's older Rust engine.)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The columns `auth-schema.prisma` declares as ids or FKs to one. */
const ID_COLUMNS = new Set(['id', 'userId', 'invitedById', 'replacedById']);

/** The driver-adapter shape: `prisma.user.findUnique({ where: { id: 'x' } })`. */
function malformedIdError(column: string, value: string): Error {
  const detail = `invalid input syntax for type uuid: "${value}"`;
  return Object.assign(new Error(`Invalid input value: ${detail} (column ${column})`), {
    code: 'P2007',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { kind: 'InvalidInputValue', originalCode: '22P02', originalMessage: detail }
      }
    }
  });
}

function assertRepresentableIds(node: unknown, column = ''): void {
  if (node === null || node === undefined || node instanceof Date) return;
  if (Array.isArray(node)) {
    // Inside `{ id: { in: [...] } }` the entries belong to the column named one
    // level up, so the name is carried down rather than re-read from the entry.
    for (const entry of node) assertRepresentableIds(entry, column);
    return;
  }
  if (typeof node === 'string') {
    if (ID_COLUMNS.has(column) && !UUID_RE.test(node)) throw malformedIdError(column, node);
    return;
  }
  if (typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    // A filter wrapper (`{ not: … }`, `{ in: [...] }`) is not a column name, so
    // keep the one we already have; anything else names the column itself.
    assertRepresentableIds(value, ID_COLUMNS.has(key) ? key : FILTER_KEYS.has(key) ? column : '');
  }
}

/** Prisma filter operators — these nest, they do not rename the column. */
const FILTER_KEYS = new Set(['not', 'in', 'notIn', 'equals', 'AND', 'OR', 'NOT']);

function createUuidTypedFakePrisma(): PrismaLike {
  const base = createFakePrisma() as unknown as Record<string, any>;
  const guarded: Record<string, any> = {};

  for (const [model, delegate] of Object.entries(base)) {
    if (typeof delegate !== 'object' || delegate === null) {
      guarded[model] = delegate;
      continue;
    }
    const table: Record<string, any> = {};
    for (const [op, fn] of Object.entries(delegate as Record<string, any>)) {
      table[op] =
        typeof fn === 'function'
          ? (args?: unknown) => {
              assertRepresentableIds(args);
              return fn(args);
            }
          : fn;
    }
    guarded[model] = table;
  }
  return guarded as unknown as PrismaLike;
}

describeRepositoryConformance('prisma (uuid-typed id columns)', {
  role: 'USER',
  capabilities: ALL_CAPS,
  setup: () => createPrismaRepos(createUuidTypedFakePrisma())
});

// === 1c. What the id guard must NOT swallow ================================
//
// The guard turns one error into "nothing matched". Everything hinges on it
// recognising only that one: `P2023` in particular is Prisma's code for *stored*
// data that no longer fits its column — a half-migrated table, a value written
// out of band — and reading that as an empty result would hide a broken
// database behind an empty screen. These pin both directions.

describe('prisma adapter — the id guard is narrow', () => {
  const failingClient = (error: unknown): PrismaLike => {
    const base = createFakePrisma() as unknown as Record<string, any>;
    return {
      ...base,
      user: {
        ...base.user,
        findUnique: () => Promise.reject(error),
        updateMany: () => Promise.reject(error)
      }
    } as unknown as PrismaLike;
  };

  const swallowed = [
    ['driver adapter (Prisma 7): P2007, with 22P02 in meta', malformedIdError('id', 'not-an-id')],
    [
      '22P02 surfaced as the code itself',
      Object.assign(new Error('invalid input syntax for type uuid: "not-an-id"'), { code: '22P02' })
    ],
    [
      'a bigint key, not just uuid',
      Object.assign(new Error('invalid input syntax for type bigint: "not-an-id"'), {
        code: '22P02'
      })
    ]
  ] as const;

  for (const [label, error] of swallowed) {
    it(`reads as a miss — ${label}`, async () => {
      const repos = createPrismaRepos(failingClient(error));
      await expect(repos.user.findById('not-an-id')).resolves.toBeNull();
      await expect(repos.user.updatePassword('not-an-id', 'hash')).resolves.toBeUndefined();
    });
  }

  const circularCause = (): unknown => {
    const cause: Record<string, unknown> = {
      kind: 'InvalidInputValue',
      originalCode: '22P02',
      originalMessage: 'invalid input syntax for type uuid: "not-an-id"'
    };
    // A driver's error cause is a third-party payload and routinely holds a
    // back-reference to its connection. Classifying must not choke on it.
    cause.connection = { cause };
    return Object.assign(new Error('Invalid input value'), {
      code: 'P2007',
      meta: { driverAdapterError: { cause } }
    });
  };

  it('classifies a circular driver cause without throwing from the catch block', async () => {
    const repos = createPrismaRepos(failingClient(circularCause()));
    await expect(repos.user.findById('not-an-id')).resolves.toBeNull();
  });

  it('never replaces the database error with one of its own', async () => {
    // defineProperty, not Object.assign — assign would invoke the getter here.
    const hostile = Object.assign(new Error('boom'), { code: 'P2007' });
    Object.defineProperty(hostile, 'meta', {
      get(): never {
        throw new Error('classification must not surface this');
      }
    });
    await expect(createPrismaRepos(failingClient(hostile)).user.findById('x')).rejects.toThrow(
      'boom'
    );
  });

  const propagated = [
    [
      // The headline reason P2023 is not accepted: Prisma raises it from the
      // same conversion layer for a stored row as for an argument, so it cannot
      // tell a broken migration from a malformed id.
      'P2023 naming a malformed UUID — which a half-migrated column produces too',
      Object.assign(new Error('Inconsistent column data: Malformed UUID: "legacy-cuid"'), {
        code: 'P2023'
      })
    ],
    [
      'P2023 from a corrupt stored row (a broken migration)',
      Object.assign(
        new Error("Inconsistent column data: Value 'superadmin' not found in enum 'Role'"),
        { code: 'P2023' }
      )
    ],
    [
      '22P02 on a column an id is never stored in',
      Object.assign(new Error('invalid input syntax for type json: "not json"'), { code: '22P02' })
    ],
    [
      '22P02 on a timestamp argument',
      Object.assign(new Error('invalid input syntax for type timestamp: "yesterday"'), {
        code: '22P02'
      })
    ],
    [
      'P2023 from an out-of-range stored integer',
      Object.assign(
        new Error("Inconsistent column data: Integer value in column 'counter' is too large"),
        { code: 'P2023' }
      )
    ],
    [
      'a Postgres enum-value error, which is 22P02 but not an id',
      Object.assign(new Error('invalid input value for enum role: "wizard"'), { code: '22P02' })
    ],
    [
      'a connection failure',
      Object.assign(new Error("Can't reach database server"), { code: 'P1001' })
    ],
    ['an error with no code at all', new Error('socket hang up')]
  ] as const;

  for (const [label, error] of propagated) {
    it(`keeps failing loudly — ${label}`, async () => {
      const repos = createPrismaRepos(failingClient(error));
      await expect(repos.user.findById('some-id')).rejects.toThrow();
      await expect(repos.user.updatePassword('some-id', 'hash')).rejects.toThrow();
    });
  }
});

// === 2a. Prisma-specific: federated-account wiring ==========================
//
// The federated repo has NO downstream wiring check (nothing in the package's
// own handlers calls it — it exists for a consumer app's `resolveUser`), so
// the explicit factory is the one place a missing Prisma model can fail loud.
describe('prisma adapter — federated-account wiring', () => {
  it('createPrismaFederatedAccountRepository fails loud when the model is missing', () => {
    const withoutModel: PrismaLike = { ...createFakePrisma(), federatedAccount: undefined };
    expect(() => createPrismaFederatedAccountRepository(withoutModel)).toThrow(
      /federatedAccount.*auth-schema\.prisma/s
    );
  });

  it('createPrismaRepos treats the model as optional (bundle wiring, no throw)', () => {
    const withoutModel: PrismaLike = { ...createFakePrisma(), federatedAccount: undefined };
    expect(createPrismaRepos(withoutModel).federatedAccount).toBeUndefined();
    expect(createPrismaRepos(createFakePrisma()).federatedAccount).toBeDefined();
  });
});

// (The sent-invitations delete cascade is now pinned adapter-agnostically by
// the `user.delete cascades the invitations the user sent` conformance check —
// the in-memory bundle models the inviter relationship since review R20.)

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

// === 4. Negative control — the suite must REJECT an adapter with a policy of its own
//
// `recordFailedLogin` is handed the threshold and the lock instant as values.
// An adapter that keeps its own numbers passes any check that only asks "does
// it lock eventually", so the lockout check hands in values the shipped
// defaults cannot reproduce — and this pins that it notices both kinds of drift.

describe('conformance suite — negative control (lockout policy)', () => {
  const lockoutCheck = conformanceChecks.find(
    (c) => c.name === 'user.recordFailedLogin counts atomically and applies the lock it is handed'
  );

  it.each([
    {
      label: 'its own threshold (5 instead of the handed value)',
      own: (lock: FailedLoginLock): FailedLoginLock => ({ ...lock, maxAttempts: 5 })
    },
    {
      label: 'its own duration (now + 15 min instead of the handed instant)',
      own: (lock: FailedLoginLock): FailedLoginLock => ({
        ...lock,
        lockedUntil: new Date(Date.now() + 15 * 60_000)
      })
    }
  ])('rejects an adapter applying $label', async ({ own }) => {
    const harness: ConformanceHarness = {
      role: 'USER',
      setup: () => {
        const repos = createInMemoryRepos();
        const user: UserRepository = {
          ...repos.user,
          recordFailedLogin: (id, lock) => repos.user.recordFailedLogin(id, lock && own(lock))
        };
        return { ...repos, user };
      }
    };
    expect(lockoutCheck, 'lockout check must exist').toBeDefined();
    await expect(lockoutCheck!.run(harness)).rejects.toThrow();
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
      repos.user.recordFailedLogin('any-user', { maxAttempts: 5, lockedUntil: new Date() })
    ).rejects.toThrow('cannot reach database');
  });
});
