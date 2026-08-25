import type { RefreshTokenConfig } from '../../types.js';
import { issueRefreshToken, rotateRefreshToken } from '../refresh-token.js';
import type { Passkey, Repositories } from './types.js';

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
 *   capabilities: {
 *     refreshToken: true,
 *     passkey: true,
 *     notification: true,
 *     pushSubscription: true,
 *     notificationPreference: true,
 *     backupCode: true,
 *     federatedAccount: true
 *   },
 *   setup: () => createMyAdapter(freshTestDatabase())
 * });
 * ```
 *
 * `setup()` MUST return a clean, isolated repository set on every call — the
 * suite calls it once per check and assumes no shared state between checks
 * (wipe the schema, use a fresh transaction, or hand back new in-memory maps).
 * `capabilities` gates the optional-repository checks: a check whose required
 * repos you do not declare is reported as skipped rather than failing. List
 * every optional repository and set the ones you do not implement to `false` —
 * an omitted key reads as "not implemented" and silently drops its checks. The
 * suite title states how many checks ran and which repositories were left
 * undeclared, so a truncated list is visible in the output rather than only in
 * its absence.
 *
 * ## Before the first run: your id columns
 *
 * Ids are opaque strings to this package, and the checks hold you to that. Most
 * of them feed your adapter ids it handed back itself, but seven pass a
 * deliberately malformed one (`'not-an-id'`) and require a miss — `null`,
 * `false`, no-op. Six of those seven are capability-gated, so a harness
 * declaring no optional repositories exercises exactly one of them, and a green
 * default run says correspondingly little.
 *
 * A column that parses its input instead of storing it — a native `uuid`, an
 * integer key — cannot miss on such a value. It fails while parsing the literal,
 * on reads as much as on writes, so the check reports that error rather than the
 * column type behind it. (Postgres raises SQLSTATE 22P02. Other engines word it
 * differently, which is why an adapter on another engine cannot reuse the
 * Postgres wording.)
 *
 * A native id type is allowed — the adapter guide says so explicitly — but it
 * moves work onto the adapter: catch that one error, on that one argument, and
 * return the miss, while every other database error keeps propagating. The
 * shipped Prisma adapter does exactly that in `idSafeClient`, though only on a
 * driver adapter; on the older Rust engine (v5/v6) there is no translation and
 * the adapter satisfies the rule itself. The full contract, including what it
 * deliberately does *not* cover (inserts), is the `Ids are opaque strings`
 * section at the top of `types.ts`.
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

/**
 * Optional repositories an adapter may implement; gates the matching checks.
 *
 * Every key is optional so a harness can grow into the list, which makes an
 * omission indistinguishable from a `false`. Declare all seven — the ones you
 * do not implement as `false` — and read the suite title, which names whatever
 * stayed undeclared.
 */
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
  /**
   * Optional repositories this adapter implements (others' checks skip).
   * List all seven, `false` for the ones you do not implement — see
   * {@link ConformanceCapabilities}.
   */
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
    /* losing the race is contract-conformant; the end state is asserted */
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
/**
 * Invitation create payload with the token/expiry fields filled in.
 *
 * `tokenHash` is `@unique`, so every call needs its own — derived from the same
 * monotonic seed as the emails, which is what keeps a check that mints several
 * invitations from colliding on an adapter that actually enforces the
 * constraint. Live by default; a check that wants an expired one overrides it.
 */
function inviteData(
  email: string,
  role: string,
  invitedById: string,
  overrides: { expiresAt?: Date } = {}
) {
  return {
    email,
    role,
    invitedById,
    tokenHash: `conformance-token-hash-${nextSeed()}`,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
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
 * the shipped in-memory adapter is; against a real relational schema
 * (`prisma/auth-schema.prisma` puts `onDelete: Cascade` on all eight dependent
 * models — the seven `userId` ones plus `Invitation`, whose FK is
 * `invitedById`) the insert fails with a foreign-key violation, and the check
 * reports an adapter bug that is not there.
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
  const inv = await repos.invitation.create(
    inviteData(`${label}-retired-${nextSeed()}@conformance.test`, role, inviter as string)
  );
  await repos.invitation.delete(inv.id);
  return inv.id;
}

const futureDate = () => new Date(Date.now() + 60 * 60_000);
const pastDate = () => new Date(Date.now() - 60 * 60_000);

/**
 * An id no id scheme can hold: not a UUID, not a number, not a cuid2/ULID.
 * A `text` column stores it happily and simply matches nothing — which is the
 * point, since that is the behaviour every other column type has to imitate.
 */
const UNREPRESENTABLE_ID = 'not-an-id';

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

  check('user.setEmailChangeToken overwrites an in-flight change', [], async (repos, h) => {
    // One pending change per user (types.ts). An adapter that inserts beside an
    // existing request instead of replacing it leaves the first link alive and
    // the second unusable — the shape a mistyped address takes: correcting it
    // sends a link that answers "invalid" until the first one expires.
    const user = await seedUser(repos, h.role, 'ec-overwrite');
    const typo = `typo-${nextSeed()}@conformance.test`;
    const corrected = `corrected-${nextSeed()}@conformance.test`;

    await repos.user.setEmailChangeToken(user.id, typo, 'ec-hash-typo', futureDate());
    await repos.user.setEmailChangeToken(user.id, corrected, 'ec-hash-corrected', futureDate());

    expect(
      await repos.user.consumeEmailChangeToken('ec-hash-typo'),
      'the superseded token is dead'
    ).toBeNull();
    const claimed = await repos.user.consumeEmailChangeToken('ec-hash-corrected');
    expect(claimed?.email, 'the latest request is the one in flight').toBe(corrected);
  }),

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
    // The dependent the contract makes every adapter delete BY HAND: the
    // `invitedBy` relation is the one a schema may leave uncascaded, so the
    // Prisma adapter pairs `invitation.deleteMany({ invitedById })` with the
    // user delete in a transaction (and the in-memory bundle mirrors it). The
    // remaining dependents are pinned by `user.delete erases the dependents of
    // every declared repository` below.
    const inviter = await seedUser(repos, h.role, 'inviter');
    const other = await seedUser(repos, h.role, 'other');
    const doomedEmail = `invitee-${nextSeed()}@conformance.test`;
    await repos.invitation.create(inviteData(doomedEmail, h.role, inviter.id));
    const kept = await repos.invitation.create(
      inviteData(`kept-${nextSeed()}@conformance.test`, h.role, other.id)
    );

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

  check(
    'user.delete erases the dependents of every declared repository',
    // Deliberately ungated: the check asserts exactly the repositories the
    // harness declared, so it says as much as the adapter offers instead of
    // splitting into seven checks that a partial adapter would only ever skip.
    [],
    async (repos, h) => {
      // `delete` is GDPR erasure (types.ts): every dependent row goes, whether
      // the adapter gets that from `onDelete: Cascade` or writes it by hand.
      // Each row below carries personal data — a device name, a user agent, an
      // ip, a push endpoint — so a surviving one is the erasure failing while
      // the user row is gone and nothing is left to point at it.
      const caps = h.capabilities;
      const [owner, keeper] = await seedUserIds(repos, h.role, 'erase', 'erase-keep');
      const ISSUER = 'https://idp.conformance.test';

      if (caps?.refreshToken) {
        const repo = need(repos.refreshToken, 'refreshToken');
        const tok = (userId: string, tokenHash: string) =>
          repo.create({
            userId,
            tokenHash,
            family: `fam-${tokenHash}`,
            expiresAt: futureDate(),
            userAgent: 'Mozilla/5.0 (conformance)',
            ip: '203.0.113.7'
          });
        await tok(owner, 'erase-rt');
        await tok(keeper, 'keep-rt');
      }
      if (caps?.passkey) {
        const repo = need(repos.passkey, 'passkey');
        const cred = (userId: string, credentialId: string) =>
          repo.create(userId, {
            credentialId,
            publicKey: new Uint8Array([1, 2, 3]),
            publicKeyAlg: -7,
            counter: 0,
            aaguid: 'aaguid',
            name: 'Home laptop'
          });
        await cred(owner, 'erase-pk');
        await cred(keeper, 'keep-pk');
      }
      if (caps?.notification) {
        const repo = need(repos.notification, 'notification');
        await repo.create({ userId: owner, typeKey: 'security', title: 'New login' });
        await repo.create({ userId: keeper, typeKey: 'security', title: 'New login' });
      }
      if (caps?.pushSubscription) {
        const repo = need(repos.pushSubscription, 'pushSubscription');
        await repo.create(owner, {
          endpoint: 'https://push.test/erase',
          keys: { p256dh: 'cDE', auth: 'YTE' }
        });
        await repo.create(keeper, {
          endpoint: 'https://push.test/keep',
          keys: { p256dh: 'cDI', auth: 'YTI' }
        });
      }
      if (caps?.notificationPreference) {
        const repo = need(repos.notificationPreference, 'notificationPreference');
        await repo.upsert(owner, 'security', { push: false });
        await repo.upsert(keeper, 'security', { push: false });
      }
      if (caps?.backupCode) {
        const repo = need(repos.backupCode, 'backupCode');
        await repo.createMany(owner, ['erase-code']);
        await repo.createMany(keeper, ['keep-code']);
      }
      if (caps?.federatedAccount) {
        const repo = need(repos.federatedAccount, 'federatedAccount');
        await repo.linkFederatedAccount(owner, { issuer: ISSUER, subject: 'erase-sub' });
        await repo.linkFederatedAccount(keeper, { issuer: ISSUER, subject: 'keep-sub' });
      }

      await repos.user.delete(owner);

      if (caps?.refreshToken) {
        const repo = need(repos.refreshToken, 'refreshToken');
        // Removed, not revoked: a revoked row still holds the ip and the user
        // agent it was issued with, which is the part erasure is about.
        expect(await repo.findByHash('erase-rt'), 'refresh token removed').toBeNull();
        expect(await repo.findByHash('keep-rt'), 'another user’s token survives').not.toBeNull();
      }
      if (caps?.passkey) {
        const repo = need(repos.passkey, 'passkey');
        expect(await repo.findByCredentialId('erase-pk'), 'passkey removed').toBeNull();
        expect(
          await repo.findByCredentialId('keep-pk'),
          'another user’s passkey survives'
        ).not.toBeNull();
      }
      if (caps?.notification) {
        const repo = need(repos.notification, 'notification');
        expect(await repo.findByUser(owner), 'notifications removed').toEqual([]);
        expect(await repo.findByUser(keeper), 'another user’s notification survives').toHaveLength(
          1
        );
      }
      if (caps?.pushSubscription) {
        const repo = need(repos.pushSubscription, 'pushSubscription');
        expect(await repo.findByUser(owner), 'push subscriptions removed').toEqual([]);
        expect(await repo.findByUser(keeper), 'another user’s subscription survives').toHaveLength(
          1
        );
      }
      if (caps?.notificationPreference) {
        const repo = need(repos.notificationPreference, 'notificationPreference');
        expect(await repo.findByUser(owner), 'notification preferences removed').toEqual([]);
        expect(await repo.findByUser(keeper), 'another user’s preference survives').toHaveLength(1);
      }
      if (caps?.backupCode) {
        const repo = need(repos.backupCode, 'backupCode');
        expect(await repo.consumeIfUnused(owner, 'erase-code'), 'backup codes removed').toBe(false);
        expect(
          await repo.consumeIfUnused(keeper, 'keep-code'),
          'another user’s code survives'
        ).toBe(true);
      }
      if (caps?.federatedAccount) {
        const repo = need(repos.federatedAccount, 'federatedAccount');
        expect(
          await repo.findByFederatedId(ISSUER, 'erase-sub'),
          'federated link removed'
        ).toBeNull();
        expect(
          await repo.findByFederatedId(ISSUER, 'keep-sub'),
          'another user’s link survives'
        ).not.toBeNull();
      }
      expect(await repos.user.findById(keeper), 'the bystander is untouched').not.toBeNull();
    }
  ),

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

  check('user.create stores the verification token it was handed', [], async (repos, h) => {
    // Registration mints the token inside the insert, so `create` is the second
    // writer of these two columns next to `setVerificationToken`. Nothing reads
    // them back off the created row (`create` returns the public `AuthUser`),
    // so an adapter that writes only the columns the rest of the suite
    // exercises leaves every account unverifiable and every check green.
    const live = nextSeed();
    const created = await repos.user.create({
      email: `create-vt-${live}@conformance.test`,
      name: 'Conformance User',
      passwordHash: 'x',
      role: h.role,
      verificationToken: `create-vt-${live}`,
      verificationTokenExpires: futureDate()
    });
    const claimed = await repos.user.consumeVerificationToken(`create-vt-${live}`);
    expect(claimed?.id, 'the token minted at create is claimable').toBe(created.id);
    expect(claimed?.emailVerified, 'and the claim verifies the account').toBe(true);

    // The expiry is the other half: stored as null it never expires, so a
    // registration link stays valid forever.
    const stale = nextSeed();
    await repos.user.create({
      email: `create-vt-${stale}@conformance.test`,
      name: 'Conformance User',
      passwordHash: 'x',
      role: h.role,
      verificationToken: `create-vt-${stale}`,
      verificationTokenExpires: pastDate()
    });
    expect(
      await repos.user.consumeVerificationToken(`create-vt-${stale}`),
      'an already-expired token from create is refused'
    ).toBeNull();
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
    const inv = await repos.invitation.create(
      inviteData(`inv-${nextSeed()}@conformance.test`, h.role, inviter)
    );

    const results = await parallel(5, () => repos.invitation.markUsedIfUnused(inv.id));
    expect(results.filter(Boolean), 'one invitation, one winner').toHaveLength(1);

    expect(await repos.invitation.markUsedIfUnused(inv.id), 'already used → false').toBe(false);

    const gone = await retiredInvitationId(repos, h.role, 'inv-gone');
    expect(await repos.invitation.markUsedIfUnused(gone), 'unknown → false').toBe(false);
  }),

  // -- Invitation: token lookup (#149) --------------------------------------
  check('invitation.findByTokenHash is the registration gate', [], async (repos, h) => {
    const [inviter] = await seedUserIds(repos, h.role, 'inv-token');
    const data = inviteData(`inv-token-${nextSeed()}@conformance.test`, h.role, inviter);
    const created = await repos.invitation.create(data);

    const found = await repos.invitation.findByTokenHash(data.tokenHash);
    expect(found?.id, 'the token finds its own invitation').toBe(created.id);

    expect(
      await repos.invitation.findByTokenHash(`absent-${nextSeed()}`),
      'an unknown token hash resolves null rather than throwing — it runs on every registration attempt'
    ).toBeNull();

    // A used invitation still comes BACK from the lookup: the handler tells
    // "used" apart from "unknown" in its response, and an adapter that filtered
    // used rows out would collapse the two into one.
    await repos.invitation.markUsedIfUnused(created.id);
    const afterUse = await repos.invitation.findByTokenHash(data.tokenHash);
    expect(afterUse, 'a used invitation is still findable').not.toBeNull();
    expect(afterUse?.usedAt, 'and reports when it was used').toBeInstanceOf(Date);
  }),

  check('invitation.findByTokenHash survives a deleted invitation', [], async (repos, h) => {
    // A revoked invitation must stop being redeemable. An adapter keeping a
    // token index alive past the row would leave a revoked invite working.
    const [inviter] = await seedUserIds(repos, h.role, 'inv-token-del');
    const data = inviteData(`inv-token-del-${nextSeed()}@conformance.test`, h.role, inviter);
    const created = await repos.invitation.create(data);
    await repos.invitation.delete(created.id);

    expect(
      await repos.invitation.findByTokenHash(data.tokenHash),
      'a deleted invitation is not redeemable'
    ).toBeNull();
  }),

  check('invitation round-trips expiresAt and emailedAt', [], async (repos, h) => {
    // Both drive security decisions in the register handler — expiry gates
    // redemption, emailedAt gates `autoVerifyInvited` — so an adapter that
    // drops or coarsens them changes behaviour silently.
    const [inviter] = await seedUserIds(repos, h.role, 'inv-dates');
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const created = await repos.invitation.create(
      inviteData(`inv-dates-${nextSeed()}@conformance.test`, h.role, inviter, { expiresAt })
    );

    expect(created.expiresAt.getTime(), 'expiresAt survives the write').toBe(expiresAt.getTime());
    expect(created.emailedAt, 'a fresh invitation is undelivered').toBeNull();

    const at = new Date();
    await repos.invitation.markEmailed(created.id, at);
    const after = await repos.invitation.findByEmail(created.email);
    expect(after?.emailedAt?.getTime(), 'markEmailed is persisted').toBe(at.getTime());

    // Missing-target convention: a no-op, never a throw.
    await repos.invitation.markEmailed(`absent-${nextSeed()}`, new Date());
  }),

  // -- Invitation: contract-field projection --------------------------------
  check('invitation results carry exactly the contract fields', [], async (repos, h) => {
    // Invitation results are serialized straight into the admin HTTP response
    // by createInvitationHandlers, so an adapter that passes raw rows through
    // leaks invitedById (and any consumer extra column) to the client. The
    // fake-Prisma harness stores invitedById on the row, giving this teeth.
    // `tokenHash` is deliberately absent: it is the stored half of the
    // credential, and an adapter that passes it through would put it in an
    // admin HTTP response.
    const CONTRACT_FIELDS = [
      'createdAt',
      'email',
      'emailedAt',
      'expiresAt',
      'id',
      'role',
      'usedAt'
    ];
    const email = `inv-shape-${nextSeed()}@conformance.test`;
    const [inviter] = await seedUserIds(repos, h.role, 'inv-shape');
    const created = await repos.invitation.create(inviteData(email, h.role, inviter));
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

  check(
    'refreshToken.revoke records the successor it was given',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner] = await seedUserIds(repos, h.role, 'rt-succ');
      const tok = (tokenHash: string) =>
        repo.create({ userId: owner, tokenHash, family: 'fam-succ', expiresAt: futureDate() });
      const predecessor = await tok('rt-succ-old');
      const successor = await tok('rt-succ-new');

      // `replacedById` is what separates a rotation race from token theft: the
      // grace window in `rotateRefreshToken` only holds for a revoked token
      // that names its successor. Dropped, the everyday case — two requests
      // firing the moment the access cookie expires — reads as reuse and takes
      // the whole family down with it.
      expect(await repo.revoke(predecessor.id, successor.id), 'the live token is revoked').toBe(
        true
      );
      const rotated = await repo.findByHash('rt-succ-old');
      expect(rotated?.revokedAt, 'and stamped').toBeInstanceOf(Date);
      expect(rotated?.replacedById, 'the successor is persisted').toBe(successor.id);

      const solo = await tok('rt-succ-solo');
      expect(await repo.revoke(solo.id), 'a revoke without a successor still wins').toBe(true);
      expect((await repo.findByHash('rt-succ-solo'))?.replacedById, 'and records none').toBeNull();
    }
  ),

  check(
    'refreshToken.create round-trips the session metadata',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner] = await seedUserIds(repos, h.role, 'rt-meta');
      const agent = 'Mozilla/5.0 (conformance)';

      // The session list is the only place a user can tell their own devices
      // apart and revoke the one they do not recognise. Dropped here, every
      // row reads the same, and rotation replaces the row that still had them.
      const created = await repo.create({
        userId: owner,
        tokenHash: 'rt-meta',
        family: 'fam-meta',
        expiresAt: futureDate(),
        userAgent: agent,
        ip: '203.0.113.7'
      });
      expect(created.userAgent, 'create echoes the user agent').toBe(agent);
      expect(created.ip, 'create echoes the ip').toBe('203.0.113.7');

      const stored = await repo.findByHash('rt-meta');
      expect(stored?.userAgent, 'the user agent was written').toBe(agent);
      expect(stored?.ip, 'the ip was written').toBe('203.0.113.7');
      const [listed] = await repo.listActiveByUser(owner);
      expect(listed?.userAgent, 'the session list reads it back').toBe(agent);
      expect(listed?.ip, 'the session list reads it back').toBe('203.0.113.7');

      // Both columns are optional; omitted, they read back as null (the
      // `sessions.storeIp` opt-out is exactly this case).
      const bare = await repo.create({
        userId: owner,
        tokenHash: 'rt-meta-bare',
        family: 'fam-meta-bare',
        expiresAt: futureDate()
      });
      expect(bare.userAgent, 'omitted user agent → null').toBeNull();
      expect(bare.ip, 'omitted ip → null').toBeNull();
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

  // -- Passkey: stored credential + owner-scoped listing -------------------
  check(
    'passkey.create round-trips the credential’s key material',
    ['passkey'],
    async (repos, h) => {
      const repo = need(repos.passkey, 'passkey');
      const [owner] = await seedUserIds(repos, h.role, 'pk-material');
      // A pattern no lossy conversion survives: a NUL, the 0x7f/0x80 boundary,
      // and a byte above it. Assertion verification reads these bytes back
      // verbatim, so registration succeeding says nothing about login working.
      const publicKey = new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0x10]);
      const data = {
        credentialId: 'cred-material',
        publicKey,
        publicKeyAlg: -257,
        counter: 3,
        transports: ['internal', 'hybrid'],
        aaguid: '00000000-0000-0000-0000-000000000001',
        name: 'Home laptop'
      };
      const created = await repo.create(owner, data);

      const assertMaterial = (stored: Passkey | null | undefined, where: string) => {
        expect(Array.from(stored?.publicKey ?? []), `${where}: public key bytes`).toEqual(
          Array.from(publicKey)
        );
        expect(stored?.publicKeyAlg, `${where}: COSE algorithm`).toBe(-257);
        expect(stored?.counter, `${where}: counter`).toBe(3);
        expect(stored?.aaguid, `${where}: aaguid`).toBe(data.aaguid);
        expect(stored?.name, `${where}: name`).toBe('Home laptop');
        expect(stored?.userId, `${where}: owner`).toBe(owner);
        // Sorted: the contract fixes the members, not their order.
        expect([...(stored?.transports ?? [])].sort(), `${where}: transports`).toEqual([
          'hybrid',
          'internal'
        ]);
      };

      assertMaterial(created, 'create');
      assertMaterial(await repo.findByCredentialId('cred-material'), 'findByCredentialId');
      assertMaterial((await repo.findByUserId(owner))[0], 'findByUserId');
    }
  ),

  check(
    'passkey.findByUserId lists only the owner’s credentials',
    ['passkey'],
    async (repos, h) => {
      const repo = need(repos.passkey, 'passkey');
      const [owner, other] = await seedUserIds(repos, h.role, 'pk-list', 'pk-list-other');
      const cred = (userId: string, credentialId: string) =>
        repo.create(userId, {
          credentialId,
          publicKey: new Uint8Array([1, 2]),
          publicKeyAlg: -7,
          counter: 0,
          aaguid: 'aaguid',
          name: 'Home laptop'
        });
      await cred(owner, 'cred-own-a');
      await cred(owner, 'cred-own-b');
      await cred(other, 'cred-foreign');

      // This listing is both the passkey manager's rows (credential id, device
      // name, aaguid) and the `allowCredentials` of a login challenge, so an
      // unfiltered query hands every signed-in user everyone else's devices.
      // Order is not part of the contract and is therefore not asserted.
      expect(
        (await repo.findByUserId(owner)).map((p) => p.credentialId).sort(),
        'exactly the owner’s credentials'
      ).toEqual(['cred-own-a', 'cred-own-b']);
      expect(
        (await repo.findByUserId(other)).map((p) => p.credentialId),
        'and no one else’s'
      ).toEqual(['cred-foreign']);

      const ghost = await retiredUserId(repos, h.role, 'pk-list-ghost');
      expect(await repo.findByUserId(ghost), 'a user with no credentials → []').toEqual([]);
    }
  ),

  check('passkey.updateCounter records the last use', ['passkey'], async (repos, h) => {
    const repo = need(repos.passkey, 'passkey');
    const [owner] = await seedUserIds(repos, h.role, 'pk-lastused');
    const cred = (credentialId: string, counter: number) =>
      repo.create(owner, {
        credentialId,
        publicKey: new Uint8Array([1]),
        publicKeyAlg: -7,
        counter,
        aaguid: 'aaguid'
      });
    await cred('cred-counting', 4);
    await cred('cred-counterless', 0);

    // Both branches of updateCounter touch `lastUsedAt` (types.ts). It is what
    // the passkey manager shows next to each device, and the only thing that
    // tells three enrolled keys apart when one has to go.
    expect(await repo.updateCounter('cred-counting', 5), 'the CAS advances').toBe(true);
    expect(
      (await repo.findByCredentialId('cred-counting'))?.lastUsedAt,
      'a counter bump stamps lastUsedAt'
    ).toBeInstanceOf(Date);

    expect(await repo.updateCounter('cred-counterless', 0), 'the counterless touch wins').toBe(
      true
    );
    expect(
      (await repo.findByCredentialId('cred-counterless'))?.lastUsedAt,
      'a counterless authenticator is stamped too'
    ).toBeInstanceOf(Date);
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
      // miss, and a miss is a silent no-op: the route is idempotent and answers
      // 200 either way, so a throw here is the one outcome that becomes a 500
      // (see the id contract in types.ts).
      await repo.markAsRead(attacker, n.id);
      expect((await repo.findByUser(owner))[0]?.readAt ?? null, 'non-owner cannot read').toBeNull();

      await repo.delete(attacker, n.id);
      expect(await repo.findByUser(owner), 'non-owner cannot delete').toHaveLength(1);

      await repo.markAsRead(owner, n.id);
      expect((await repo.findByUser(owner))[0]?.readAt, 'owner can read').toBeInstanceOf(Date);
    }
  ),

  check(
    'notification.markAsRead keeps the first read timestamp',
    ['notification'],
    async (repos, h) => {
      const repo = need(repos.notification, 'notification');
      const [owner] = await seedUserIds(repos, h.role, 'nt-first-stamp');
      const n = await repo.create({ userId: owner, typeKey: 'security', title: 'New login' });

      await repo.markAsRead(owner, n.id);
      const first = (await repo.findByUser(owner))[0]?.readAt;
      expect(first, 'the first call stamps').toBeInstanceOf(Date);

      // The route is idempotent, so the repeat is the normal case — a second
      // open tab, a retry. `readAt` is serialized to the client as the moment
      // the user read the notification; re-stamping rewrites that to "just
      // now". A guard-less UPDATE only shows it where two writes land in
      // different milliseconds, hence the wait.
      await new Promise((resolve) => setTimeout(resolve, 10));
      await repo.markAsRead(owner, n.id);
      expect(
        (await repo.findByUser(owner))[0]?.readAt?.getTime(),
        'a repeat call leaves the stamp alone'
      ).toBe(first?.getTime());
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
    // ~10 methods before the conformance pin.
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
  //
  // Every id below arrives from outside — a URL segment, a request body — so
  // none of them is guaranteed to fit the column. Against `text` any string
  // fits and these checks are trivially true; against a native `uuid` or
  // integer key the database rejects the *syntax* on reads as much as on
  // writes, and the adapter has to translate that into the miss. Without it any
  // caller can 500 these endpoints at will by sending a malformed id.
  //
  // One check per repository rather than one big one, so a harness that does
  // not declare a capability gets the documented skip instead of a failure.
  check('an unrepresentable id reads as a miss (user, invitation)', [], async (repos, h) => {
    const [owner, inviter] = await seedUserIds(repos, h.role, 'unrep', 'unrep-inviter');

    expect(await repos.user.findById(UNREPRESENTABLE_ID), 'user.findById → null').toBeNull();
    await repos.user.delete(UNREPRESENTABLE_ID);
    expect(await repos.user.findById(owner), 'no other user was deleted').not.toBeNull();

    // Both invitation ids come straight off a URL segment in the admin routes.
    expect(
      await repos.invitation.markUsedIfUnused(UNREPRESENTABLE_ID),
      'invitation.markUsedIfUnused → false'
    ).toBe(false);

    const kept = await repos.invitation.create(
      inviteData(`unrep-keep-${nextSeed()}@conformance.test`, h.role, inviter as string)
    );
    await repos.invitation.delete(UNREPRESENTABLE_ID);
    expect(
      (await repos.invitation.list()).some((i) => i.id === kept.id),
      'invitation.delete removed nothing'
    ).toBe(true);
  }),

  check(
    'an unrepresentable id reads as a miss (refreshToken)',
    ['refreshToken'],
    async (repos, h) => {
      const repo = need(repos.refreshToken, 'refreshToken');
      const [owner] = await seedUserIds(repos, h.role, 'unrep-rt');
      await repo.create({
        userId: owner,
        tokenHash: 'unrep-keep',
        family: 'fam',
        expiresAt: futureDate()
      });

      // The family is the argument the revoke route takes from the request
      // body, so it is the one an attacker picks. A store that types it as an
      // id column has to answer the same way as one that does not.
      expect(
        await repo.revokeFamilyForUser(owner, UNREPRESENTABLE_ID),
        'unknown family → false'
      ).toBe(false);
      expect(
        await repo.revokeFamilyForUser(UNREPRESENTABLE_ID, 'fam'),
        'unknown user → false'
      ).toBe(false);
      expect((await repo.findByHash('unrep-keep'))?.revokedAt ?? null, 'still live').toBeNull();

      expect(await repo.listActiveByUser(UNREPRESENTABLE_ID), 'listActiveByUser → []').toEqual([]);
    }
  ),

  check(
    'an unrepresentable id reads as a miss (notification)',
    ['notification'],
    async (repos, h) => {
      const repo = need(repos.notification, 'notification');
      const [owner] = await seedUserIds(repos, h.role, 'unrep-nt');
      await repo.create({ userId: owner, typeKey: 'security', title: 'untouched' });

      // Unrepresentable in the owner position …
      await repo.markAsRead(UNREPRESENTABLE_ID, UNREPRESENTABLE_ID);
      await repo.delete(UNREPRESENTABLE_ID, UNREPRESENTABLE_ID);
      // … and in the row position, with a real owner.
      await repo.markAsRead(owner, UNREPRESENTABLE_ID);
      await repo.delete(owner, UNREPRESENTABLE_ID);

      expect(await repo.getUnreadCount(owner), 'the owner row is untouched').toBe(1);
      expect(await repo.findByUser(UNREPRESENTABLE_ID), 'findByUser → []').toEqual([]);
    }
  ),

  check('an unrepresentable id reads as a miss (backupCode)', ['backupCode'], async (repos, h) => {
    const repo = need(repos.backupCode, 'backupCode');
    const [owner] = await seedUserIds(repos, h.role, 'unrep-bc');
    await repo.createMany(owner, ['keep-me']);

    expect(
      await repo.consumeIfUnused(UNREPRESENTABLE_ID, 'keep-me'),
      'consumeIfUnused → false'
    ).toBe(false);
    await repo.deleteAll(UNREPRESENTABLE_ID);
    expect(await repo.consumeIfUnused(owner, 'keep-me'), "the owner's code survived").toBe(true);
  }),

  check('an unrepresentable id reads as a miss (passkey)', ['passkey'], async (repos, h) => {
    const repo = need(repos.passkey, 'passkey');
    const [owner] = await seedUserIds(repos, h.role, 'unrep-pk');
    await repo.create(owner, {
      credentialId: 'cred-keep',
      publicKey: new Uint8Array([1]),
      publicKeyAlg: -7,
      counter: 0,
      aaguid: 'aaguid'
    });

    await repo.delete(UNREPRESENTABLE_ID, 'cred-keep');
    await repo.rename(UNREPRESENTABLE_ID, 'cred-keep', 'Hijacked');

    const stored = await repo.findByCredentialId('cred-keep');
    expect(stored, 'the credential survived').not.toBeNull();
    expect(stored?.name, 'and was not renamed').not.toBe('Hijacked');
  }),

  check(
    'an unrepresentable id reads as a miss (pushSubscription)',
    ['pushSubscription'],
    async (repos, h) => {
      const repo = need(repos.pushSubscription, 'pushSubscription');
      const [owner] = await seedUserIds(repos, h.role, 'unrep-ps');
      const endpoint = 'https://push.test/unrep-keep';
      await repo.create(owner, { endpoint, keys: { p256dh: 'p', auth: 'a' } });

      await repo.delete(UNREPRESENTABLE_ID, endpoint);
      expect(await repo.findByUser(owner), "the owner's subscription survived").toHaveLength(1);
      expect(await repo.findByUser(UNREPRESENTABLE_ID), 'findByUser → []').toEqual([]);
    }
  ),

  check(
    'an unrepresentable id reads as a miss (notificationPreference)',
    ['notificationPreference'],
    async (repos) => {
      const repo = need(repos.notificationPreference, 'notificationPreference');
      expect(await repo.findByUser(UNREPRESENTABLE_ID), 'findByUser → []').toEqual([]);
    }
  ),

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

/** What a run against a given harness will and will not execute. */
export interface ConformanceRunSummary {
  /** Every check the suite defines. */
  readonly total: number;
  /** Checks that will execute against this harness. */
  readonly running: number;
  /** Checks skipped because their repository was not declared. */
  readonly skippedUndeclared: number;
  /** Checks skipped by `options.only` / `options.skip`. */
  readonly skippedByOption: number;
  /**
   * The optional repositories some check needs and this harness did not
   * declare, alphabetically. Set by the capability list alone, so it survives
   * a release that adds checks — unlike the counts beside it.
   */
  readonly undeclared: readonly (keyof ConformanceCapabilities)[];
}

type PlannedCheck = {
  readonly check: ConformanceCheck;
  readonly skipped: 'undeclared' | 'option' | null;
};

/**
 * Decide, once, what happens to every check — so the reported summary and the
 * registered tests cannot disagree.
 */
function planConformanceRun(
  harness: ConformanceHarness,
  options?: ConformanceOptions
): { plan: PlannedCheck[]; summary: ConformanceRunSummary } {
  const undeclared = new Set<keyof ConformanceCapabilities>();
  const plan = conformanceChecks.map((entry): PlannedCheck => {
    const missing = entry.requires.filter((r) => !harness.capabilities?.[r]);
    for (const repo of missing) undeclared.add(repo);
    if (missing.length > 0) return { check: entry, skipped: 'undeclared' };
    const excluded =
      options?.skip?.includes(entry.name) === true ||
      (options?.only != null && !options.only.includes(entry.name));
    return { check: entry, skipped: excluded ? 'option' : null };
  });

  return {
    plan,
    summary: {
      total: plan.length,
      running: plan.filter((p) => p.skipped === null).length,
      skippedUndeclared: plan.filter((p) => p.skipped === 'undeclared').length,
      skippedByOption: plan.filter((p) => p.skipped === 'option').length,
      undeclared: [...undeclared].sort()
    }
  };
}

/**
 * What {@link describeRepositoryConformance} would run for this harness,
 * without registering anything — the same numbers it puts in the suite title.
 * Useful in a gate of your own ("no repository may go undeclared").
 */
export function summarizeConformanceRun(
  harness: ConformanceHarness,
  options?: ConformanceOptions
): ConformanceRunSummary {
  return planConformanceRun(harness, options).summary;
}

/**
 * Register the full conformance suite for `harness` under a `describe` block.
 * Capability-gated checks the harness does not declare are reported as skipped.
 *
 * The suite title carries the summary — how many of the checks run, and which
 * repositories were left undeclared. An incomplete capability list is the one
 * way to pass this suite without it having said anything, and it produces no
 * failure to notice; the title is what makes it legible in the run output.
 */
export function describeRepositoryConformance(
  name: string,
  harness: ConformanceHarness,
  options?: ConformanceOptions
): void {
  if (options?.runner) setConformanceRunner(options.runner);
  const { plan, summary } = planConformanceRun(harness, options);
  describe(conformanceSuiteTitle(name, summary), () => {
    for (const { check: c, skipped } of plan) {
      if (skipped) {
        it.skip(c.name, () => {});
      } else {
        it(c.name, () => c.run(harness));
      }
    }
  });
}

/** The suite title: the adapter's name plus what this run actually covers. */
function conformanceSuiteTitle(name: string, summary: ConformanceRunSummary): string {
  const parts = [`${summary.running}/${summary.total} checks`];
  if (summary.skippedUndeclared > 0) {
    parts.push(
      `${summary.skippedUndeclared} skipped — undeclared: ${summary.undeclared.join(', ')}`
    );
  }
  if (summary.skippedByOption > 0) parts.push(`${summary.skippedByOption} skipped by only/skip`);
  return `adapter conformance: ${name} · ${parts.join(' · ')}`;
}
