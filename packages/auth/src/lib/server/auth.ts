import { createHash, randomBytes } from 'node:crypto';
import type { AuthSession, AuthUser, JwtConfig, PasswordConfig } from '../types.js';
import type { FullAuthUser } from './adapters/types.js';
import { base64UrlDecodeString, base64UrlEncode, base64UrlEncodeString } from './encoding.js';
import { timingSafeEqual, timingSafeEqualStrings } from './timing-safe.js';

// ---- Token hashing (SHA-256) ----

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---- Password hashing (Web Crypto PBKDF2) ----

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

export function validatePasswordStrength(password: string, config?: PasswordConfig): string[] {
  const errors: string[] = [];
  const minLength = config?.minLength ?? 8;

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  if (config?.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (config?.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (config?.requireDigit && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  return errors;
}

// ---- JWT Session Tokens ----

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(signature);
  return timingSafeEqual(a, b);
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

export async function createSessionToken<R extends string>(
  payload: AuthSession<R>,
  config: JwtConfig
): Promise<string> {
  const header = base64UrlEncodeString(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
      ...(config.keyId ? { kid: config.keyId } : {})
    })
  );
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(config.expiresIn ?? '7d');

  const body = base64UrlEncodeString(
    JSON.stringify({
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      tv: payload.tokenVersion,
      iat: now,
      exp
    })
  );

  const signature = await hmacSign(`${header}.${body}`, config.secret);
  return `${header}.${body}.${signature}`;
}

/**
 * Resolve which secrets to try against a token with the given `kid`:
 * - No `kid` header → try primary plus every previous secret (back-compat).
 * - `kid` present → try every secret whose `keyId` matches, in order
 *   (primary first, then previousSecrets). An unmatched `kid` returns no
 *   candidates so verification fails closed instead of silently falling
 *   back to arbitrary unkeyed secrets (which would give attackers an
 *   oracle to probe retired keys).
 */
function selectVerifySecrets(config: JwtConfig, tokenKid: string | undefined): string[] {
  const candidates: Array<{ secret: string; keyId?: string }> = [
    { secret: config.secret, keyId: config.keyId },
    ...(config.previousSecrets ?? [])
  ];

  if (!tokenKid) return candidates.map((c) => c.secret);
  return candidates.filter((c) => c.keyId === tokenKid).map((c) => c.secret);
}

let previousSecretsImportWarned = false;

export async function verifySessionToken<R extends string>(
  token: string,
  config: JwtConfig
): Promise<AuthSession<R> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  if (!parts.every((p) => BASE64URL_REGEX.test(p))) return null;

  const [header, body, signature] = parts;

  let tokenKid: string | undefined;
  try {
    const headerJson = JSON.parse(base64UrlDecodeString(header));
    if (typeof headerJson.kid === 'string') tokenKid = headerJson.kid;
  } catch {
    // Malformed header — treat as "no kid" and keep going; the signature
    // check below will reject the token if it's actually broken.
  }

  const secrets = selectVerifySecrets(config, tokenKid);
  // Iterate every candidate without early break: a timing oracle that reveals
  // which secret matched (primary vs a previousSecret) would let an attacker
  // target sessions still signed by a compromised retired key.
  let valid = false;
  let importErrors = 0;
  for (const secret of secrets) {
    try {
      if (await hmacVerify(`${header}.${body}`, signature, secret)) valid = true;
    } catch (err) {
      // A crypto.subtle.importKey rejection means the config has a malformed
      // secret (empty string, non-string). Don't mask as "no session" forever
      // — warn loudly once so consumers notice the broken previousSecrets.
      importErrors++;
      if (!previousSecretsImportWarned) {
        previousSecretsImportWarned = true;

        console.error(
          '[auth] verifySessionToken: secret import failed — check config.secret / config.previousSecrets.',
          err
        );
      }
    }
  }
  if (!valid) return null;
  // Defensive: if every candidate errored we already bailed via `!valid`, so
  // this branch is just a paranoia marker for future refactors.
  void importErrors;

  try {
    const payload = JSON.parse(base64UrlDecodeString(body));
    // exp is mandatory: a missing/non-numeric exp would otherwise be treated
    // as "never expires", giving anyone in possession of a (current or
    // retired) signing secret an unbounded forge window.
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    // Validate the claim shape even though the signature already matched: a
    // token minted with a missing/wrong-typed claim (e.g. no `sub`, a numeric
    // `role`) must not flow into the app as `userId: undefined` /
    // `role: <number>` where downstream guards (findById, role checks) would
    // behave unpredictably. Fail closed instead.
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.tv !== 'number'
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as R,
      tokenVersion: payload.tv
    };
  } catch {
    // Body decode/parse failure on an otherwise signature-valid token: treat
    // as broken but not as a logged-out session (signature matched!), so we
    // still surface null rather than propagating.
    return null;
  }
}

// ---- Generic short-lived signed tokens ----

/**
 * Sign an arbitrary claims object as a compact HS256 JWT, stamping `iat`/`exp`.
 * The generic counterpart to {@link createSessionToken} — for short-lived,
 * single-purpose tokens (e.g. the pending-2FA handle) that ride in their own
 * cookie and are read back with {@link verifySignedToken}. It reuses the exact
 * same HMAC signing as the session token, so no new key material is introduced;
 * pass `config.jwt.secret`. `expiresInSeconds` should be small (minutes).
 */
export async function createSignedToken(
  claims: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number
): Promise<string> {
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncodeString(
    JSON.stringify({ ...claims, iat: now, exp: now + expiresInSeconds })
  );
  const signature = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a {@link createSignedToken} token: timing-safe signature check plus a
 * **mandatory, in-date `exp`**. Returns the decoded claims on success, else
 * `null` (malformed, bad signature, missing/expired `exp`) — never throws. A
 * valid signature does NOT vouch for claim shape: the caller MUST still check
 * the domain claims it expects (e.g. `pending2fa === true`, a string `sub`),
 * exactly as `verifySessionToken` validates its claim shape. This is what keeps
 * a token minted for one purpose from being accepted for another.
 */
export async function verifySignedToken<T extends Record<string, unknown>>(
  token: string,
  secret: string
): Promise<(T & { iat: number; exp: number }) | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  if (!parts.every((p) => BASE64URL_REGEX.test(p))) return null;
  const [header, body, signature] = parts;

  let valid: boolean;
  try {
    valid = await hmacVerify(`${header}.${body}`, signature, secret);
  } catch {
    // A malformed secret makes importKey reject — treat as a failed verify
    // (fail-closed) rather than letting the rejection surface as a 500.
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeString(body));
    // exp is mandatory: a missing/non-numeric exp would be an unbounded token.
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload as T & { iat: number; exp: number };
  } catch {
    return null;
  }
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
