// Small auth primitives that predate no feature module: opaque-token hashing,
// CSPRNG token generation and the public-user projection. Password hashing
// lives in password.ts, JWT signing/verification in jwt.ts (R17 split).

import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '../types.js';
import type { FullAuthUser } from './adapters/types.js';

// ---- Token hashing (SHA-256) ----

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---- Secure random token ----

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

// ---- Sanitize user ----

export function sanitizeUser<R extends string>(user: FullAuthUser<R>): AuthUser<R> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    totpEnabled: user.totpEnabled
  };
}
