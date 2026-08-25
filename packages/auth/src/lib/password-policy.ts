import type { PasswordConfig } from './types.js';

/**
 * The password rules this package can enforce, in the order a requirements
 * checklist renders them. Adding one here is a compile error everywhere it is
 * switched on — the server check, the client checklist and the locale keys.
 */
export const PASSWORD_RULES = ['minLength', 'uppercase', 'lowercase', 'digit', 'special'] as const;

/** One rule out of {@link PASSWORD_RULES}. */
export type PasswordRuleId = (typeof PASSWORD_RULES)[number];

/**
 * The password policy in force, with every default already applied — what
 * `validatePasswordStrength` measures a password against, and what
 * `createPasswordPolicyHandler` ships to the browser so the client-side gate
 * cannot disagree with the server.
 *
 * Deliberately NOT `PasswordConfig`: that type also carries
 * `pbkdf2Iterations`, a hashing work factor that is nobody's business on the
 * wire. This shape is the projection, and it is the only thing the endpoint
 * serializes.
 */
export interface PasswordPolicy {
  /** Minimum length. @default 8 */
  minLength: number;
  /** Require at least one `A-Z`. @default false */
  requireUppercase: boolean;
  /** Require at least one `a-z`. @default false */
  requireLowercase: boolean;
  /** Require at least one `0-9`. @default false */
  requireDigit: boolean;
  /** Require at least one character outside `A-Za-z0-9`. @default false */
  requireSpecial: boolean;
}

/**
 * What an unconfigured server enforces. A client that has not (yet) read the
 * policy off the server gates against exactly this, so the two agree by
 * default instead of by coincidence.
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
  requireSpecial: false
};

/** Apply the defaults to a (possibly absent) `config.password`. */
export function resolvePasswordPolicy(config?: PasswordConfig): PasswordPolicy {
  return {
    minLength: config?.minLength ?? DEFAULT_PASSWORD_POLICY.minLength,
    requireUppercase: config?.requireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
    requireLowercase: config?.requireLowercase ?? DEFAULT_PASSWORD_POLICY.requireLowercase,
    requireDigit: config?.requireDigit ?? DEFAULT_PASSWORD_POLICY.requireDigit,
    requireSpecial: config?.requireSpecial ?? DEFAULT_PASSWORD_POLICY.requireSpecial
  };
}

const RULE_PREDICATES: Record<
  PasswordRuleId,
  (password: string, policy: PasswordPolicy) => boolean
> = {
  minLength: (password, policy) => password.length >= policy.minLength,
  uppercase: (password) => /[A-Z]/.test(password),
  lowercase: (password) => /[a-z]/.test(password),
  digit: (password) => /\d/.test(password),
  special: (password) => /[^A-Za-z0-9]/.test(password)
};

const RULE_ENABLED: Record<PasswordRuleId, (policy: PasswordPolicy) => boolean> = {
  minLength: () => true,
  uppercase: (policy) => policy.requireUppercase,
  lowercase: (policy) => policy.requireLowercase,
  digit: (policy) => policy.requireDigit,
  special: (policy) => policy.requireSpecial
};

/** The rules this policy switches on, in {@link PASSWORD_RULES} order. */
export function activePasswordRules(policy: PasswordPolicy): PasswordRuleId[] {
  return PASSWORD_RULES.filter((rule) => RULE_ENABLED[rule](policy));
}

/** Whether one rule holds for a password. */
export function isPasswordRuleMet(
  rule: PasswordRuleId,
  password: string,
  policy: PasswordPolicy
): boolean {
  return RULE_PREDICATES[rule](password, policy);
}

/** The active rules a password fails, in {@link PASSWORD_RULES} order. */
export function unmetPasswordRules(password: string, policy: PasswordPolicy): PasswordRuleId[] {
  return activePasswordRules(policy).filter((rule) => !isPasswordRuleMet(rule, password, policy));
}

/**
 * Read a policy off an untrusted JSON body (the endpoint's response). Every
 * field falls back to its default, so a truncated or older response degrades
 * to the shipped defaults instead of `NaN`/`undefined` reaching a comparison.
 */
export function parsePasswordPolicy(value: unknown): PasswordPolicy {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    minLength:
      typeof raw.minLength === 'number' && Number.isFinite(raw.minLength) && raw.minLength > 0
        ? Math.floor(raw.minLength)
        : DEFAULT_PASSWORD_POLICY.minLength,
    requireUppercase: bool(raw.requireUppercase, DEFAULT_PASSWORD_POLICY.requireUppercase),
    requireLowercase: bool(raw.requireLowercase, DEFAULT_PASSWORD_POLICY.requireLowercase),
    requireDigit: bool(raw.requireDigit, DEFAULT_PASSWORD_POLICY.requireDigit),
    requireSpecial: bool(raw.requireSpecial, DEFAULT_PASSWORD_POLICY.requireSpecial)
  };
}
