// Password hashing (Web Crypto PBKDF2 + legacy bcrypt verification) and the
// password strength policy. Split out of the former auth.ts god-file.

import { randomBytes } from 'node:crypto';
import {
  type PasswordPolicy,
  type PasswordRuleId,
  resolvePasswordPolicy,
  unmetPasswordRules
} from '../password-policy.js';
import type { PasswordConfig } from '../types.js';
import { timingSafeEqualStrings } from './timing-safe.js';

// OWASP-recommended work factor for PBKDF2-HMAC-SHA256 (≥ 600k). Used as the
// default for new hashes and as the rehash threshold — any stored hash with
// fewer iterations is transparently upgraded on the owner's next login.
export const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function resolvePbkdf2Iterations(config?: PasswordConfig): number {
  return config?.pbkdf2Iterations ?? PBKDF2_ITERATIONS;
}

export async function hashPassword(password: string, config?: PasswordConfig): Promise<string> {
  const iterations = resolvePbkdf2Iterations(config);
  const salt = randomBytes(SALT_LENGTH);
  const key = await derivePbkdf2Key(password, salt, iterations);
  return `pbkdf2:${iterations}:${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
}

export interface PasswordVerifyResult {
  valid: boolean;
  needsRehash: boolean;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const result = await verifyPasswordWithMigration(password, hash);
  return result.valid;
}

export async function verifyPasswordWithMigration(
  password: string,
  hash: string,
  config?: PasswordConfig
): Promise<PasswordVerifyResult> {
  // PBKDF2 (new format)
  if (hash.startsWith('pbkdf2:')) {
    const parts = hash.split(':');
    if (parts.length !== 4) return { valid: false, needsRehash: false };

    const iterations = parseInt(parts[1], 10);
    // A corrupt/non-numeric iteration count would make derivePbkdf2Key throw
    // (NaN/0 iterations), surfacing as a 500. Treat it like any other
    // malformed hash and reject cleanly (fail-closed), consistent with the
    // parts.length guard above.
    if (!Number.isInteger(iterations) || iterations < 1) {
      return { valid: false, needsRehash: false };
    }
    const salt = Buffer.from(parts[2], 'hex');
    const storedKey = parts[3];

    const key = await derivePbkdf2Key(password, salt, iterations);
    // Constant-time compare of the derived vs stored key (hex). Practically
    // irrelevant for a salted hash, but keeps the timing-safe discipline
    // uniform across every secret comparison in the package.
    const valid = timingSafeEqualStrings(Buffer.from(key).toString('hex'), storedKey);

    // Rehash if the stored hash uses fewer iterations than the current target
    // (default or configured) — upgrades legacy 100k hashes to 600k on login.
    return { valid, needsRehash: valid && iterations < resolvePbkdf2Iterations(config) };
  }

  // bcrypt (legacy format: $2a$, $2b$, $2y$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    const valid = await verifyBcrypt(password, hash);
    return { valid, needsRehash: valid }; // Always rehash bcrypt → PBKDF2
  }

  return { valid: false, needsRehash: false };
}

// Verify a legacy bcrypt hash (format: $2a$ / $2b$ / $2y$). Verification-only —
// new passwords are always hashed with PBKDF2 above and rehashed on next login.
//
// Strategy, in order of preference:
//   1. `Bun.password.verify` — native on Bun, supports bcrypt out of the box
//   2. Optional `bcrypt` / `bcryptjs` peer dependency — for Node.js consumers
async function verifyBcrypt(password: string, hash: string): Promise<boolean> {
  const bunVerify = (globalThis as { Bun?: { password?: { verify?: unknown } } }).Bun?.password
    ?.verify;
  if (typeof bunVerify === 'function') {
    try {
      return await (bunVerify as (p: string, h: string) => Promise<boolean>)(password, hash);
    } catch {
      return false;
    }
  }

  try {
    const bcryptVerify = await importBcryptVerify();
    if (bcryptVerify) return bcryptVerify(password, hash);
  } catch {
    // No bcrypt peer dep available — cannot verify legacy hash
  }
  return false;
}

// Dynamically import bcrypt if available (optional peer dependency, Node.js fallback).
// The specifier is passed via a variable and `/* @vite-ignore */` to keep bundlers
// (Vite 8+, esbuild) from failing the dependency scan when the consumer hasn't
// installed bcrypt/bcryptjs.
type BcryptModule = { compare: (password: string, hash: string) => Promise<boolean> };

async function importBcryptVerify(): Promise<
  ((password: string, hash: string) => Promise<boolean>) | null
> {
  for (const specifier of ['bcrypt', 'bcryptjs']) {
    try {
      const mod = (await import(/* @vite-ignore */ specifier)) as BcryptModule;
      return (password, hash) => mod.compare(password, hash);
    } catch {
      // try next specifier
    }
  }
  return null;
}

async function derivePbkdf2Key(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8
  );
}

// ---- Password strength validation ----

/**
 * English prose per failed rule. The *rules* live in `password-policy.ts` and
 * are shared with the client checklist, so the two can no longer disagree
 * about what counts as a valid password; only the wording is server-side.
 * These strings ride out as the `validation_error` prose — the one code whose
 * server text the localized client deliberately prefers, because it names the
 * field.
 */
const RULE_MESSAGES: Record<PasswordRuleId, (policy: PasswordPolicy) => string> = {
  minLength: (policy) => `Password must be at least ${policy.minLength} characters`,
  uppercase: () => 'Password must contain at least one uppercase letter',
  lowercase: () => 'Password must contain at least one lowercase letter',
  digit: () => 'Password must contain at least one digit',
  special: () => 'Password must contain at least one special character'
};

export function validatePasswordStrength(password: string, config?: PasswordConfig): string[] {
  const policy = resolvePasswordPolicy(config);
  return unmetPasswordRules(password, policy).map((rule) => RULE_MESSAGES[rule](policy));
}
