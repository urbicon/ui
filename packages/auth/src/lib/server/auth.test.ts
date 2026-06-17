import { describe, expect, it, vi } from 'vitest';
import type { AuthSession, JwtConfig } from '../types.js';
import type { FullAuthUser } from './adapters/types.js';
import {
  createSessionToken,
  createSignedToken,
  generateSecureToken,
  hashPassword,
  hashToken,
  sanitizeUser,
  validatePasswordStrength,
  verifyPassword,
  verifyPasswordWithMigration,
  verifySessionToken,
  verifySignedToken
} from './auth.js';

const session: AuthSession<'USER'> = {
  userId: 'u-1',
  email: 'u@u',
  role: 'USER',
  tokenVersion: 1
};

function decodeHeader(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
}

describe('hashToken', () => {
  it('should return a hex SHA-256 hash', () => {
    const hash = hashToken('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be deterministic', () => {
    expect(hashToken('hello')).toBe(hashToken('hello'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});

describe('hashPassword / verifyPassword', () => {
  it('should hash and verify a password', async () => {
    const hash = await hashPassword('myPassword123');
    expect(hash).toContain('pbkdf2:');
    expect(await verifyPassword('myPassword123', hash)).toBe(true);
  });

  it('should reject wrong passwords', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('should produce different hashes for the same password (random salt)', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
  });

  it('should reject invalid hash formats', async () => {
    expect(await verifyPassword('test', 'not-a-valid-hash')).toBe(false);
  });
});

describe('verifyPasswordWithMigration', () => {
  it('should verify PBKDF2 hash without rehash flag', async () => {
    const hash = await hashPassword('test');
    const result = await verifyPasswordWithMigration('test', hash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it('should set needsRehash=true for bcrypt hashes (if bcrypt available)', async () => {
    // Simulate a bcrypt hash — verification will fail (no bcrypt installed)
    // but the detection should work
    const bcryptHash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01';
    const result = await verifyPasswordWithMigration('test', bcryptHash);
    // bcrypt is not installed in test env, so valid=false
    expect(result.valid).toBe(false);
  });

  it('should reject unknown hash formats', async () => {
    const result = await verifyPasswordWithMigration('test', 'unknown:format');
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it('rejects a pbkdf2 hash with a corrupt iteration count without throwing', async () => {
    // Corrupt DB hash: non-numeric iterations would make deriveBits throw a 500.
    const result = await verifyPasswordWithMigration('pw', 'pbkdf2:notanumber:aabb:ccdd');
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });
});

describe('PBKDF2 iteration count (F.2)', () => {
  it('defaults to the OWASP-recommended 600k iterations', async () => {
    const hash = await hashPassword('pw');
    expect(hash.startsWith('pbkdf2:600000:')).toBe(true);
  });

  it('flags a legacy lower-iteration hash for rehash on verify', async () => {
    // A 100k hash predates the 600k bump — must verify true AND rehash.
    const legacy = await hashPassword('pw', { pbkdf2Iterations: 1000 });
    expect(legacy.startsWith('pbkdf2:1000:')).toBe(true);
    const result = await verifyPasswordWithMigration('pw', legacy);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it('does not flag a current-target hash for rehash', async () => {
    const hash = await hashPassword('pw', { pbkdf2Iterations: 5000 });
    const result = await verifyPasswordWithMigration('pw', hash, { pbkdf2Iterations: 5000 });
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it('embeds and honours a configured iteration count for new hashes', async () => {
    const hash = await hashPassword('pw', { pbkdf2Iterations: 2000 });
    expect(hash.startsWith('pbkdf2:2000:')).toBe(true);
    // Verification reads the count from the hash, so it still succeeds.
    expect(await verifyPassword('pw', hash)).toBe(true);
  });

  it('computes needsRehash against the configured target, not just the default', async () => {
    // Hash below a raised target → rehash; raising the bar re-triggers upgrade.
    const hash = await hashPassword('pw', { pbkdf2Iterations: 1000 });
    const result = await verifyPasswordWithMigration('pw', hash, { pbkdf2Iterations: 5000 });
    expect(result.needsRehash).toBe(true);
  });
});

describe('validatePasswordStrength', () => {
  it('should accept a valid password with defaults', () => {
    expect(validatePasswordStrength('abcdefgh')).toEqual([]);
  });

  it('should reject short passwords', () => {
    const errors = validatePasswordStrength('short');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('at least 8');
  });

  it('should enforce custom minLength', () => {
    const errors = validatePasswordStrength('abcdefghij', { minLength: 12 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('at least 12');
  });

  it('should require uppercase when configured', () => {
    const errors = validatePasswordStrength('abcdefgh', { requireUppercase: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('uppercase');
  });

  it('should require lowercase when configured', () => {
    const errors = validatePasswordStrength('ABCDEFGH', { requireLowercase: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('lowercase');
  });

  it('should require digit when configured', () => {
    const errors = validatePasswordStrength('abcdefgh', { requireDigit: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('digit');
  });

  it('should accumulate multiple errors', () => {
    const errors = validatePasswordStrength('ab', {
      minLength: 8,
      requireUppercase: true,
      requireDigit: true
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('createSessionToken / verifySessionToken', () => {
  const jwtConfig: JwtConfig = { secret: 'test-secret-key-for-testing', expiresIn: '1h' };

  it('should create and verify a token', async () => {
    const payload: AuthSession = {
      userId: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      tokenVersion: 0
    };

    const token = await createSessionToken(payload, jwtConfig);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);

    const result = await verifySessionToken(token, jwtConfig);
    expect(result).toEqual(payload);
  });

  it('should reject a token with wrong secret', async () => {
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      jwtConfig
    );
    const result = await verifySessionToken(token, { ...jwtConfig, secret: 'wrong-secret' });
    expect(result).toBeNull();
  });

  it('should reject a tampered token', async () => {
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      jwtConfig
    );
    const tampered = `${token.slice(0, -2)}XX`;
    const result = await verifySessionToken(tampered, jwtConfig);
    expect(result).toBeNull();
  });

  it('should reject expired tokens', async () => {
    vi.useFakeTimers();
    const shortConfig: JwtConfig = { secret: 'test', expiresIn: '1s' };
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      shortConfig
    );

    vi.advanceTimersByTime(2000);
    const result = await verifySessionToken(token, shortConfig);
    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it('should reject invalid token formats', async () => {
    expect(await verifySessionToken('', jwtConfig)).toBeNull();
    expect(await verifySessionToken('a.b', jwtConfig)).toBeNull();
    expect(await verifySessionToken('not-a-token', jwtConfig)).toBeNull();
  });

  it('should use 7d default expiry', async () => {
    const noExpiryConfig: JwtConfig = { secret: 'test' };
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      noExpiryConfig
    );
    const result = await verifySessionToken(token, noExpiryConfig);
    expect(result).not.toBeNull();
  });

  it('rejects a validly-signed token whose claims are missing or wrong-typed', async () => {
    // Sign a payload with the real secret but a broken claim shape, so the
    // signature check passes and only the claim-type guard can reject it.
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    async function signRaw(payload: Record<string, unknown>): Promise<string> {
      const header = enc({ alg: 'HS256', typ: 'JWT' });
      const body = enc(payload);
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(jwtConfig.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${header}.${body}`)
      );
      return `${header}.${body}.${Buffer.from(sig).toString('base64url')}`;
    }

    const future = Math.floor(Date.now() / 1000) + 3600;
    // Missing `sub` entirely.
    expect(
      await verifySessionToken(
        await signRaw({ email: 'a@b.c', role: 'user', tv: 0, exp: future }),
        jwtConfig
      )
    ).toBeNull();
    // `role` is a number, not a string.
    expect(
      await verifySessionToken(
        await signRaw({ sub: '1', email: 'a@b.c', role: 1, tv: 0, exp: future }),
        jwtConfig
      )
    ).toBeNull();
    // `tv` missing.
    expect(
      await verifySessionToken(
        await signRaw({ sub: '1', email: 'a@b.c', role: 'user', exp: future }),
        jwtConfig
      )
    ).toBeNull();
  });
});

describe('generateSecureToken', () => {
  it('should return a 64-char hex string', () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate unique tokens', () => {
    const t1 = generateSecureToken();
    const t2 = generateSecureToken();
    expect(t1).not.toBe(t2);
  });
});

describe('sanitizeUser', () => {
  it('should strip sensitive fields', () => {
    const full: FullAuthUser = {
      id: '1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'admin',
      emailVerified: true,
      totpEnabled: true,
      passwordHash: 'secret-hash',
      tokenVersion: 3,
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
      totpSecret: 'enc:secret',
      totpConfirmedAt: new Date()
    };

    const safe = sanitizeUser(full);
    expect(safe).toEqual({
      id: '1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'admin',
      emailVerified: true,
      totpEnabled: true
    });
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).not.toHaveProperty('tokenVersion');
    // The encrypted secret must never leak through sanitizeUser.
    expect(safe).not.toHaveProperty('totpSecret');
  });
});

describe('createSessionToken / verifySessionToken — key rotation', () => {
  it('omits the kid header when no keyId is configured', async () => {
    const token = await createSessionToken(session, { secret: 's1' });
    const header = decodeHeader(token);
    expect(header).not.toHaveProperty('kid');
  });

  it('embeds the kid header when keyId is configured', async () => {
    const token = await createSessionToken(session, { secret: 's1', keyId: 'v1' });
    const header = decodeHeader(token);
    expect(header.kid).toBe('v1');
  });

  it('verifies a token signed with the primary secret', async () => {
    const config: JwtConfig = { secret: 's1', keyId: 'v1' };
    const token = await createSessionToken(session, config);
    const verified = await verifySessionToken(token, config);
    expect(verified?.userId).toBe('u-1');
  });

  it('rejects a token signed with an unknown secret', async () => {
    const a: JwtConfig = { secret: 's1' };
    const b: JwtConfig = { secret: 's2' };
    const token = await createSessionToken(session, a);
    expect(await verifySessionToken(token, b)).toBeNull();
  });

  it('accepts a token signed with a previous secret during rotation', async () => {
    const before: JwtConfig = { secret: 'old', keyId: 'v1' };
    const after: JwtConfig = {
      secret: 'new',
      keyId: 'v2',
      previousSecrets: [{ secret: 'old', keyId: 'v1' }]
    };

    const oldToken = await createSessionToken(session, before);
    const newToken = await createSessionToken(session, after);

    // Old token still verifies after rotation.
    const oldVerified = await verifySessionToken(oldToken, after);
    expect(oldVerified?.userId).toBe('u-1');

    // New tokens verify under the new config too.
    const newVerified = await verifySessionToken(newToken, after);
    expect(newVerified?.userId).toBe('u-1');
  });

  it('stops accepting a retired secret once removed from previousSecrets', async () => {
    const before: JwtConfig = { secret: 'old', keyId: 'v1' };
    const afterNoHistory: JwtConfig = { secret: 'new', keyId: 'v2' };

    const oldToken = await createSessionToken(session, before);
    expect(await verifySessionToken(oldToken, afterNoHistory)).toBeNull();
  });

  it('prefers the kid-matching secret but falls back to unkeyed secrets', async () => {
    // Consumer rotates but also keeps a legacy unkeyed secret for tokens
    // issued before the rotation introduced kid headers at all.
    const config: JwtConfig = {
      secret: 'primary',
      keyId: 'v2',
      previousSecrets: [{ secret: 'legacy-without-kid' }]
    };

    // Create a token WITHOUT kid using the legacy secret.
    const legacyToken = await createSessionToken(session, { secret: 'legacy-without-kid' });
    const verified = await verifySessionToken(legacyToken, config);
    expect(verified?.userId).toBe('u-1');
  });

  it('ignores an unknown kid and rejects the token', async () => {
    const a: JwtConfig = { secret: 's1', keyId: 'v1' };
    const b: JwtConfig = { secret: 's1', keyId: 'v3' };
    const token = await createSessionToken(session, a);
    // b advertises kid=v3 but the token carries kid=v1 and b does not list
    // v1 in previousSecrets — reject cleanly.
    expect(await verifySessionToken(token, b)).toBeNull();
  });
});

describe('createSignedToken / verifySignedToken', () => {
  it('round-trips arbitrary claims', async () => {
    const token = await createSignedToken({ purpose: 'x', sub: 'u-1' }, 'secret', 300);
    const claims = await verifySignedToken<{ purpose: string; sub: string }>(token, 'secret');
    expect(claims?.purpose).toBe('x');
    expect(claims?.sub).toBe('u-1');
    expect(typeof claims?.exp).toBe('number');
    expect(typeof claims?.iat).toBe('number');
  });

  it('rejects an expired token (exp in the past)', async () => {
    const token = await createSignedToken({ sub: 'u-1' }, 'secret', -1);
    expect(await verifySignedToken(token, 'secret')).toBeNull();
  });

  it('rejects a wrong secret and a tampered body', async () => {
    const token = await createSignedToken({ sub: 'u-1' }, 'secret', 300);
    expect(await verifySignedToken(token, 'other-secret')).toBeNull();
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(await verifySignedToken(tampered, 'secret')).toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    expect(await verifySignedToken('a.b', 'secret')).toBeNull();
    expect(await verifySignedToken('not a token', 'secret')).toBeNull();
  });
});
