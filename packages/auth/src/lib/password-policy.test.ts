import { describe, expect, it } from 'vitest';
import {
  activePasswordRules,
  DEFAULT_PASSWORD_POLICY,
  isValidMinLength,
  PASSWORD_RULES,
  parsePasswordPolicy,
  resolvePasswordPolicy,
  unmetPasswordRules
} from './password-policy.js';

describe('resolvePasswordPolicy', () => {
  it('answers the shipped defaults for an absent config', () => {
    expect(resolvePasswordPolicy(undefined)).toEqual(DEFAULT_PASSWORD_POLICY);
    expect(resolvePasswordPolicy({})).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  it('projects only the five policy fields — never the hashing work factor', () => {
    // This object is what the endpoint serializes. `pbkdf2Iterations` sits in
    // the same config and tells an attacker how expensive offline cracking is;
    // everything that survives here is derivable from one failed submit.
    const resolved = resolvePasswordPolicy({ minLength: 12, pbkdf2Iterations: 123_456 });
    expect(Object.keys(resolved).sort()).toEqual([
      'minLength',
      'requireDigit',
      'requireLowercase',
      'requireSpecial',
      'requireUppercase'
    ]);
    expect(JSON.stringify(resolved)).not.toContain('123456');
  });
});

describe('minLength normalization — the two sides must land on one number', () => {
  it('keeps an explicit 0 ("no minimum") instead of resetting it to 8', () => {
    // Measured before: the server accepted "abc" while the client checklist
    // demanded 8, because only the client re-applied the default.
    expect(resolvePasswordPolicy({ minLength: 0 }).minLength).toBe(0);
    expect(parsePasswordPolicy({ minLength: 0 }).minLength).toBe(0);
    expect(unmetPasswordRules('abc', resolvePasswordPolicy({ minLength: 0 }))).toEqual([]);
    // …and drops the permanently-ticked line from the checklist.
    expect(activePasswordRules(resolvePasswordPolicy({ minLength: 0 }))).toEqual([]);
  });

  it('falls back on a value that is not a finite non-negative number — on BOTH sides', () => {
    // `password.length >= NaN` is false, so a NaN config refused every password
    // server-side while the client rendered "At least 8".
    for (const junk of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(resolvePasswordPolicy({ minLength: junk }).minLength).toBe(8);
      expect(parsePasswordPolicy({ minLength: junk }).minLength).toBe(8);
    }
    expect(
      unmetPasswordRules('abcdefgh', resolvePasswordPolicy({ minLength: Number.NaN }))
    ).toEqual([]);
  });

  it('floors a fractional minimum rather than comparing against it', () => {
    expect(resolvePasswordPolicy({ minLength: 8.7 }).minLength).toBe(8);
    expect(parsePasswordPolicy({ minLength: 8.7 }).minLength).toBe(8);
  });

  it('names an invalid value at wiring time instead of correcting it silently', () => {
    expect(isValidMinLength(12)).toBe(true);
    expect(isValidMinLength(0)).toBe(true);
    expect(isValidMinLength(Number.NaN)).toBe(false);
    expect(isValidMinLength(-1)).toBe(false);
    expect(isValidMinLength('12')).toBe(false);
  });
});

describe('unmetPasswordRules', () => {
  it('reports nothing for a password that clears every active rule', () => {
    const policy = resolvePasswordPolicy({
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireDigit: true,
      requireSpecial: true
    });
    expect(unmetPasswordRules('Abcdefg1!', policy)).toEqual([]);
  });

  it('reports the failures in declaration order', () => {
    const policy = resolvePasswordPolicy({
      minLength: 10,
      requireUppercase: true,
      requireDigit: true
    });
    expect(unmetPasswordRules('abc', policy)).toEqual(['minLength', 'uppercase', 'digit']);
  });

  it('ignores rules the policy leaves off', () => {
    expect(unmetPasswordRules('abcdefgh', DEFAULT_PASSWORD_POLICY)).toEqual([]);
  });

  it('enforces requireSpecial — the rule the client checklist offered and the server could not', () => {
    const policy = resolvePasswordPolicy({ requireSpecial: true });
    expect(unmetPasswordRules('abcdefgh', policy)).toEqual(['special']);
    expect(unmetPasswordRules('abcdefg!', policy)).toEqual([]);
  });

  it('lists minLength always and the character classes only when required', () => {
    expect(activePasswordRules(DEFAULT_PASSWORD_POLICY)).toEqual(['minLength']);
    expect(activePasswordRules(resolvePasswordPolicy({ requireLowercase: true }))).toEqual([
      'minLength',
      'lowercase'
    ]);
    // Positive control on the rule set itself: every rule is reachable.
    expect(
      activePasswordRules(
        resolvePasswordPolicy({
          requireUppercase: true,
          requireLowercase: true,
          requireDigit: true,
          requireSpecial: true
        })
      )
    ).toEqual([...PASSWORD_RULES]);
  });
});

describe('parsePasswordPolicy', () => {
  it('reads a well-formed body', () => {
    expect(parsePasswordPolicy({ minLength: 12, requireUppercase: true })).toEqual({
      ...DEFAULT_PASSWORD_POLICY,
      minLength: 12,
      requireUppercase: true
    });
  });

  it('degrades a junk body to the defaults rather than letting NaN reach a comparison', () => {
    for (const junk of [null, undefined, 'nope', [], { minLength: 'twelve' }, { minLength: -1 }]) {
      expect(parsePasswordPolicy(junk)).toEqual(DEFAULT_PASSWORD_POLICY);
    }
  });
});
