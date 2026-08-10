import { describe, expect, it } from 'vitest';
import {
  createInMemoryInvitationRepository,
  createInMemoryNotificationPreferenceRepository,
  createInMemoryNotificationRepository,
  createInMemoryPasskeyRepository,
  createInMemoryPushSubscriptionRepository,
  createInMemoryRefreshTokenRepository,
  createInMemoryRepos,
  createInMemoryUserRepository
} from './in-memory.js';

/**
 * Happy-path / wiring smoke tests for the in-memory adapter. The systematic
 * atomicity, scope and constraint guarantees are exercised by the exported
 * conformance suite (`conformance.test.ts`); this file only proves the basic
 * CRUD semantics, default application and read-isolation (copies) work.
 */

describe('createInMemoryRepos', () => {
  it('provides every repository in the contract', () => {
    const repos = createInMemoryRepos();
    expect(repos.user).toBeDefined();
    expect(repos.invitation).toBeDefined();
    expect(repos.notification).toBeDefined();
    expect(repos.pushSubscription).toBeDefined();
    expect(repos.notificationPreference).toBeDefined();
    expect(repos.passkey).toBeDefined();
    expect(repos.refreshToken).toBeDefined();
    expect(repos.federatedAccount).toBeDefined();
  });

  // The invitation half of the cascade is pinned adapter-agnostically by the
  // conformance suite; the sibling stores ride on `onDelete: Cascade` for the
  // Prisma adapter and can only be observed here, against the bundle that
  // hand-models them (test-coverage review, package 6).
  it('bundle user.delete cascades across every sibling store', async () => {
    const repos = createInMemoryRepos();
    const u = await repos.user.create({
      email: 'ghost@cascade.test',
      name: 'Ghost',
      passwordHash: 'x',
      role: 'USER'
    });
    await repos.passkey!.create(u.id, {
      credentialId: 'cred-cascade',
      publicKey: new Uint8Array([1]),
      publicKeyAlg: -7,
      counter: 0,
      aaguid: 'a'
    });
    await repos.notification!.create({ userId: u.id, typeKey: 'security', title: 't' });
    await repos.pushSubscription!.create(u.id, {
      endpoint: 'https://push.test/cascade',
      keys: { p256dh: 'p', auth: 'a' }
    });
    await repos.notificationPreference!.upsert(u.id, 'security', { push: false });
    await repos.backupCode!.createMany(u.id, ['bc-hash']);
    await repos.refreshToken!.create({
      userId: u.id,
      tokenHash: 'rt-cascade',
      family: 'fam',
      expiresAt: new Date(Date.now() + 60_000)
    });
    await repos.federatedAccount!.linkFederatedAccount(u.id, {
      issuer: 'https://idp.test',
      subject: 'idp-cascade'
    });

    await repos.user.delete(u.id);

    expect(await repos.user.findById(u.id), 'user row gone').toBeNull();
    expect(await repos.passkey!.findByCredentialId('cred-cascade'), 'passkeys gone').toBeNull();
    expect(await repos.notification!.findByUser(u.id), 'notifications gone').toHaveLength(0);
    expect(await repos.pushSubscription!.findByUser(u.id), 'subscriptions gone').toHaveLength(0);
    expect(await repos.notificationPreference!.findByUser(u.id), 'preferences gone').toHaveLength(
      0
    );
    expect(await repos.backupCode!.consumeIfUnused(u.id, 'bc-hash'), 'backup codes gone').toBe(
      false
    );
    // The contract has no refresh-token hard delete; revoked is the
    // observable equivalent (nothing lists or rotates a revoked token).
    expect(
      (await repos.refreshToken!.findByHash('rt-cascade'))?.revokedAt,
      'refresh tokens revoked'
    ).toBeInstanceOf(Date);
    expect(
      await repos.federatedAccount!.findByFederatedId('https://idp.test', 'idp-cascade'),
      'federated links gone'
    ).toBeNull();
  });
});

describe('in-memory refresh-token repository', () => {
  it('returns detached copies, not live store references', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const created = await repo.create({
      userId: 'u',
      tokenHash: 'h',
      family: 'f',
      expiresAt: new Date(Date.now() + 60_000)
    });
    // Mutate the returned record and its nested Date — the store must not see it.
    created.revokedAt = new Date();
    created.expiresAt.setFullYear(1990);

    const fresh = await repo.findByHash('h');
    expect(fresh?.revokedAt ?? null, 'store not corrupted by caller mutation').toBeNull();
    expect(fresh?.expiresAt.getFullYear()).toBeGreaterThan(2000);

    // And a read is detached from later reads, too.
    fresh!.revokedAt = new Date();
    expect((await repo.findByHash('h'))?.revokedAt ?? null).toBeNull();
  });
});

describe('in-memory user repository', () => {
  it('round-trips a created user by id and email with schema defaults', async () => {
    const repo = createInMemoryUserRepository();
    const created = await repo.create({
      email: 'a@test.com',
      name: 'A',
      passwordHash: 'h',
      role: 'admin'
    });
    expect(created.id).toBeTruthy();
    expect(created.emailVerified).toBe(false);

    const byId = await repo.findById(created.id);
    expect(byId?.email).toBe('a@test.com');
    expect(byId?.tokenVersion).toBe(0);
    expect(byId?.failedLoginAttempts).toBe(0);
    expect(byId?.passwordHash).toBe('h');

    const byEmail = await repo.findByEmail('a@test.com');
    expect(byEmail?.id).toBe(created.id);
  });

  it('throws on a duplicate email (unique constraint)', async () => {
    const repo = createInMemoryUserRepository();
    await repo.create({ email: 'dup@test.com', name: 'A', passwordHash: 'h', role: 'admin' });
    await expect(
      repo.create({ email: 'dup@test.com', name: 'B', passwordHash: 'h2', role: 'admin' })
    ).rejects.toThrow();
  });

  it('returns copies, not live store references', async () => {
    const repo = createInMemoryUserRepository();
    const { id } = await repo.create({
      email: 'c@test.com',
      name: 'C',
      passwordHash: 'h',
      role: 'admin'
    });
    const a = await repo.findById(id);
    a!.name = 'mutated';
    const b = await repo.findById(id);
    expect(b?.name).toBe('C');
  });

  it('consumes a reset token once and clears it', async () => {
    const repo = createInMemoryUserRepository();
    const { id } = await repo.create({
      email: 'r@test.com',
      name: 'R',
      passwordHash: 'h',
      role: 'admin'
    });
    await repo.setPasswordResetToken(id, 'reset-hash', new Date(Date.now() + 60_000));
    const claimed = await repo.consumeResetToken('reset-hash');
    expect(claimed?.id).toBe(id);
    expect(claimed?.passwordResetToken).toBeNull();
    expect(await repo.consumeResetToken('reset-hash')).toBeNull();
  });

  it('purges an expired verification token and leaves the user unverified', async () => {
    const repo = createInMemoryUserRepository();
    const { id } = await repo.create({
      email: 'v@test.com',
      name: 'V',
      passwordHash: 'h',
      role: 'admin'
    });
    await repo.setVerificationToken(id, 'verify-hash', new Date(Date.now() - 1000));
    expect(await repo.consumeVerificationToken('verify-hash')).toBeNull();
    const user = await repo.findById(id);
    expect(user?.emailVerified).toBe(false);
    expect(user?.verificationToken).toBeNull();
  });

  it('records failed logins and locks at the threshold, then resets', async () => {
    const repo = createInMemoryUserRepository();
    const { id } = await repo.create({
      email: 'l@test.com',
      name: 'L',
      passwordHash: 'h',
      role: 'admin'
    });
    await repo.recordFailedLogin(id, { maxAttempts: 2, durationMinutes: 5 });
    let state = await repo.getFailedLoginAttempts(id);
    expect(state.count).toBe(1);
    expect(state.lockedUntil).toBeNull();

    await repo.recordFailedLogin(id, { maxAttempts: 2, durationMinutes: 5 });
    state = await repo.getFailedLoginAttempts(id);
    expect(state.count).toBe(2);
    expect(state.lockedUntil).toBeInstanceOf(Date);

    await repo.resetFailedLogins(id);
    state = await repo.getFailedLoginAttempts(id);
    expect(state.count).toBe(0);
    expect(state.lockedUntil).toBeNull();
  });
});

describe('in-memory invitation repository', () => {
  it('creates, lists, claims and deletes', async () => {
    const repo = createInMemoryInvitationRepository();
    const inv = await repo.create({
      email: 'i@test.com',
      role: 'admin',
      invitedById: 'u1',
      tokenHash: 'hash-1',
      expiresAt: new Date(Date.now() + 60_000)
    });
    expect(await repo.findByEmail('i@test.com')).not.toBeNull();
    expect(await repo.findByTokenHash('hash-1')).not.toBeNull();
    expect(await repo.list()).toHaveLength(1);

    expect(await repo.markUsedIfUnused(inv.id)).toBe(true);
    expect(await repo.markUsedIfUnused(inv.id)).toBe(false); // already used
    expect(await repo.markUsedIfUnused('unknown')).toBe(false);

    await repo.delete(inv.id);
    expect(await repo.findByEmail('i@test.com')).toBeNull();
  });
});

describe('in-memory notification repository', () => {
  it('creates, filters unread, marks read and counts', async () => {
    const repo = createInMemoryNotificationRepository();
    const n1 = await repo.create({ userId: 'u1', typeKey: 'login', title: 'Hi' });
    await repo.create({ userId: 'u1', typeKey: 'login', title: 'Hi2' });
    await repo.create({ userId: 'u2', typeKey: 'login', title: 'Other' });

    expect(await repo.getUnreadCount('u1')).toBe(2);
    expect(await repo.findByUser('u1', { unreadOnly: true })).toHaveLength(2);
    expect(await repo.findByUser('u1', { limit: 1 })).toHaveLength(1);

    await repo.markAsRead('u1', n1.id);
    expect(await repo.getUnreadCount('u1')).toBe(1);

    await repo.markAllAsRead('u1');
    expect(await repo.getUnreadCount('u1')).toBe(0);
    expect(await repo.getUnreadCount('u2')).toBe(1); // untouched
  });
});

describe('in-memory push-subscription repository', () => {
  it('stores by endpoint and returns only endpoint + keys', async () => {
    const repo = createInMemoryPushSubscriptionRepository();
    await repo.create('u1', { endpoint: 'https://push.test/a', keys: { p256dh: 'p', auth: 'x' } });
    const subs = await repo.findByUser('u1');
    expect(subs).toEqual([{ endpoint: 'https://push.test/a', keys: { p256dh: 'p', auth: 'x' } }]);

    await repo.delete('u1', 'https://push.test/a');
    expect(await repo.findByUser('u1')).toHaveLength(0);
  });
});

describe('in-memory notification-preference repository', () => {
  it('upserts with defaults then merges partial updates', async () => {
    const repo = createInMemoryNotificationPreferenceRepository();
    await repo.upsert('u1', 'login', { push: false });
    let prefs = await repo.findByUser('u1');
    expect(prefs).toEqual([{ typeKey: 'login', sse: true, push: false, email: true }]);

    await repo.upsert('u1', 'login', { email: false });
    prefs = await repo.findByUser('u1');
    expect(prefs).toEqual([{ typeKey: 'login', sse: true, push: false, email: false }]);
  });
});

describe('in-memory passkey repository', () => {
  it('creates, advances the counter via CAS, renames and deletes', async () => {
    const repo = createInMemoryPasskeyRepository();
    await repo.create('u1', {
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1, 2, 3]),
      publicKeyAlg: -7,
      counter: 5,
      aaguid: 'aaguid-1'
    });

    expect(await repo.updateCounter('cred-1', 6)).toBe(true);
    expect(await repo.updateCounter('cred-1', 6)).toBe(false); // not strictly higher
    expect((await repo.findByCredentialId('cred-1'))?.counter).toBe(6);

    // counter 0 = counterless authenticator → touch only, keep stored counter
    expect(await repo.updateCounter('cred-1', 0)).toBe(true);
    expect((await repo.findByCredentialId('cred-1'))?.counter).toBe(6);

    await repo.rename('u1', 'cred-1', 'My Key');
    expect((await repo.findByCredentialId('cred-1'))?.name).toBe('My Key');

    await repo.delete('u1', 'cred-1');
    expect(await repo.findByCredentialId('cred-1')).toBeNull();
  });
});
