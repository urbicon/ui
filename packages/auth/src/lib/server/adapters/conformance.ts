import { describe, expect, it } from 'vitest';
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
 * The suite needs `vitest` at runtime — call it from a `*.test.ts` file.
 */

/** Optional repositories an adapter may implement; gates the matching checks. */
export interface ConformanceCapabilities {
  refreshToken?: boolean;
  passkey?: boolean;
  notification?: boolean;
  pushSubscription?: boolean;
  notificationPreference?: boolean;
  backupCode?: boolean;
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
 * A scope guard may signal "not yours" by either throwing (Prisma's P2025) or
 * no-op'ing — both satisfy the contract. The check asserts the *end state*, so
 * the call itself is allowed to throw.
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
  check('invitation.markUsedIfUnused yields exactly one winner', [], async (repos) => {
    const inv = await repos.invitation.create({
      email: `inv-${nextSeed()}@conformance.test`,
      role: 'USER',
      invitedById: 'admin'
    });

    const results = await parallel(5, () => repos.invitation.markUsedIfUnused(inv.id));
    expect(results.filter(Boolean), 'one invitation, one winner').toHaveLength(1);

    expect(await repos.invitation.markUsedIfUnused(inv.id), 'already used → false').toBe(false);
    expect(await repos.invitation.markUsedIfUnused('does-not-exist'), 'unknown → false').toBe(
      false
    );
  }),

  // -- Invitation: contract-field projection --------------------------------
  check('invitation results carry exactly the contract fields', [], async (repos) => {
    // Invitation results are serialized straight into the admin HTTP response
    // by createInvitationHandlers, so an adapter that passes raw rows through
    // leaks invitedById (and any consumer extra column) to the client. The
    // fake-Prisma harness stores invitedById on the row, giving this teeth.
    const CONTRACT_FIELDS = ['createdAt', 'email', 'id', 'role', 'usedAt'];
    const email = `inv-shape-${nextSeed()}@conformance.test`;
    const created = await repos.invitation.create({ email, role: 'USER', invitedById: 'admin' });
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
  }),

  // -- RefreshToken: CAS revoke + rotation race ---------------------------
  check(
    'refreshToken.revoke is a single-winner compare-and-set',
    ['refreshToken'],
    async (repos) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const record = await repo.create({
        userId: 'user-rt',
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
    async (repos) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      // Two families for user-x, one for user-y; the rows are looked up by hash.
      const tok = (userId: string, tokenHash: string, family: string) =>
        repo.create({ userId, tokenHash, family, expiresAt: futureDate() });
      await tok('user-x', 'h-a', 'fam-a');
      await tok('user-x', 'h-b', 'fam-b');
      await tok('user-y', 'h-c', 'fam-c');

      await repo.revokeFamily('fam-a');
      expect((await repo.findByHash('h-a'))?.revokedAt, 'family-a revoked').toBeInstanceOf(Date);
      expect((await repo.findByHash('h-b'))?.revokedAt ?? null, 'family-b untouched').toBeNull();

      await repo.revokeAllForUser('user-x');
      expect((await repo.findByHash('h-b'))?.revokedAt, 'user-x fully revoked').toBeInstanceOf(
        Date
      );
      expect((await repo.findByHash('h-c'))?.revokedAt ?? null, 'user-y untouched').toBeNull();
    }
  ),

  check(
    'refreshToken.deleteExpired removes only expired tokens',
    ['refreshToken'],
    async (repos) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      await repo.create({
        userId: 'user-x',
        tokenHash: 'expired',
        family: 'fam',
        expiresAt: pastDate()
      });
      await repo.create({
        userId: 'user-x',
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
    async (repos) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      await repo.create({
        userId: 'u-x',
        tokenHash: 'live',
        family: 'f1',
        expiresAt: futureDate()
      });
      const revoked = await repo.create({
        userId: 'u-x',
        tokenHash: 'rev',
        family: 'f2',
        expiresAt: futureDate()
      });
      await repo.revoke(revoked.id);
      await repo.create({ userId: 'u-x', tokenHash: 'exp', family: 'f3', expiresAt: pastDate() });
      await repo.create({ userId: 'u-y', tokenHash: 'oth', family: 'f4', expiresAt: futureDate() });

      const active = await repo.listActiveByUser('u-x');
      // Only the non-revoked, unexpired token belonging to u-x.
      expect(active.map((r) => r.tokenHash)).toEqual(['live']);
      expect(active[0]?.family).toBe('f1');
    }
  ),

  check(
    'refreshToken.revokeFamilyForUser is ownership-scoped (IDOR-safe)',
    ['refreshToken'],
    async (repos) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      await repo.create({
        userId: 'owner',
        tokenHash: 'h1',
        family: 'fam',
        expiresAt: futureDate()
      });

      // A non-owner must not be able to revoke another user's family.
      expect(await repo.revokeFamilyForUser('attacker', 'fam'), 'non-owner → false').toBe(false);
      expect((await repo.findByHash('h1'))?.revokedAt ?? null, 'still live').toBeNull();

      expect(await repo.revokeFamilyForUser('owner', 'fam'), 'owner → true').toBe(true);
      expect((await repo.findByHash('h1'))?.revokedAt, 'now revoked').toBeInstanceOf(Date);

      expect(await repo.revokeFamilyForUser('owner', 'fam'), 'already revoked → false').toBe(false);
    }
  ),

  check(
    'refreshToken.revokeOtherFamiliesForUser keeps one family and is user-scoped',
    ['refreshToken'],
    async (repos) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      await repo.create({
        userId: 'owner',
        tokenHash: 'keep',
        family: 'current',
        expiresAt: futureDate()
      });
      await repo.create({
        userId: 'owner',
        tokenHash: 'gone',
        family: 'other',
        expiresAt: futureDate()
      });
      await repo.create({
        userId: 'bystander',
        tokenHash: 'safe',
        family: 'bystander-fam',
        expiresAt: futureDate()
      });

      await repo.revokeOtherFamiliesForUser('owner', 'current');

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
    async (repos) => {
      const repo = need(repos.passkey, 'passkey');
      await repo.create('user-x', {
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
    }
  ),

  check('passkey.delete is scoped to the owner', ['passkey'], async (repos) => {
    const repo = need(repos.passkey, 'passkey');
    await repo.create('owner', {
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1]),
      publicKeyAlg: -7,
      counter: 0,
      aaguid: 'aaguid'
    });

    await tolerate(() => repo.delete('cred-1', 'attacker'));
    expect(await repo.findByCredentialId('cred-1'), 'non-owner cannot delete').not.toBeNull();

    await repo.delete('cred-1', 'owner');
    expect(await repo.findByCredentialId('cred-1'), 'owner can delete').toBeNull();
  }),

  // -- Notification: ownership scope --------------------------------------
  check(
    'notification.markAsRead / delete are scoped to the owner',
    ['notification'],
    async (repos) => {
      const repo = need(repos.notification, 'notification');
      const n = await repo.create({ userId: 'owner', typeKey: 'security', title: 'New login' });

      await tolerate(() => repo.markAsRead(n.id, 'attacker'));
      expect(
        (await repo.findByUser('owner'))[0]?.readAt ?? null,
        'non-owner cannot read'
      ).toBeNull();

      await tolerate(() => repo.delete(n.id, 'attacker'));
      expect(await repo.findByUser('owner'), 'non-owner cannot delete').toHaveLength(1);

      await repo.markAsRead(n.id, 'owner');
      expect((await repo.findByUser('owner'))[0]?.readAt, 'owner can read').toBeInstanceOf(Date);
    }
  ),

  // -- User: missing-target writes are no-ops ------------------------------
  check('user write methods no-op on a missing user (TOCTOU safety)', [], async (repos) => {
    // The account can be deleted between a handler's session check and its
    // write; the contract demands a silent no-op, not a P2025-style throw
    // that surfaces as a 500. The reference Prisma adapter violated this on
    // ~10 methods before the conformance pin (review R7).
    const ghost = 'no-such-user-id';

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

  // -- Notification: list filters ------------------------------------------
  check('notification.findByUser honors unreadOnly and limit', ['notification'], async (repos) => {
    const repo = need(repos.notification, 'notification');
    const a = await repo.create({ userId: 'owner', typeKey: 'security', title: 'first' });
    const b = await repo.create({ userId: 'owner', typeKey: 'security', title: 'second' });
    const c = await repo.create({ userId: 'owner', typeKey: 'security', title: 'third' });
    await repo.markAsRead(b.id, 'owner');

    // The client store's `unreadOnly` toggle rides on this translation
    // (`readAt: null` in SQL adapters) — a wrong filter shows read rows in
    // an "unread" view. Order is deliberately not asserted: it is not part
    // of the documented contract.
    const unread = await repo.findByUser('owner', { unreadOnly: true });
    expect(unread.map((n) => n.id).sort(), 'unreadOnly returns exactly the unread rows').toEqual(
      [a.id, c.id].sort()
    );

    const limited = await repo.findByUser('owner', { limit: 2 });
    expect(limited, 'limit caps the result count').toHaveLength(2);

    const all = await repo.findByUser('owner');
    expect(all, 'no options returns everything').toHaveLength(3);
  }),

  // -- Push subscription: ownership scope ---------------------------------
  check('pushSubscription.delete is scoped to the owner', ['pushSubscription'], async (repos) => {
    const repo = need(repos.pushSubscription, 'pushSubscription');
    const endpoint = 'https://push.test/endpoint-1';
    await repo.create('owner', { endpoint, keys: { p256dh: 'p', auth: 'a' } });

    // An attacker who knows the endpoint URL must not delete the owner's row.
    await tolerate(() => repo.delete('attacker', endpoint));
    expect(await repo.findByUser('owner'), 'non-owner cannot delete').toHaveLength(1);

    await repo.delete('owner', endpoint);
    expect(await repo.findByUser('owner'), 'owner can delete').toHaveLength(0);
  }),

  // -- Push subscription: upsert-by-endpoint -------------------------------
  check(
    'pushSubscription.create upserts by endpoint (re-subscribe + owner reassign)',
    ['pushSubscription'],
    async (repos) => {
      const repo = need(repos.pushSubscription, 'pushSubscription');
      const endpoint = 'https://push.test/endpoint-upsert';

      // The browser re-sends its *existing* subscription on every re-enable,
      // so the duplicate POST is the normal case — it must update in place,
      // not throw on the unique endpoint (works-in-dev/500-in-prod class).
      await repo.create('owner', { endpoint, keys: { p256dh: 'p1', auth: 'a1' } });
      await repo.create('owner', { endpoint, keys: { p256dh: 'p2', auth: 'a2' } });

      const owned = await repo.findByUser('owner');
      expect(owned, 're-subscribe keeps a single row').toHaveLength(1);
      expect(owned[0].keys.p256dh, 'keys are updated in place').toBe('p2');

      // After a user switch in the same browser profile, the endpoint follows
      // the newly subscribed account — the previous owner's notifications
      // must stop pushing to this device.
      await repo.create('other', { endpoint, keys: { p256dh: 'p3', auth: 'a3' } });
      expect(await repo.findByUser('owner'), 'previous owner released').toHaveLength(0);
      const reassigned = await repo.findByUser('other');
      expect(reassigned, 'latest subscriber owns the row').toHaveLength(1);
      expect(reassigned[0].keys.p256dh).toBe('p3');
    }
  ),

  // -- Notification preference: per-(user,type) upsert --------------------
  check(
    'notificationPreference.upsert is per-(user,type) and merges',
    ['notificationPreference'],
    async (repos) => {
      const repo = need(repos.notificationPreference, 'notificationPreference');
      await repo.upsert('owner', 'security', { push: false });
      expect(await repo.findByUser('owner')).toEqual([
        { typeKey: 'security', sse: true, push: false, email: true }
      ]);

      // A second upsert merges rather than replacing the whole row.
      await repo.upsert('owner', 'security', { email: false });
      expect(await repo.findByUser('owner')).toEqual([
        { typeKey: 'security', sse: true, push: false, email: false }
      ]);

      // A different user's preferences are independent.
      await repo.upsert('other', 'security', { sse: false });
      expect(await repo.findByUser('owner'), 'owner row untouched').toHaveLength(1);
    }
  ),

  // -- Backup codes: single-use claim + owner scope -----------------------
  check(
    'backupCode.consumeIfUnused is single-use under concurrency and owner-scoped',
    ['backupCode'],
    async (repos) => {
      const repo = need(repos.backupCode, 'backupCode');
      await repo.createMany('owner', ['hash-a', 'hash-b']);

      // Exactly one of N concurrent redemptions of the same code may win.
      const results = await parallel(5, () => repo.consumeIfUnused('owner', 'hash-a'));
      expect(results.filter(Boolean), 'one code, one winner').toHaveLength(1);
      // A later redemption of the same (now used) code finds nothing.
      expect(await repo.consumeIfUnused('owner', 'hash-a'), 'already used → false').toBe(false);
      // The other code is still redeemable.
      expect(await repo.consumeIfUnused('owner', 'hash-b'), 'unused code → true').toBe(true);

      // A non-owner cannot redeem the owner's codes (IDOR), and an unknown code
      // is rejected.
      await repo.createMany('owner', ['hash-c']);
      expect(await repo.consumeIfUnused('attacker', 'hash-c'), 'non-owner → false').toBe(false);
      expect(await repo.consumeIfUnused('owner', 'unknown-hash'), 'unknown → false').toBe(false);
      expect(await repo.consumeIfUnused('owner', 'hash-c'), 'owner can still redeem').toBe(true);
    }
  ),

  check('backupCode.deleteAll removes only the caller’s codes', ['backupCode'], async (repos) => {
    const repo = need(repos.backupCode, 'backupCode');
    await repo.createMany('owner', ['h1', 'h2']);
    await repo.createMany('bystander', ['h3']);

    await repo.deleteAll('owner');
    expect(await repo.consumeIfUnused('owner', 'h1'), 'owner codes gone').toBe(false);
    expect(await repo.consumeIfUnused('owner', 'h2'), 'owner codes gone').toBe(false);
    // Another user's codes are untouched.
    expect(await repo.consumeIfUnused('bystander', 'h3'), 'bystander untouched').toBe(true);
  })
];

// --- the describe wrapper --------------------------------------------------

export interface ConformanceOptions {
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
