import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { AuthConfig, TwoFactorConfig } from '../types.js';
import { createSignedToken, hashToken, verifySignedToken } from './auth.js';
import { parseDurationSeconds } from './duration.js';
import { base32Encode, type TotpAlgorithm } from './totp.js';

/**
 * Server-side plumbing for the TOTP two-factor flow that sits *between* the
 * crypto core (`totp.ts`) and the route handlers: the short-lived pending-2FA
 * token + its cookie (the bridge between the password step and the code step),
 * the config-defaults resolver, and backup-code generation. All zero-dep.
 */

const DEFAULT_PENDING_TTL = '5m';
const DEFAULT_BACKUP_CODE_COUNT = 10;

// ---- Pending-2FA cookie ---------------------------------------------------
//
// The pending token rides in its own cookie, NOT the session cookie — the
// handle hook only reads the session cookie, so a pending token never opens a
// protected route (it only lets the verify handler finish the login). Mirrors
// the passkey ceremony handle.

const PENDING_2FA_COOKIE = 'urbicon_2fa';

// `__Host-` blocks a sibling/parent subdomain from shadowing the cookie. It
// mandates Secure + Path=/ + no Domain, so a browser drops it over plain HTTP —
// use it only on HTTPS (`jwt.cookieSecure !== false`) and fall back to the bare
// name for non-HTTPS dev. Set and read derive `secure` from the same config, so
// the name always agrees.
function pending2faCookieName(secure: boolean): string {
  return secure ? `__Host-${PENDING_2FA_COOKIE}` : PENDING_2FA_COOKIE;
}

function isSecure<R extends string>(config: AuthConfig<R>): boolean {
  return config.jwt.cookieSecure !== false;
}

function pendingTtlSeconds(config: TwoFactorConfig | undefined): number {
  return parseDurationSeconds(config?.pendingTokenTtl ?? DEFAULT_PENDING_TTL);
}

/** Write the pending-2FA cookie (HttpOnly, SameSite=Strict, short-lived). */
export function setPending2faCookie<R extends string>(
  cookies: Cookies,
  token: string,
  config: AuthConfig<R>
): void {
  const secure = isSecure(config);
  cookies.set(pending2faCookieName(secure), token, {
    path: '/',
    httpOnly: true,
    secure,
    // The whole ceremony (login → verify) is same-origin fetch with no
    // navigation in between, so the tightest SameSite applies at no UX cost.
    sameSite: 'strict',
    maxAge: pendingTtlSeconds(config.twoFactor)
  });
}

export function readPending2faCookie<R extends string>(
  cookies: Cookies,
  config: AuthConfig<R>
): string | null {
  return cookies.get(pending2faCookieName(isSecure(config))) ?? null;
}

export function clearPending2faCookie<R extends string>(
  cookies: Cookies,
  config: AuthConfig<R>
): void {
  cookies.delete(pending2faCookieName(isSecure(config)), { path: '/' });
}

// ---- Pending-2FA token ----------------------------------------------------

interface Pending2faClaims extends Record<string, unknown> {
  /** Domain marker — must be exactly `true`, distinguishing this from a session token. */
  pending2fa: true;
  /** The user who passed the password step and now owes a second factor. */
  sub: string;
}

/**
 * Mint the signed pending-2FA token issued after a correct password when the
 * account has 2FA on. It carries only `{ pending2fa: true, sub: userId }` — no
 * email/role/tokenVersion — so `verifySessionToken` rejects it (it has no
 * `email`/`role`/`tv`) and it can never act as a session. Short-lived
 * (`twoFactor.pendingTokenTtl`, default 5 min). Signed with the existing
 * `jwt.secret`.
 */
export function createPending2faToken<R extends string>(
  userId: string,
  config: AuthConfig<R>
): Promise<string> {
  return createSignedToken(
    { pending2fa: true, sub: userId } satisfies Pending2faClaims,
    config.jwt.secret,
    pendingTtlSeconds(config.twoFactor)
  );
}

/**
 * Verify a pending-2FA token and return the user id, or `null` when it is
 * missing/expired/forged or not actually a pending-2FA token. The strict
 * `pending2fa === true` + string-`sub` check is what stops a token minted for
 * another purpose (or a session token) from being accepted here.
 */
export async function verifyPending2faToken<R extends string>(
  token: string,
  config: AuthConfig<R>
): Promise<string | null> {
  const claims = await verifySignedToken<Pending2faClaims>(token, config.jwt.secret);
  if (!claims) return null;
  if (claims.pending2fa !== true) return null;
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null;
  return claims.sub;
}

// ---- TOTP option resolution -----------------------------------------------

export interface ResolvedTotpOptions {
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  window: number;
}

/** Resolve the TOTP parameters from config, applying the RFC-6238 defaults. */
export function resolveTotpOptions(config: TwoFactorConfig): ResolvedTotpOptions {
  return {
    algorithm: config.algorithm ?? 'SHA-1',
    digits: config.digits ?? 6,
    period: config.period ?? 30,
    window: config.window ?? 1
  };
}

/**
 * The issuer label embedded in the otpauth URI (what the authenticator app
 * shows as the account's provider). Defaults to the host of `appUrl`; falls back
 * to a stable literal if `appUrl` can't be parsed.
 */
export function resolveIssuer<R extends string>(config: AuthConfig<R>): string {
  if (config.twoFactor?.issuer) return config.twoFactor.issuer;
  try {
    return new URL(config.appUrl).host;
  } catch {
    return 'Urbicon';
  }
}

// ---- Backup codes ---------------------------------------------------------

/** Normalise a user-entered (or generated) backup code to its hashing form. */
function normalizeBackupCode(code: string): string {
  // Strip the readability separators/spaces and upper-case, so the stored hash
  // matches whether the user types `ABCD-EFGH` or `abcdefgh`.
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** SHA-256 hash of a backup code (after normalisation). Stored, never the plaintext. */
export function hashBackupCode(code: string): string {
  return hashToken(normalizeBackupCode(code));
}

/**
 * Generate a fresh batch of backup codes. Returns the **plaintext** (shown to
 * the user exactly once) and their SHA-256 `hashes` (the only thing persisted).
 * Each code is 80 bits of entropy (10 random bytes → 16 Base32 chars), grouped
 * `XXXX-XXXX-XXXX-XXXX` for legibility — high enough that the SHA-256 hashes are
 * not offline-brute-forceable even on a DB leak.
 */
export function generateBackupCodes(count = DEFAULT_BACKUP_CODE_COUNT): {
  plain: string[];
  hashes: string[];
} {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(randomBytes(10));
    const code = raw.match(/.{1,4}/g)?.join('-') ?? raw;
    plain.push(code);
    hashes.push(hashBackupCode(code));
  }
  return { plain, hashes };
}

export function resolveBackupCodeCount(config: TwoFactorConfig): number {
  return config.backupCodeCount ?? DEFAULT_BACKUP_CODE_COUNT;
}
