import type { RefreshTokenConfig } from '../../types.js';
import { issueRefreshToken, rotateRefreshToken } from '../refresh-token.js';
import type { Repositories } from './types.js';

/**
 * # Adapter conformance suite
 *
 * A persistence adapter for `@urbicon-ui/auth` is only safe if its claim
 * operations are genuinely atomic and its scoped mutations are genuinely
 * scoped. Those guarantees cannot be eyeballed from an implementation — a
 * read-then-write that looks fine sequentially silently double-spends a
 * single-use token under concurrency. This suite turns the interface contract
 * (`types.ts`) into executable, adapter-agnostic tests so that **any** adapter
 * — the shipped Prisma/in-memory ones or a community Drizzle/Kysely/raw-SQL
 * one — can prove it upholds the contract before shipping.
 *
 * ## Usage
 *
 * In your adapter's test file:
 *
 * ```ts
 * import { describeRepositoryConformance } from '@urbicon-ui/auth/server/adapters/conformance';
 * import { createMyAdapter } from './my-adapter';
 *
 * describeRepositoryConformance('my-adapter', {
 *   role: 'USER',
 *   capabilities: { refreshToken: true, passkey: true, notification: true },
 *   setup: () => createMyAdapter(freshTestDatabase())
 * });
 * ```
 *
 * `setup()` MUST return a clean, isolated repository set on every call — the
 * suite calls it once per check and assumes no shared state between checks
 * (wipe the schema, use a fresh transaction, or hand back new in-memory maps).
 * `capabilities` gates the optional-repository checks: a check whose required
 * repos you do not declare is reported as skipped rather than failing.
 *
 * ## Test runners
 *
 * This module is runner-agnostic: it takes `describe`/`it`/`expect` from the
 * caller instead of importing them, so it works under any runner whose
 * assertion API matches — vitest and `bun:test` do as they are.
 *
 * `@urbicon-ui/auth/server/adapters/conformance` is the vitest-wired entry and
 * needs nothing extra. Under another runner, import this module and hand it the
 * runner:
 *
 * ```ts
 * import { describe, expect, it } from 'bun:test';
 * import { describeRepositoryConformance } from '@urbicon-ui/auth/server/adapters/conformance-core';
 *
 * describeRepositoryConformance('my-adapter', harness, { runner: { describe, it, expect } });
 * ```
 *
 * jest needs one adapter line: its `expect` throws on the second (message)
 * argument the checks pass, so drop it — `expect: (actual) => expect(actual)`.
 * The checks still assert the same thing; only the failure message is thinner.
 */

/**
 * The slice of a test runner the suite uses: `describe`, `it` (with `.skip`)
 * and a chai-style `expect(actual, message)`. vitest and `bun:test` satisfy it
 * directly; jest's `expect` rejects a second argument and needs a one-line
 * wrapper that drops the message.
 */
export interface ConformanceRunner {
  describe: (name: string, fn: () => void) => void;
  it: ((name: string, fn: () => Promise<void> | void) => void) & {
    skip: (name: string, fn?: () => Promise<void> | void) => void;
  };
  /** The matcher chain is the runner's; typing it here would pin one runner's surface. */
  expect: (actual: any, message?: string) => any;
}

let activeRunner: ConformanceRunner | null = null;

/**
 * Register the runner the checks assert through. The vitest entry calls this
 * for you; other runners pass `options.runner` to
 * {@link describeRepositoryConformance} (which forwards here) or call it
 * directly before running checks by hand.
 */
export function setConformanceRunner(runner: ConformanceRunner): void {
  activeRunner = runner;
}

function currentRunner(): ConformanceRunner {
  if (!activeRunner) {
    throw new Error(
      '[auth:conformance] no test runner registered. Import ' +
        "'@urbicon-ui/auth/server/adapters/conformance' (vitest), or pass " +
        '`{ runner: { describe, it, expect } }` from your own runner.'
    );
  }
  return activeRunner;
}

// Thin forwarders so the checks below read exactly as they would with the
// globals imported directly.
const describe = (name: string, fn: () => void) => currentRunner().describe(name, fn);
const it = Object.assign(
  (name: string, fn: () => Promise<void> | void) => currentRunner().it(name, fn),
  { skip: (name: string, fn?: () => Promise<void> | void) => currentRunner().it.skip(name, fn) }
);
const expect = (actual: any, message?: string): any => currentRunner().expect(actual, message);

/** Optional repositories an adapter may implement; gates the matching checks. */
export interface ConformanceCapabilities {
  refreshToken?: boolean;
  passkey?: boolean;
  notification?: boolean;
  pushSubscription?: boolean;
  notificationPreference?: boolean;
  backupCode?: boolean;
  federatedAccount?: boolean;
}

export interface ConformanceHarness<R extends string = string> {
  /**
   * Produce a fresh, fully-isolated repository set for a single check. Called
   * once per check — must not share mutable state across calls.
   */
  setup(): Repositories<R> | Promise<Repositories<R>>;
  /** Optional cleanup run after each check (drop the schema, close handles). */
  teardown?(repos: Repositories<R>): void | Promise<void>;
  /** The role value used when the suite seeds users. */
  role: R;
  /** Optional repositories this adapter implements (others' checks skip). */
  capabilities?: ConformanceCapabilities;
}

export interface ConformanceCheck {
  /** Stable, human-readable name — also the test title. */
  readonly name: string;
  /** Optional repos this check needs; skipped unless the harness declares them. */
  readonly requires: ReadonlyArray<keyof ConformanceCapabilities>;
  /** Throws (via `expect`) on a contract violation. */
  run(harness: ConformanceHarness): Promise<void>;
}

// --- helpers ---------------------------------------------------------------

const ROTATION_CONFIG: RefreshTokenConfig = { refreshTokenTtl: '30d' };

/** Run `fn` N times concurrently and collect the results. */
function parallel<T>(n: number, fn: () => Promise<T>): Promise<T[]> {
  return Promise.all(Array.from({ length: n }, () => fn()));
}

/**
 * For calls whose *loser* is allowed to throw: two writers racing for one
 * uniquely-constrained row. The check asserts the end state, and which of the
 * two callers threw is not part of the contract.
 *
 * NOT for ownership scope. "Not yours" is a miss, and a miss is a no-op or a
 * `false` — never a throw (see the id contract in `types.ts`). Those checks
 * call the repository directly, so a throwing scope guard fails them.
 */
async function tolerate(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    /* a throwing scope guard is contract-conformant; end state is asserted */
  }
}

function need<T>(repo: T | undefined, name: string): T {
  if (!repo) throw new Error(`conformance harness misconfigured: '${name}' repository missing`);
  return repo;
}

let seedCounter = 0;
/** Monotonic counter for unique seed values; returns the next value. */
function nextSeed(): number {
  seedCounter += 1;
  return seedCounter;
}
/** Seed a user via the repo's own API; unique email per call within a check. */
async function seedUser(repos: Repositories, role: string, label = 'u') {
  const seed = nextSeed();
  return repos.user.create({
    email: `${label}-${seed}@conformance.test`,
    name: 'Conformance User',
    passwordHash: 'x',
    role
  });
}

/**
 * Seed one user per label and return their ids, in order.
 *
 * Every dependent row a check inserts — a refresh token, a passkey, a
 * notification — must point at a user that actually exists. A synthetic literal
 * (`'owner'`) works only against a store with no referential integrity, which
 * is what the shipped in-memory adapter and the Prisma fake are; against a real
 * relational schema (`prisma/auth-schema.prisma` puts `onDelete: Cascade` on
 * all eight dependent models — the seven `userId` ones plus `Invitation`, whose
 * FK is `invitedById`) the insert fails with a foreign-key violation, and the
 * check reports an adapter bug that is not there.
 *
 * This applies to the non-owner of an ownership-scope assertion too. A literal
 * (`'attacker'`) is not merely unnecessary there, it weakens the check twice
 * over: an adapter that gates on *existence* rather than ownership passes when
 * the attacker cannot exist, and against a typed id column the call fails on
 * the id's syntax before the scope guard is ever reached — so the assertion
 * that follows holds vacuously. The attacker is a real, seeded user.
 */
async function seedUserIds(
  repos: Repositories,
  role: string,
  ...labels: string[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const label of labels) ids.push((await seedUser(repos, role, label)).id);
  return ids;
}

/**
 * An id that is well-formed for this store but belongs to no row: seed a user,
 * then delete it.
 *
 * A check that needs "an id nothing is stored under" cannot invent one — the
 * suite does not know the adapter's id format, and a made-up literal
 * (`'no-such-user-id'`) is unrepresentable in a `uuid` or integer key column.
 * Round-tripping through the store yields an id in whatever shape the adapter
 * actually uses.
 */
async function retiredUserId(repos: Repositories, role: string, label: string): Promise<string> {
  const { id } = await seedUser(repos, role, label);
  await repos.user.delete(id);
  return id;
}

/** The invitation counterpart of {@link retiredUserId}: created, then deleted. */
async function retiredInvitationId(
  repos: Repositories,
  role: string,
  label: string
): Promise<string> {
  const [inviter] = await seedUserIds(repos, role, label);
  const inv = await repos.invitation.create({
    email: `${label}-retired-${nextSeed()}@conformance.test`,
    role,
    invitedById: inviter as string
  });
  await repos.invitation.delete(inv.id);
  return inv.id;
}

const futureDate = () => new Date(Date.now() + 60 * 60_000);
const pastDate = () => new Date(Date.now() - 60 * 60_000);

/** Wrap a check body with setup/teardown so every check gets isolated repos. */
function check(
  name: string,
  requires: ReadonlyArray<keyof ConformanceCapabilities>,
  body: (repos: Repositories, harness: ConformanceHarness) => Promise<void>
): ConformanceCheck {
  return {
    name,
    requires,
    async run(harness) {
      const repos = await harness.setup();
      try {
        await body(repos, harness);
      } finally {
        await harness.teardown?.(repos);
      }
    }
  };
}

// --- the checks ------------------------------------------------------------

export const conformanceChecks: readonly ConformanceCheck[] = [
  // -- User: single-use token claims --------------------------------------
  check('user.consumeResetToken is single-use under concurrent claims', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    await repos.user.setPasswordResetToken(user.id, 'reset-hash', futureDate());

    const results = await parallel(5, () => repos.user.consumeResetToken('reset-hash'));
    const winners = results.filter((r) => r !== null);
    expect(winners, 'exactly one concurrent claim may win').toHaveLength(1);
    expect(winners[0]?.id).toBe(user.id);

    // A later attempt finds nothing, and the token is cleared off the user.
    expect(await repos.user.consumeResetToken('reset-hash')).toBeNull();
    const after = await repos.user.findById(user.id);
    expect(after?.passwordResetToken ?? null).toBeNull();
  }),

  check('user.consumeResetToken rejects and purges an expired token', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    await repos.user.setPasswordResetToken(user.id, 'reset-hash', pastDate());

    expect(await repos.user.consumeResetToken('reset-hash')).toBeNull();
    const after = await repos.user.findById(user.id);
    expect(after?.passwordResetToken ?? null, 'expired token must be purged').toBeNull();
  }),

  check(
    'user.consumeVerificationToken is single-use and flips emailVerified',
    [],
    async (repos, h) => {
      const user = await seedUser(repos, h.role);
      await repos.user.setVerificationToken(user.id, 'verify-hash', futureDate());

      const results = await parallel(5, () => repos.user.consumeVerificationToken('verify-hash'));
      const winners = results.filter((r) => r !== null);
      expect(winners, 'exactly one concurrent claim may win').toHaveLength(1);
      expect(winners[0]?.emailVerified, 'winner sees post-claim state').toBe(true);

      const after = await repos.user.findById(user.id);
      expect(after?.emailVerified).toBe(true);
      expect(after?.verificationToken ?? null).toBeNull();
    }
  ),

  check(
    'user.consumeVerificationToken rejects an expired token and stays unverified',
    [],
    async (repos, h) => {
      const user = await seedUser(repos, h.role);
      await repos.user.setVerificationToken(user.id, 'verify-hash', pastDate());

      expect(await repos.user.consumeVerificationToken('verify-hash')).toBeNull();
      const after = await repos.user.findById(user.id);
      expect(after?.emailVerified).toBe(false);
      expect(after?.verificationToken ?? null, 'expired token must be purged').toBeNull();
    }
  ),

  check(
    'user.create defaults emailVerified to false and honours an explicit true',
    [],
    async (repos, h) => {
      // Default: a freshly created account is unverified — the standard
      // password-signup path relies on this (a stray `true` would be a hole).
      const def = await seedUser(repos, h.role);
      expect((await repos.user.findById(def.id))?.emailVerified, 'defaults to false').toBe(false);

      // Explicit true: invited-signup pre-verification (register's
      // `autoVerifyInvited`) relies on the adapter persisting this verbatim.
      const pre = await repos.user.create({
        email: `pre-verified-${nextSeed()}@conformance.test`,
        name: 'Pre-verified',
        passwordHash: 'x',
        role: h.role,
        emailVerified: true
      });
      expect(pre.emailVerified, 'create() return reflects emailVerified').toBe(true);
      expect((await repos.user.findById(pre.id))?.emailVerified, 'persisted verified').toBe(true);
    }
  ),

  // -- User: email-change claim -------------------------------------------
  check(
    'user.consumeEmailChangeToken is single-use under concurrency and swaps the email',
    [],
    async (repos, h) => {
      const user = await seedUser(repos, h.role);
      const newEmail = `changed-${nextSeed()}@conformance.test`;
      await repos.user.setEmailChangeToken(user.id, newEmail, 'change-hash', futureDate());

      const results = await parallel(5, () => repos.user.consumeEmailChangeToken('change-hash'));
      const winners = results.filter((r) => r !== null);
      expect(winners, 'exactly one concurrent confirm may win').toHaveLength(1);
      expect(winners[0]?.email, 'winner sees the new address').toBe(newEmail);
      expect(winners[0]?.emailVerified, 'the new address is verified').toBe(true);

      const after = await repos.user.findById(user.id);
      expect(after?.email).toBe(newEmail);
      expect(after?.pendingEmail ?? null, 'pending change cleared').toBeNull();
      expect(after?.emailChangeToken ?? null, 'token cleared').toBeNull();
      // The user is now reachable under the new address, not the old one.
      expect(await repos.user.findByEmail(newEmail)).not.toBeNull();
    }
  ),

  check(
    'user.consumeEmailChangeToken rejects and purges an expired token',
    [],
    async (repos, h) => {
      const user = await seedUser(repos, h.role);
      const originalEmail = (await repos.user.findById(user.id))!.email;
      await repos.user.setEmailChangeToken(
        user.id,
        'expired@conformance.test',
        'c-hash',
        pastDate()
      );

      expect(await repos.user.consumeEmailChangeToken('c-hash')).toBeNull();
      const after = await repos.user.findById(user.id);
      expect(after?.email, 'address unchanged on expiry').toBe(originalEmail);
      expect(after?.emailChangeToken ?? null, 'expired token must be purged').toBeNull();
    }
  ),

  check(
    'user.consumeEmailChangeToken refuses a target email taken since the request',
    [],
    async (repos, h) => {
      const userA = await seedUser(repos, h.role, 'a');
      const originalEmail = (await repos.user.findById(userA.id))!.email;
      // Someone else owns the target address by the time the link is clicked.
      const userB = await seedUser(repos, h.role, 'b');
      await repos.user.setEmailChangeToken(userA.id, userB.email, 'c-hash', futureDate());

      expect(
        await repos.user.consumeEmailChangeToken('c-hash'),
        'collision must report a failed claim, never a duplicate email'
      ).toBeNull();
      const after = await repos.user.findById(userA.id);
      expect(after?.email, 'A keeps its address').toBe(originalEmail);
    }
  ),

  // -- User: profile update + delete --------------------------------------
  check('user.updateProfile patches only the provided fields', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    const originalEmail = (await repos.user.findById(user.id))!.email;

    await repos.user.updateProfile(user.id, { name: 'Renamed Conformance User' });
    const after = await repos.user.findById(user.id);
    expect(after?.name).toBe('Renamed Conformance User');
    expect(after?.email, 'email untouched by a name-only patch').toBe(originalEmail);
  }),

  check('user.delete removes the user row', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    expect(await repos.user.findById(user.id)).not.toBeNull();

    await repos.user.delete(user.id);
    expect(await repos.user.findById(user.id), 'user gone after delete').toBeNull();
  }),

  check('user.delete cascades the invitations the user sent', [], async (repos, h) => {
    // The one dependent the contract makes every adapter delete BY HAND: the
    // `invitedBy` relation has no schema-level cascade, so the Prisma adapter
    // pairs `invitation.deleteMany({ invitedById })` with the user delete in a
    // transaction (and the in-memory bundle mirrors it). The other dependents
    // (passkeys, tokens, …) ride on `onDelete: Cascade` — a schema guarantee
    // this store-agnostic suite cannot observe, so it pins exactly the
    // hand-written half.
    const inviter = await seedUser(repos, h.role, 'inviter');
    const other = await seedUser(repos, h.role, 'other');
    const doomedEmail = `invitee-${nextSeed()}@conformance.test`;
    await repos.invitation.create({ email: doomedEmail, role: h.role, invitedById: inviter.id });
    const kept = await repos.invitation.create({
      email: `kept-${nextSeed()}@conformance.test`,
      role: h.role,
      invitedById: other.id
    });

    await repos.user.delete(inviter.id);

    expect(
      await repos.invitation.findByEmail(doomedEmail),
      'sent invitation removed with its inviter'
    ).toBeNull();
    expect(
      await repos.invitation.findByEmail(kept.email),
      'another inviter’s invitation survives'
    ).not.toBeNull();
    expect(await repos.user.findById(other.id), 'unrelated user untouched').not.toBeNull();
  }),

  // -- User: plain writes persist (happy paths) ----------------------------
  check('user.updatePassword persists the new hash', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    await repos.user.updatePassword(user.id, 'new-hash');
    expect((await repos.user.findById(user.id))?.passwordHash, 'hash replaced').toBe('new-hash');
  }),

  check('user.setEmailVerified flips the flag', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    expect((await repos.user.findById(user.id))?.emailVerified).toBe(false);
    await repos.user.setEmailVerified(user.id);
    expect((await repos.user.findById(user.id))?.emailVerified, 'flag set').toBe(true);
  }),

  // -- User: TOTP secret lifecycle ----------------------------------------
  check('user.setTotpSecret / enableTotp / disableTotp round-trip', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    const fresh = await repos.user.findById(user.id);
    expect(fresh?.totpEnabled, 'a new user has 2FA off').toBe(false);
    expect(fresh?.totpSecret ?? null, 'and no secret').toBeNull();

    // Setup stages the (encrypted) secret but does NOT enable 2FA yet.
    await repos.user.setTotpSecret(user.id, 'encrypted-secret');
    const staged = await repos.user.findById(user.id);
    expect(staged?.totpSecret).toBe('encrypted-secret');
    expect(staged?.totpEnabled, 'setup alone does not enable').toBe(false);
    expect(staged?.totpConfirmedAt ?? null).toBeNull();

    // Enable flips the flag and stamps the confirmation, keeping the secret.
    await repos.user.enableTotp(user.id);
    const enabled = await repos.user.findById(user.id);
    expect(enabled?.totpEnabled).toBe(true);
    expect(enabled?.totpSecret).toBe('encrypted-secret');
    expect(enabled?.totpConfirmedAt, 'confirmation stamped').toBeInstanceOf(Date);

    // Disable clears the secret and the flags.
    await repos.user.disableTotp(user.id);
    const disabled = await repos.user.findById(user.id);
    expect(disabled?.totpEnabled).toBe(false);
    expect(disabled?.totpSecret ?? null, 'secret cleared on disable').toBeNull();
    expect(disabled?.totpConfirmedAt ?? null).toBeNull();
  }),

  // -- User: lossless atomic increments -----------------------------------
  check('user.incrementTokenVersion loses no concurrent increments', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    const before = (await repos.user.findById(user.id))?.tokenVersion ?? 0;

    await parallel(10, () => repos.user.incrementTokenVersion(user.id));

    const after = (await repos.user.findById(user.id))?.tokenVersion ?? 0;
    expect(after - before, '10 parallel increments must all land').toBe(10);
  }),

  check('user.recordFailedLogin counts atomically and locks at threshold', [], async (repos, h) => {
    const user = await seedUser(repos, h.role);
    const lockout = { maxAttempts: 5, durationMinutes: 15 };

    await parallel(5, () => repos.user.recordFailedLogin(user.id, lockout));

    const state = await repos.user.getFailedLoginAttempts(user.id);
    expect(state.count, '5 parallel failures must all be counted').toBe(5);
    expect(state.lockedUntil, 'reaching the threshold must lock').toBeInstanceOf(Date);

    await repos.user.resetFailedLogins(user.id);
    const reset = await repos.user.getFailedLoginAttempts(user.id);
    expect(reset.count).toBe(0);
    expect(reset.lockedUntil).toBeNull();
  }),

  // -- User: unique constraint --------------------------------------------
  check('user.create rejects a duplicate email', [], async (repos, h) => {
    const email = `dup-${nextSeed()}@conformance.test`;
    await repos.user.create({ email, name: 'A', passwordHash: 'x', role: h.role });
    await expect(
      repos.user.create({ email, name: 'B', passwordHash: 'y', role: h.role })
    ).rejects.toThrow();
  }),

  // -- Invitation: single claim -------------------------------------------
  check('invitation.markUsedIfUnused yields exactly one winner', [], async (repos, h) => {
    const [inviter] = await seedUserIds(repos, h.role, 'inv-winner');
    const inv = await repos.invitation.create({
      email: `inv-${nextSeed()}@conformance.test`,
      role: h.role,
      invitedById: inviter
    });

    const results = await parallel(5, () => repos.invitation.markUsedIfUnused(inv.id));
    expect(results.filter(Boolean), 'one invitation, one winner').toHaveLength(1);

    expect(await repos.invitation.markUsedIfUnused(inv.id), 'already used → false').toBe(false);

    const gone = await retiredInvitationId(repos, h.role, 'inv-gone');
    expect(await repos.invitation.markUsedIfUnused(gone), 'unknown → false').toBe(false);
  }),

  // -- Invitation: contract-field projection --------------------------------
  check('invitation results carry exactly the contract fields', [], async (repos, h) => {
    // Invitation results are serialized straight into the admin HTTP response
    // by createInvitationHandlers, so an adapter that passes raw rows through
    // leaks invitedById (and any consumer extra column) to the client. The
    // fake-Prisma harness stores invitedById on the row, giving this teeth.
    const CONTRACT_FIELDS = ['createdAt', 'email', 'id', 'role', 'usedAt'];
    const email = `inv-shape-${nextSeed()}@conformance.test`;
    const [inviter] = await seedUserIds(repos, h.role, 'inv-shape');
    const created = await repos.invitation.create({ email, role: h.role, invitedById: inviter });
    expect(Object.keys(created).sort(), 'create projects to the contract').toEqual(CONTRACT_FIELDS);

    const listed = (await repos.invitation.list()).find((i) => i.email === email);
    expect(listed, 'created invitation is listed').toBeDefined();
    expect(Object.keys(listed as object).sort(), 'list projects to the contract').toEqual(
      CONTRACT_FIELDS
    );

    const found = await repos.invitation.findByEmail(email);
    expect(Object.keys(found as object).sort(), 'findByEmail projects to the contract').toEqual(
      CONTRACT_FIELDS
    );

    // The absent-email path must resolve null, not throw inside the mapper —
    // it runs on every registration attempt and every first-time invite.
    expect(
      await repos.invitation.findByEmail(`absent-${nextSeed()}@conformance.test`),
      'absent email resolves null'
    ).toBeNull();
  }),

  // -- RefreshToken: CAS revoke + rotation race ---------------------------
  check(
    'refreshToken.revoke is a single-winner compare-and-set',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner] = await seedUserIds(repos, h.role, 'rt');
      const record = await repo.create({
        userId: owner,
        tokenHash: 'rt-hash',
        family: 'fam',
        expiresAt: futureDate()
      });

      const results = await parallel(5, () => repo.revoke(record.id));
      expect(results.filter(Boolean), 'exactly one revoke may win').toHaveLength(1);
      expect(await repo.revoke(record.id), 'already revoked → false').toBe(false);
    }
  ),

  check(
    'rotateRefreshToken serializes concurrent rotations to one winner',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const user = await seedUser(repos, h.role);
      const { token } = await issueRefreshToken(repo, user.id, ROTATION_CONFIG);
      const findUser = (id: string) => repos.user.findById(id);

      const outcomes = await parallel(5, () =>
        rotateRefreshToken(repo, token, findUser, ROTATION_CONFIG)
      );
      const rotated = outcomes.filter((o) => o.kind === 'rotated');
      expect(rotated, 'exactly one rotation produces a live successor').toHaveLength(1);
      expect(
        outcomes.every((o) => o.kind === 'rotated' || o.kind === 'race_ok'),
        'losers degrade to a benign race, never a second live token'
      ).toBe(true);
    }
  ),

  check(
    'refreshToken.revokeFamily / revokeAllForUser are correctly scoped',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [userX, userY] = await seedUserIds(repos, h.role, 'rt-x', 'rt-y');
      // Two families for userX, one for userY; the rows are looked up by hash.
      const tok = (userId: string, tokenHash: string, family: string) =>
        repo.create({ userId, tokenHash, family, expiresAt: futureDate() });
      await tok(userX, 'h-a', 'fam-a');
      await tok(userX, 'h-b', 'fam-b');
      await tok(userY, 'h-c', 'fam-c');

      await repo.revokeFamily('fam-a');
      expect((await repo.findByHash('h-a'))?.revokedAt, 'family-a revoked').toBeInstanceOf(Date);
      expect((await repo.findByHash('h-b'))?.revokedAt ?? null, 'family-b untouched').toBeNull();

      await repo.revokeAllForUser(userX);
      expect((await repo.findByHash('h-b'))?.revokedAt, 'user-x fully revoked').toBeInstanceOf(
        Date
      );
      expect((await repo.findByHash('h-c'))?.revokedAt ?? null, 'user-y untouched').toBeNull();
    }
  ),

  check(
    'refreshToken.deleteExpired removes only expired tokens',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner] = await seedUserIds(repos, h.role, 'rt-exp');
      await repo.create({
        userId: owner,
        tokenHash: 'expired',
        family: 'fam',
        expiresAt: pastDate()
      });
      await repo.create({
        userId: owner,
        tokenHash: 'live',
        family: 'fam',
        expiresAt: futureDate()
      });

      const deleted = await repo.deleteExpired();
      expect(deleted, 'one expired token deleted').toBe(1);
      expect(await repo.findByHash('expired')).toBeNull();
      expect(await repo.findByHash('live')).not.toBeNull();
    }
  ),

  // -- RefreshToken: session listing + scoped revokes ---------------------
  check(
    'refreshToken.listActiveByUser returns only the caller’s live tokens',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [userX, userY] = await seedUserIds(repos, h.role, 'rt-list-x', 'rt-list-y');
      await repo.create({
        userId: userX,
        tokenHash: 'live',
        family: 'f1',
        expiresAt: futureDate()
      });
      const revoked = await repo.create({
        userId: userX,
        tokenHash: 'rev',
        family: 'f2',
        expiresAt: futureDate()
      });
      await repo.revoke(revoked.id);
      await repo.create({ userId: userX, tokenHash: 'exp', family: 'f3', expiresAt: pastDate() });
      await repo.create({ userId: userY, tokenHash: 'oth', family: 'f4', expiresAt: futureDate() });

      const active = await repo.listActiveByUser(userX);
      // Only the non-revoked, unexpired token belonging to userX.
      expect(active.map((r) => r.tokenHash)).toEqual(['live']);
      expect(active[0]?.family).toBe('f1');
    }
  ),

  check(
    'refreshToken.revokeFamilyForUser is ownership-scoped (IDOR-safe)',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner, attacker] = await seedUserIds(repos, h.role, 'rt-fam', 'rt-attacker');
      await repo.create({
        userId: owner,
        tokenHash: 'h1',
        family: 'fam',
        expiresAt: futureDate()
      });

      // A non-owner must not be able to revoke another user's family. The
      // attacker is a real user, so an adapter that gates on existence rather
      // than ownership fails here.
      expect(await repo.revokeFamilyForUser(attacker, 'fam'), 'non-owner → false').toBe(false);
      expect((await repo.findByHash('h1'))?.revokedAt ?? null, 'still live').toBeNull();

      expect(await repo.revokeFamilyForUser(owner, 'fam'), 'owner → true').toBe(true);
      expect((await repo.findByHash('h1'))?.revokedAt, 'now revoked').toBeInstanceOf(Date);

      expect(await repo.revokeFamilyForUser(owner, 'fam'), 'already revoked → false').toBe(false);
    }
  ),

  check(
    'refreshToken.revokeOtherFamiliesForUser keeps one family and is user-scoped',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner, bystander] = await seedUserIds(repos, h.role, 'rt-keep', 'rt-bystander');
      await repo.create({
        userId: owner,
        tokenHash: 'keep',
        family: 'current',
        expiresAt: futureDate()
      });
      await repo.create({
        userId: owner,
        tokenHash: 'gone',
        family: 'other',
        expiresAt: futureDate()
      });
      await repo.create({
        userId: bystander,
        tokenHash: 'safe',
        family: 'bystander-fam',
        expiresAt: futureDate()
      });

      await repo.revokeOtherFamiliesForUser(owner, 'current');

      expect((await repo.findByHash('keep'))?.revokedAt ?? null, 'current kept').toBeNull();
      expect((await repo.findByHash('gone'))?.revokedAt, 'other family revoked').toBeInstanceOf(
        Date
      );
      expect(
        (await repo.findByHash('safe'))?.revokedAt ?? null,
        'another user untouched'
      ).toBeNull();
    }
  ),

  // -- Passkey: counter CAS + scope ---------------------------------------
  check(
    'passkey.updateCounter is a CAS that closes the clone window',
    ['passkey'],
    async (repos, h) => {
      const repo = need(repos.passkey, 'passkey');
      const [owner] = await seedUserIds(repos, h.role, 'pk-cas');
      await repo.create(owner, {
        credentialId: 'cred-1',
        publicKey: new Uint8Array([1, 2, 3]),
        publicKeyAlg: -7,
        counter: 10,
        aaguid: 'aaguid'
      });

      const results = await parallel(2, () => repo.updateCounter('cred-1', 11));
      expect(results.filter(Boolean), 'only one concurrent counter bump may win').toHaveLength(1);
      expect((await repo.findByCredentialId('cred-1'))?.counter).toBe(11);

      expect(await repo.updateCounter('cred-1', 11), 'equal counter is a replay → false').toBe(
        false
      );
      expect(await repo.updateCounter('cred-1', 5), 'lower counter is a replay → false').toBe(
        false
      );

      // counter 0 = counterless authenticator → touch only, keep stored counter.
      expect(await repo.updateCounter('cred-1', 0)).toBe(true);
      expect((await repo.findByCredentialId('cred-1'))?.counter).toBe(11);

      // A credential deleted between assertion-verify and the counter touch is a
      // no-op → false (the caller rejects it), never a store-level throw. Both
      // the CAS (counter > 0) and the counterless (counter 0) paths must honour
      // this so a concurrent delete can't 500 a passkey login.
      await repo.delete(owner, 'cred-1');
      expect(await repo.updateCounter('cred-1', 12), 'CAS on a deleted credential → false').toBe(
        false
      );
      expect(
        await repo.updateCounter('cred-1', 0),
        'counterless touch on a deleted credential → false'
      ).toBe(false);
    }
  ),

  check('passkey.delete is scoped to the owner', ['passkey'], async (repos, h) => {
    const repo = need(repos.passkey, 'passkey');
    const [owner, attacker] = await seedUserIds(repos, h.role, 'pk-del', 'pk-attacker');
    await repo.create(owner, {
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1]),
      publicKeyAlg: -7,
      counter: 0,
      aaguid: 'aaguid'
    });

    // A miss is a no-op, so this must return normally rather than throw.
    await repo.delete(attacker, 'cred-1');
    expect(await repo.findByCredentialId('cred-1'), 'non-owner cannot delete').not.toBeNull();

    await repo.delete(owner, 'cred-1');
    expect(await repo.findByCredentialId('cred-1'), 'owner can delete').toBeNull();
  }),

  check('passkey.rename is scoped to the owner', ['passkey'], async (repos, h) => {
    const repo = need(repos.passkey, 'passkey');
    const [owner, attacker] = await seedUserIds(repos, h.role, 'pk-rename', 'pk-rename-attacker');
    await repo.create(owner, {
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1]),
      publicKeyAlg: -7,
      counter: 0,
      aaguid: 'aaguid',
      name: 'Original'
    });

    // Same IDOR family as delete: knowing a credentialId must not let another
    // user relabel it (rename was the one unpinned member of that family).
    await repo.rename(attacker, 'cred-1', 'Hijacked');
    expect((await repo.findByCredentialId('cred-1'))?.name, 'non-owner cannot rename').toBe(
      'Original'
    );

    await repo.rename(owner, 'cred-1', 'My laptop');
    expect((await repo.findByCredentialId('cred-1'))?.name, 'owner can rename').toBe('My laptop');
  }),

  // -- Notification: ownership scope --------------------------------------
  check(
    'notification.markAsRead / delete are scoped to the owner',
    ['notification'],
    async (repos, h) => {
      const repo = need(repos.notification, 'notification');
      const [owner, attacker] = await seedUserIds(repos, h.role, 'nt-scope', 'nt-attacker');
      const n = await repo.create({ userId: owner, typeKey: 'security', title: 'New login' });

      // Both calls address a row that exists but is not the caller's. That is a
      // miss, and a miss is a silent no-op — the HTTP layer turns it into a 404,
      // so a throw here would surface as a 500 (see the id contract in types.ts).
      await repo.markAsRead(attacker, n.id);
      expect((await repo.findByUser(owner))[0]?.readAt ?? null, 'non-owner cannot read').toBeNull();

      await repo.delete(attacker, n.id);
      expect(await repo.findByUser(owner), 'non-owner cannot delete').toHaveLength(1);

      await repo.markAsRead(owner, n.id);
      expect((await repo.findByUser(owner))[0]?.readAt, 'owner can read').toBeInstanceOf(Date);
    }
  ),

  check(
    'notification.markAllAsRead and getUnreadCount are scoped to the user',
    ['notification'],
    async (repos, h) => {
      const repo = need(repos.notification, 'notification');
      const [owner, other] = await seedUserIds(repos, h.role, 'nt-owner', 'nt-bystander');
      await repo.create({ userId: owner, typeKey: 'security', title: 'one' });
      await repo.create({ userId: owner, typeKey: 'security', title: 'two' });
      const bystander = await repo.create({ userId: other, typeKey: 'security', title: 'b' });

      expect(await repo.getUnreadCount(owner), 'both rows start unread').toBe(2);

      await repo.markAllAsRead(owner);
      expect(await repo.getUnreadCount(owner), 'all of the owner’s rows read').toBe(0);
      expect(
        (await repo.findByUser(owner)).every((n) => n.readAt instanceof Date),
        'each row carries a read stamp'
      ).toBe(true);

      // The bulk write must not cross the user boundary.
      expect(await repo.getUnreadCount(other), 'bystander still unread').toBe(1);
      expect((await repo.findByUser(other))[0]?.id).toBe(bystander.id);
    }
  ),

  // -- User: missing-target writes are no-ops ------------------------------
  check('user write methods no-op on a missing user (TOCTOU safety)', [], async (repos, h) => {
    // The account can be deleted between a handler's session check and its
    // write; the contract demands a silent no-op, not a P2025-style throw
    // that surfaces as a 500. The reference Prisma adapter violated this on
    // ~10 methods before the conformance pin (review R7).
    //
    // The id is a real one that has been deleted, not an invented literal —
    // this is exactly the race the check describes, and it is the only form
    // that also works against a typed id column.
    const ghost = await retiredUserId(repos, h.role, 'ghost');

    await repos.user.updatePassword(ghost, 'hash');
    await repos.user.setEmailVerified(ghost);
    await repos.user.setVerificationToken(ghost, 'vt-ghost', futureDate());
    await repos.user.setPasswordResetToken(ghost, 'rt-ghost', futureDate());
    await repos.user.recordFailedLogin(ghost, { maxAttempts: 5, durationMinutes: 15 });
    await repos.user.resetFailedLogins(ghost);
    await repos.user.updateProfile(ghost, { name: 'Ghost' });
    await repos.user.setEmailChangeToken(ghost, 'ghost@conformance.test', 'ct-ghost', futureDate());
    await repos.user.setTotpSecret(ghost, 'enc-secret');
    await repos.user.enableTotp(ghost);
    await repos.user.disableTotp(ghost);
    await repos.user.incrementTokenVersion(ghost);

    // None of the writes may have materialized a row.
    expect(await repos.user.findById(ghost), 'no row was created').toBeNull();
  }),

  // -- Ids: a value the store cannot represent is a miss --------------------
  check('an id the store cannot represent reads as a miss, not an error', [], async (repos, h) => {
    // Every argument below arrives from outside — a URL segment, a request
    // body — so none of them is guaranteed to fit the column. Against `text`
    // any string fits and this check is trivially true; against a native
    // `uuid` or integer key the database rejects the *syntax* (Postgres 22P02,
    // Prisma P2023) on reads as much as on writes, and the adapter has to
    // translate that into the miss. Without it the 404 these endpoints
    // document becomes a 500, and a malformed id is a way to fail them.
    const UNREPRESENTABLE = 'not-an-id';
    const [owner] = await seedUserIds(repos, h.role, 'unrep');

    expect(await repos.user.findById(UNREPRESENTABLE), 'user.findById → null').toBeNull();
    await repos.user.delete(UNREPRESENTABLE);
    expect(await repos.invitation.markUsedIfUnused(UNREPRESENTABLE), 'invitation → false').toBe(
      false
    );

    // The optional repositories are exercised when the harness declares them —
    // the rule is about the id argument, not about any one repository, and
    // gating the whole check on a capability would leave it untested.
    if (repos.refreshToken) {
      expect(
        await repos.refreshToken.revokeFamilyForUser(UNREPRESENTABLE, 'fam'),
        'refreshToken.revokeFamilyForUser → false'
      ).toBe(false);
      expect(
        await repos.refreshToken.listActiveByUser(UNREPRESENTABLE),
        'refreshToken.listActiveByUser → []'
      ).toEqual([]);
    }

    if (repos.notification) {
      const n = await repos.notification.create({
        userId: owner,
        typeKey: 'security',
        title: 'untouched'
      });
      // Unrepresentable in the owner position …
      await repos.notification.markAsRead(UNREPRESENTABLE, n.id);
      await repos.notification.delete(UNREPRESENTABLE, n.id);
      // … and in the row position.
      await repos.notification.markAsRead(owner, UNREPRESENTABLE);
      await repos.notification.delete(owner, UNREPRESENTABLE);
      expect(await repos.notification.getUnreadCount(owner), 'the owner row is untouched').toBe(1);
    }

    if (repos.backupCode) {
      expect(
        await repos.backupCode.consumeIfUnused(UNREPRESENTABLE, 'code-hash'),
        'backupCode.consumeIfUnused → false'
      ).toBe(false);
    }

    if (repos.passkey) await repos.passkey.delete(UNREPRESENTABLE, 'cred-unrep');
    if (repos.pushSubscription) {
      await repos.pushSubscription.delete(UNREPRESENTABLE, 'https://push.test/unrep');
    }
    if (repos.notificationPreference) {
      expect(
        await repos.notificationPreference.findByUser(UNREPRESENTABLE),
        'notificationPreference.findByUser → []'
      ).toEqual([]);
    }
  }),

  // -- Notification: list filters ------------------------------------------
  check(
    'notification.findByUser honors unreadOnly and limit',
    ['notification'],
    async (repos, h) => {
      const repo = need(repos.notification, 'notification');
      const [owner] = await seedUserIds(repos, h.role, 'nt-filter');
      const a = await repo.create({ userId: owner, typeKey: 'security', title: 'first' });
      const b = await repo.create({ userId: owner, typeKey: 'security', title: 'second' });
      const c = await repo.create({ userId: owner, typeKey: 'security', title: 'third' });
      await repo.markAsRead(owner, b.id);

      // The client store's `unreadOnly` toggle rides on this translation
      // (`readAt: null` in SQL adapters) — a wrong filter shows read rows in
      // an "unread" view. Order is deliberately not asserted: it is not part
      // of the documented contract.
      const unread = await repo.findByUser(owner, { unreadOnly: true });
      expect(unread.map((n) => n.id).sort(), 'unreadOnly returns exactly the unread rows').toEqual(
        [a.id, c.id].sort()
      );

      const limited = await repo.findByUser(owner, { limit: 2 });
      expect(limited, 'limit caps the result count').toHaveLength(2);

      const all = await repo.findByUser(owner);
      expect(all, 'no options returns everything').toHaveLength(3);
    }
  ),

  // -- Push subscription: ownership scope ---------------------------------
  check(
    'pushSubscription.delete is scoped to the owner',
    ['pushSubscription'],
    async (repos, h) => {
      const repo = need(repos.pushSubscription, 'pushSubscription');
      const [owner, attacker] = await seedUserIds(repos, h.role, 'ps-del', 'ps-del-attacker');
      const endpoint = 'https://push.test/endpoint-1';
      await repo.create(owner, { endpoint, keys: { p256dh: 'p', auth: 'a' } });

      // An attacker who knows the endpoint URL must not delete the owner's row.
      await repo.delete(attacker, endpoint);
      expect(await repo.findByUser(owner), 'non-owner cannot delete').toHaveLength(1);

      await repo.delete(owner, endpoint);
      expect(await repo.findByUser(owner), 'owner can delete').toHaveLength(0);
    }
  ),

  // -- Push subscription: upsert-by-endpoint, key-gated reassign -----------
  check(
    'pushSubscription.create upserts by endpoint and gates the reassign on key match',
    ['pushSubscription'],
    async (repos, h) => {
      const repo = need(repos.pushSubscription, 'pushSubscription');
      const [owner, other, attacker] = await seedUserIds(
        repos,
        h.role,
        'ps-owner',
        'ps-other',
        'ps-attacker'
      );
      const endpoint = 'https://push.test/endpoint-upsert';
      // Decodable base64url so adapters comparing decoded bytes get real input.
      const KEYS_A = { p256dh: 'cDE', auth: 'YTE' };
      const KEYS_B = { p256dh: 'cDI', auth: 'YTI' };
      const KEYS_ATTACKER = { p256dh: 'cDM', auth: 'YTM' };

      // The browser re-sends its *existing* subscription on every re-enable,
      // so the duplicate POST is the normal case — it must update in place,
      // not throw on the unique endpoint (works-in-dev/500-in-prod class).
      expect(await repo.create(owner, { endpoint, keys: KEYS_A }), 'new row').toBe('created');
      expect(
        await repo.create(owner, { endpoint, keys: KEYS_B }),
        'same owner may rotate keys'
      ).toBe('updated');

      const owned = await repo.findByUser(owner);
      expect(owned, 're-subscribe keeps a single row').toHaveLength(1);
      expect(owned[0].keys.p256dh, 'keys are updated in place').toBe(KEYS_B.p256dh);

      // After a user switch in the same browser profile, the browser re-sends
      // the SAME subscription (endpoint + keys): key possession proves the
      // device, so the endpoint follows the newly subscribed account.
      expect(await repo.create(other, { endpoint, keys: KEYS_B }), 'matching keys reassign').toBe(
        'reassigned'
      );
      expect(await repo.findByUser(owner), 'previous owner released').toHaveLength(0);
      const reassigned = await repo.findByUser(other);
      expect(reassigned, 'latest subscriber owns the row').toHaveLength(1);

      // Merely knowing the endpoint URL (say, from a log) must NOT take the
      // row over: without the matching keys the write is refused untouched.
      expect(
        await repo.create(attacker, { endpoint, keys: KEYS_ATTACKER }),
        'mismatching keys are rejected'
      ).toBe('rejected');
      const kept = await repo.findByUser(other);
      expect(kept, 'row still belongs to the previous owner').toHaveLength(1);
      expect(kept[0].keys.p256dh, 'keys untouched by the rejected write').toBe(KEYS_B.p256dh);
      expect(await repo.findByUser(attacker), 'attacker gained nothing').toHaveLength(0);
    }
  ),

  // -- Notification preference: per-(user,type) upsert --------------------
  check(
    'notificationPreference.upsert is per-(user,type) and merges',
    ['notificationPreference'],
    async (repos, h) => {
      const repo = need(repos.notificationPreference, 'notificationPreference');
      const [owner, other] = await seedUserIds(repos, h.role, 'np-owner', 'np-other');
      await repo.upsert(owner, 'security', { push: false });
      expect(await repo.findByUser(owner)).toEqual([
        { typeKey: 'security', sse: true, push: false, email: true }
      ]);

      // A second upsert merges rather than replacing the whole row.
      await repo.upsert(owner, 'security', { email: false });
      expect(await repo.findByUser(owner)).toEqual([
        { typeKey: 'security', sse: true, push: false, email: false }
      ]);

      // A different user's preferences are independent.
      await repo.upsert(other, 'security', { sse: false });
      expect(await repo.findByUser(owner), 'owner row untouched').toHaveLength(1);
    }
  ),

  // -- Backup codes: single-use claim + owner scope -----------------------
  check(
    'backupCode.consumeIfUnused is single-use under concurrency and owner-scoped',
    ['backupCode'],
    async (repos, h) => {
      const repo = need(repos.backupCode, 'backupCode');
      const [owner, attacker] = await seedUserIds(repos, h.role, 'bc-owner', 'bc-attacker');
      await repo.createMany(owner, ['hash-a', 'hash-b']);

      // Exactly one of N concurrent redemptions of the same code may win.
      const results = await parallel(5, () => repo.consumeIfUnused(owner, 'hash-a'));
      expect(results.filter(Boolean), 'one code, one winner').toHaveLength(1);
      // A later redemption of the same (now used) code finds nothing.
      expect(await repo.consumeIfUnused(owner, 'hash-a'), 'already used → false').toBe(false);
      // The other code is still redeemable.
      expect(await repo.consumeIfUnused(owner, 'hash-b'), 'unused code → true').toBe(true);

      // A non-owner cannot redeem the owner's codes (IDOR), and an unknown code
      // is rejected.
      await repo.createMany(owner, ['hash-c']);
      expect(await repo.consumeIfUnused(attacker, 'hash-c'), 'non-owner → false').toBe(false);
      expect(await repo.consumeIfUnused(owner, 'unknown-hash'), 'unknown → false').toBe(false);
      expect(await repo.consumeIfUnused(owner, 'hash-c'), 'owner can still redeem').toBe(true);
    }
  ),

  check(
    'backupCode.deleteAll removes only the caller’s codes',
    ['backupCode'],
    async (repos, h) => {
      const repo = need(repos.backupCode, 'backupCode');
      const [owner, bystander] = await seedUserIds(repos, h.role, 'bc-del', 'bc-bystander');
      await repo.createMany(owner, ['h1', 'h2']);
      await repo.createMany(bystander, ['h3']);

      await repo.deleteAll(owner);
      expect(await repo.consumeIfUnused(owner, 'h1'), 'owner codes gone').toBe(false);
      expect(await repo.consumeIfUnused(owner, 'h2'), 'owner codes gone').toBe(false);
      // Another user's codes are untouched.
      expect(await repo.consumeIfUnused(bystander, 'h3'), 'bystander untouched').toBe(true);
    }
  ),

  check(
    'federatedAccount link + findByFederatedId round-trip (and unknown → null)',
    ['federatedAccount'],
    async (repos, h) => {
      const repo = need(repos.federatedAccount, 'federatedAccount');
      const [local1] = await seedUserIds(repos, h.role, 'fa-local1');
      const ISSUER = 'https://auth.conformance.test';

      expect(await repo.findByFederatedId(ISSUER, 'idp-1'), 'unlinked → null').toBeNull();

      const link = await repo.linkFederatedAccount(local1, { issuer: ISSUER, subject: 'idp-1' });
      expect(link).toMatchObject({ issuer: ISSUER, subject: 'idp-1', userId: local1 });
      expect(link.createdAt).toBeInstanceOf(Date);

      const found = await repo.findByFederatedId(ISSUER, 'idp-1');
      expect(found?.userId, 'link resolves to the local user').toBe(local1);
      // The composite key is (issuer, subject) — the same subject under
      // another issuer label is a different identity.
      expect(await repo.findByFederatedId('https://other.test', 'idp-1')).toBeNull();
    }
  ),

  check(
    'federatedAccount.linkFederatedAccount is idempotent for the same user and refuses a re-link to another',
    ['federatedAccount'],
    async (repos, h) => {
      const repo = need(repos.federatedAccount, 'federatedAccount');
      const [local1, local2] = await seedUserIds(repos, h.role, 'fa-idem1', 'fa-idem2');
      const ISSUER = 'https://auth.conformance.test';
      await repo.linkFederatedAccount(local1, { issuer: ISSUER, subject: 'idp-1' });

      // Idempotent re-link for the identical triple.
      const again = await repo.linkFederatedAccount(local1, {
        issuer: ISSUER,
        subject: 'idp-1'
      });
      expect(again.userId).toBe(local1);

      // A different local user must NOT silently take the identity over
      // (account-takeover primitive) — the contract demands a throw …
      await expect(
        repo.linkFederatedAccount(local2, { issuer: ISSUER, subject: 'idp-1' })
      ).rejects.toThrow();
      // … and the original link must survive intact.
      expect((await repo.findByFederatedId(ISSUER, 'idp-1'))?.userId).toBe(local1);
    }
  ),

  check(
    'federatedAccount link is single-winner under concurrency',
    ['federatedAccount'],
    async (repos, h) => {
      const repo = need(repos.federatedAccount, 'federatedAccount');
      const [localA, localB] = await seedUserIds(repos, h.role, 'fa-race-a', 'fa-race-b');
      const ISSUER = 'https://auth.conformance.test';

      // Two users racing to claim the same federated identity: exactly one
      // may hold the link afterwards; the loser throws (tolerated here — the
      // end state is what the contract pins).
      await Promise.all([
        tolerate(() => repo.linkFederatedAccount(localA, { issuer: ISSUER, subject: 'race' })),
        tolerate(() => repo.linkFederatedAccount(localB, { issuer: ISSUER, subject: 'race' }))
      ]);

      const winner = await repo.findByFederatedId(ISSUER, 'race');
      expect(winner, 'exactly one link exists').not.toBeNull();
      expect([localA, localB]).toContain(winner?.userId);
    }
  ),

  check(
    'federatedAccount.unlinkFederatedAccount is owner-scoped and enables the explicit re-link',
    ['federatedAccount'],
    async (repos, h) => {
      const repo = need(repos.federatedAccount, 'federatedAccount');
      const [local1, local2] = await seedUserIds(repos, h.role, 'fa-unlink1', 'fa-unlink2');
      const ISSUER = 'https://auth.conformance.test';
      await repo.linkFederatedAccount(local1, { issuer: ISSUER, subject: 'idp-1' });

      // A non-owner cannot free the identity — unlink→re-link would otherwise
      // be the account-takeover primitive laundered through two steps.
      expect(
        await repo.unlinkFederatedAccount(local2, { issuer: ISSUER, subject: 'idp-1' }),
        'non-owner → false'
      ).toBe(false);
      expect((await repo.findByFederatedId(ISSUER, 'idp-1'))?.userId, 'link survives').toBe(local1);
      // An unknown pair reports false, not an error.
      expect(await repo.unlinkFederatedAccount(local1, { issuer: ISSUER, subject: 'ghost' })).toBe(
        false
      );

      // The owner's unlink removes the link exactly once …
      expect(await repo.unlinkFederatedAccount(local1, { issuer: ISSUER, subject: 'idp-1' })).toBe(
        true
      );
      expect(await repo.findByFederatedId(ISSUER, 'idp-1')).toBeNull();
      expect(
        await repo.unlinkFederatedAccount(local1, { issuer: ISSUER, subject: 'idp-1' }),
        'second unlink → false'
      ).toBe(false);

      // … and the freed identity can be linked to another user — the
      // "unlink it explicitly first" flow the link-conflict error points to.
      const relinked = await repo.linkFederatedAccount(local2, {
        issuer: ISSUER,
        subject: 'idp-1'
      });
      expect(relinked.userId).toBe(local2);
    }
  )
];

// --- the describe wrapper --------------------------------------------------

export interface ConformanceOptions {
  /**
   * The test runner to assert through. Required unless one was registered
   * already — which the vitest entry
   * (`@urbicon-ui/auth/server/adapters/conformance`) does for you.
   */
  runner?: ConformanceRunner;
  /** Run only these checks (by name). */
  only?: string[];
  /** Skip these checks (by name) on top of capability gating. */
  skip?: string[];
}

/**
 * Register the full conformance suite for `harness` under a `describe` block.
 * Capability-gated checks the harness does not declare are reported as skipped.
 */
export function describeRepositoryConformance(
  name: string,
  harness: ConformanceHarness,
  options?: ConformanceOptions
): void {
  if (options?.runner) setConformanceRunner(options.runner);
  describe(`adapter conformance: ${name}`, () => {
    for (const c of conformanceChecks) {
      const capable = c.requires.every((r) => harness.capabilities?.[r]);
      const skipped =
        !capable ||
        options?.skip?.includes(c.name) ||
        (options?.only && !options.only.includes(c.name));
      if (skipped) {
        it.skip(c.name, () => {});
      } else {
        it(c.name, () => c.run(harness));
      }
    }
  });
}
