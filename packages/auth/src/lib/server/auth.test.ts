import { describe, expect, it } from 'vitest';
import type { FullAuthUser } from './adapters/types.js';
import { generateSecureToken, hashToken, sanitizeUser } from './auth.js';

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
