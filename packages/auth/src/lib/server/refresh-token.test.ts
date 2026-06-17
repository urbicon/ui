import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { AuthConfig, RefreshTokenConfig } from '../types.js';
import { createInMemoryRefreshTokenRepository } from './adapters/in-memory-refresh-token.js';
import type { FullAuthUser } from './adapters/types.js';
import { hashToken } from './auth.js';
import {
  clearRefreshCookie,
  issueRefreshToken,
  parseDurationSeconds,
  readRefreshCookie,
  resolveJwtConfig,
  revokeRefreshFromCookie,
  rotateRefreshToken,
  setRefreshCookie
} from './refresh-token.js';

function makeUser(overrides?: Partial<FullAuthUser>): FullAuthUser {
  return {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test',
    role: 'user',
    emailVerified: true,
    totpEnabled: false,
    passwordHash: 'hash',
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
    totpConfirmedAt: null,
    ...overrides
  };
}

function makeCookies(initial: Record<string, string> = {}): Cookies {
  const store = new Map(Object.entries(initial));
  return {
    get: (name: string) => store.get(name) ?? undefined,
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
    getAll: () => [],
    serialize: () => ''
  } as unknown as Cookies;
}

const config: RefreshTokenConfig = {
  accessTokenTtl: '15m',
  refreshTokenTtl: '30d'
};

describe('parseDurationSeconds', () => {
  it('parses seconds/minutes/hours/days', () => {
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('15m')).toBe(15 * 60);
    expect(parseDurationSeconds('2h')).toBe(2 * 3600);
    expect(parseDurationSeconds('7d')).toBe(7 * 86400);
  });

  it('throws on invalid format', () => {
    expect(() => parseDurationSeconds('15x')).toThrow();
    expect(() => parseDurationSeconds('abc')).toThrow();
    expect(() => parseDurationSeconds('')).toThrow();
  });
});

describe('resolveJwtConfig', () => {
  it('returns the JWT config unchanged when refresh-token rotation is disabled', () => {
    const auth: AuthConfig = { appUrl: 'https://app.test', jwt: { secret: 's', expiresIn: '7d' } };
    expect(resolveJwtConfig(auth)).toEqual(auth.jwt);
  });

  it('shortens the access-token TTL to accessTokenTtl when refresh rotation is enabled', () => {
    const auth: AuthConfig = {
      appUrl: 'https://app.test',
      jwt: { secret: 's' },
      refreshToken: { accessTokenTtl: '15m', refreshTokenTtl: '30d' }
    };
    expect(resolveJwtConfig(auth).expiresIn).toBe('15m');
  });

  it('honours explicit jwt.expiresIn even when refresh rotation is on', () => {
    const auth: AuthConfig = {
      appUrl: 'https://app.test',
      jwt: { secret: 's', expiresIn: '5m' },
      refreshToken: { accessTokenTtl: '15m' }
    };
    expect(resolveJwtConfig(auth).expiresIn).toBe('5m');
  });

  it('defaults accessTokenTtl to 15m when not specified', () => {
    const auth: AuthConfig = { appUrl: 'https://app.test', jwt: { secret: 's' }, refreshToken: {} };
    expect(resolveJwtConfig(auth).expiresIn).toBe('15m');
  });
});

describe('issueRefreshToken', () => {
  it('returns a raw token whose hash matches the stored record', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token, record } = await issueRefreshToken(repo, 'user-1', config);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(record.tokenHash).toBe(hashToken(token));
    expect(record.userId).toBe('user-1');
  });

  it('sets expiresAt based on refreshTokenTtl', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const before = Date.now();
    const { record } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '1h' });
    const delta = record.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(3600 * 1000 - 50);
    expect(delta).toBeLessThanOrEqual(3600 * 1000 + 50);
  });

  it('creates a fresh family on every call', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const a = await issueRefreshToken(repo, 'user-1', config);
    const b = await issueRefreshToken(repo, 'user-1', config);
    expect(a.record.family).not.toBe(b.record.family);
  });
});

describe('rotateRefreshToken', () => {
  const findUser = async (id: string) => (id === 'user-1' ? makeUser() : null);

  it('returns not_found when the token is unknown', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const outcome = await rotateRefreshToken(repo, 'not-a-token', findUser, config);
    expect(outcome.kind).toBe('not_found');
  });

  it('rotates a valid token and revokes the predecessor with replacedById', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token, record: original } = await issueRefreshToken(repo, 'user-1', config);

    const outcome = await rotateRefreshToken(repo, token, findUser, config);
    expect(outcome.kind).toBe('rotated');
    if (outcome.kind !== 'rotated') return;

    expect(outcome.token).not.toBe(token);
    expect(outcome.record.family).toBe(original.family);

    const afterRevoke = await repo.findByHash(hashToken(token));
    expect(afterRevoke?.revokedAt).toBeInstanceOf(Date);
    expect(afterRevoke?.replacedById).toBe(outcome.record.id);
  });

  it('detects reuse of a rotated token outside the grace window and revokes the whole family', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token: t1 } = await issueRefreshToken(repo, 'user-1', config);
    const first = await rotateRefreshToken(repo, t1, findUser, config);
    expect(first.kind).toBe('rotated');

    // Age the revoke past the grace window so it's no longer a race.
    const predecessor = await repo.findByHash(hashToken(t1));
    if (predecessor?.revokedAt) predecessor.revokedAt = new Date(Date.now() - 60_000);

    const reuse = await rotateRefreshToken(repo, t1, findUser, config);
    expect(reuse.kind).toBe('reused');

    // The successor that was valid a moment ago must now also be revoked
    if (first.kind === 'rotated') {
      const successor = await repo.findByHash(hashToken(first.token));
      expect(successor?.revokedAt).toBeInstanceOf(Date);
    }
  });

  it('treats a replay inside the grace window as a concurrent-rotation race, not reuse', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token: t1 } = await issueRefreshToken(repo, 'user-1', config);
    const first = await rotateRefreshToken(repo, t1, findUser, config);
    expect(first.kind).toBe('rotated');

    // Immediately replay (within grace window) — the loser of a concurrent
    // rotation. Must NOT revoke the family; the successor stays live.
    const race = await rotateRefreshToken(repo, t1, findUser, config);
    expect(race.kind).toBe('race_ok');

    if (first.kind === 'rotated') {
      const successor = await repo.findByHash(hashToken(first.token));
      expect(successor?.revokedAt).toBeNull();
    }
  });

  it('returns expired for tokens past their expiresAt', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '1s' });
    // Hand-revise the stored expiresAt so we do not have to sleep
    const existing = await repo.findByHash(hashToken(token));
    if (existing) existing.expiresAt = new Date(Date.now() - 1000);

    const outcome = await rotateRefreshToken(repo, token, findUser, config);
    expect(outcome.kind).toBe('expired');
  });

  it('returns revoked when the user has been deleted', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token } = await issueRefreshToken(repo, 'user-1', config);
    const outcome = await rotateRefreshToken(repo, token, async () => null, config);
    expect(outcome.kind).toBe('revoked');
  });

  // Root finding D.1: before the CAS-revoke, two concurrent first-rotations of
  // the same token both read it as live, both created a successor, and both
  // revoked the predecessor as a no-op → the family ended up with two live
  // tokens, silently defeating reuse-detection. JS is single-threaded, but the
  // awaits inside rotateRefreshToken interleave the two calls, so Promise.all
  // reproduces the race deterministically.
  it('serializes two concurrent rotations of the same token to exactly one winner', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token: t1 } = await issueRefreshToken(repo, 'user-1', config);

    const [a, b] = await Promise.all([
      rotateRefreshToken(repo, t1, findUser, config),
      rotateRefreshToken(repo, t1, findUser, config)
    ]);

    // Exactly one winner; the loser is a benign race, never a second 'rotated'.
    expect([a.kind, b.kind].sort()).toEqual(['race_ok', 'rotated']);

    // The predecessor is revoked, and the single winner's successor is live.
    const predecessor = await repo.findByHash(hashToken(t1));
    expect(predecessor?.revokedAt).toBeInstanceOf(Date);

    const winner = a.kind === 'rotated' ? a : b.kind === 'rotated' ? b : null;
    expect(winner).not.toBeNull();
    if (winner?.kind === 'rotated') {
      const successor = await repo.findByHash(hashToken(winner.token));
      expect(successor?.revokedAt).toBeNull();
      // And the winner's token must itself still rotate — proving it is the one
      // live token, not a zombie sibling.
      const next = await rotateRefreshToken(repo, winner.token, findUser, config);
      expect(next.kind).toBe('rotated');
    }
  });

  it('keeps exactly one winner under a 5-way concurrent rotation burst', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token: t1 } = await issueRefreshToken(repo, 'user-1', config);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => rotateRefreshToken(repo, t1, findUser, config))
    );

    const rotated = outcomes.filter((o) => o.kind === 'rotated');
    expect(rotated).toHaveLength(1);
    // Everyone else loses gracefully as a race, never as a family-burning reuse.
    expect(outcomes.every((o) => o.kind === 'rotated' || o.kind === 'race_ok')).toBe(true);
  });
});

describe('cookie helpers', () => {
  it('setRefreshCookie / readRefreshCookie / clearRefreshCookie round-trip', () => {
    const cookies = makeCookies();
    setRefreshCookie(cookies, 'abc', config);
    expect(readRefreshCookie(cookies, config)).toBe('abc');
    clearRefreshCookie(cookies, config);
    expect(readRefreshCookie(cookies, config)).toBe(null);
  });

  it('honours a custom cookieName', () => {
    const cfg = { ...config, cookieName: 'my_refresh' };
    const cookies = makeCookies();
    setRefreshCookie(cookies, 'abc', cfg);
    expect(readRefreshCookie(cookies, cfg)).toBe('abc');
    expect(readRefreshCookie(cookies, config)).toBe(null);
  });
});

describe('revokeRefreshFromCookie', () => {
  it('revokes the token sitting in the cookie', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token } = await issueRefreshToken(repo, 'user-1', config);
    const cookies = makeCookies();
    setRefreshCookie(cookies, token, config);

    await revokeRefreshFromCookie(cookies, repo, config);

    const record = await repo.findByHash(hashToken(token));
    expect(record?.revokedAt).toBeInstanceOf(Date);
  });

  it('is a no-op when the cookie is missing', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const cookies = makeCookies();
    await expect(revokeRefreshFromCookie(cookies, repo, config)).resolves.toBeUndefined();
  });

  it('revokes the whole family when the cookie carries an already-revoked token (replay)', async () => {
    // Logout presenting a stolen+replayed token is the same threat model as
    // rotation replay — burn the whole family so the attacker is locked out.
    const repo = createInMemoryRefreshTokenRepository();
    const { token, record } = await issueRefreshToken(repo, 'user-1', config);
    const siblingIssue = await issueRefreshToken(repo, 'user-1', config);
    // Force both into the same family to simulate a rotation sequence
    siblingIssue.record.family = record.family;
    await repo.revoke(record.id);

    const cookies = makeCookies();
    setRefreshCookie(cookies, token, config);
    await revokeRefreshFromCookie(cookies, repo, config);

    const sibling = await repo.findByHash(hashToken(siblingIssue.token));
    expect(sibling?.revokedAt).toBeInstanceOf(Date);
  });
});

describe('InMemoryRefreshTokenRepository', () => {
  it('revokeAllForUser revokes every non-revoked token for the user', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { token: aliceA } = await issueRefreshToken(repo, 'user-1', config);
    const { token: aliceB } = await issueRefreshToken(repo, 'user-1', config);
    const { token: bob } = await issueRefreshToken(repo, 'user-2', config);

    await repo.revokeAllForUser('user-1');

    const aliceARecord = await repo.findByHash(hashToken(aliceA));
    const aliceBRecord = await repo.findByHash(hashToken(aliceB));
    const bobRecord = await repo.findByHash(hashToken(bob));

    expect(aliceARecord?.revokedAt).toBeInstanceOf(Date);
    expect(aliceBRecord?.revokedAt).toBeInstanceOf(Date);
    expect(bobRecord?.revokedAt).toBeNull();
  });

  it('deleteExpired removes only expired rows and returns the count', async () => {
    const repo = createInMemoryRefreshTokenRepository();
    const { record: fresh } = await issueRefreshToken(repo, 'user-1', config);
    const { token: staleToken } = await issueRefreshToken(repo, 'user-1', config);
    const stale = await repo.findByHash(hashToken(staleToken));
    if (stale) stale.expiresAt = new Date(Date.now() - 1000);

    const deleted = await repo.deleteExpired();
    expect(deleted).toBe(1);
    expect(await repo.findByHash(fresh.tokenHash)).not.toBeNull();
  });
});
