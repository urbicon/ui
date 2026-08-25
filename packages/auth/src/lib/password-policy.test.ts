import { describe, expect, it } from 'vitest';
import {
  activePasswordRules,
  DEFAULT_PASSWORD_POLICY,
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
