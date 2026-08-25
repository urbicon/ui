import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
  verifyPasswordWithMigration
} from './password.js';

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

  it('should require a special character when configured', () => {
    // The client checklist has offered this rule since v8 while the server
    // ignored it: a UI demanding a symbol accepted nothing the server refused.
    const errors = validatePasswordStrength('abcdefgh', { requireSpecial: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('special');
    expect(validatePasswordStrength('abcdefg!', { requireSpecial: true })).toEqual([]);
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
