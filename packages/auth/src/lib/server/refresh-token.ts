import { randomUUID } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { AuthConfig, JwtConfig, RefreshTokenConfig } from '../types.js';
import type { FullAuthUser, RefreshTokenRecord, RefreshTokenRepository } from './adapters/types.js';
import { generateSecureToken, hashToken } from './auth.js';

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL = '30d';
const DEFAULT_COOKIE_NAME = 'refresh';
// Default to `/` so the handle hook can rotate transparently on any
// request. The cookie is httpOnly + secure + sameSite=lax, so same-origin
// scope is the right trade-off between scope-hardening and DX. Consumers
// can narrow to `/api/auth` via `cookiePath` — they then have to call
// `createRefreshHandler` explicitly instead of relying on the hook.
const DEFAULT_COOKIE_PATH = '/';

// Window in which a just-rotated predecessor is still accepted as "the
// loser of a concurrent rotation" instead of being flagged as a reuse. Real
// browsers fire parallel requests the moment the access cookie expires; two
// of them racing through the handle hook would otherwise revoke the whole
// family and log the user out.
const ROTATION_GRACE_MS = 10_000;

/**
 * Parse an `Ns | Nm | Nh | Nd` duration into seconds. Mirrors the grammar
 * used by `createSessionToken` in `auth.ts`.
 */
export function parseDurationSeconds(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${value}`);
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      throw new Error(`Unknown time unit: ${match[2]}`);
  }
}

/**
 * Resolve the effective JWT config when refresh-token rotation is opted in:
 * shortens the access-token TTL to `refreshToken.accessTokenTtl` (default 15m)
 * unless the caller has explicitly overridden `jwt.expiresIn`.
 */
export function resolveJwtConfig<R extends string>(config: AuthConfig<R>): JwtConfig {
  if (!config.refreshToken) return config.jwt;
  return {
    ...config.jwt,
    expiresIn: config.jwt.expiresIn ?? config.refreshToken.accessTokenTtl ?? DEFAULT_ACCESS_TTL
  };
}

function cookieOpts(config: RefreshTokenConfig, maxAge: number) {
  const sameSite = config.cookieSameSite ?? 'lax';
  const secure = config.cookieSecure ?? true;
  if (sameSite === 'none' && !secure) {
    throw new Error(
      '[auth] refresh cookieSameSite: "none" requires cookieSecure: true — browsers reject SameSite=None without Secure.'
    );
  }
  return {
    path: config.cookiePath ?? DEFAULT_COOKIE_PATH,
    httpOnly: true,
    secure,
    sameSite,
    maxAge
  } as const;
}

export function refreshCookieName(config: RefreshTokenConfig): string {
  return config.cookieName ?? DEFAULT_COOKIE_NAME;
}

/**
 * Optional per-session metadata captured at issue time and carried forward
 * across rotations — surfaced by the session-listing feature so a user can
 * tell their devices apart. `ip` is only populated when the consumer opts in
 * via `config.sessions.storeIp`.
 */
export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

/**
 * Issue a brand-new refresh token (new family). Called from login / register /
 * passkey-auth after the access-token cookie has been set. Returns the raw
 * token so callers can write it to the cookie themselves — the hash is the
 * only thing stored server-side. `meta` (user-agent / ip) is persisted on the
 * row for session listing and is backward-compatible — omit it for the prior
 * behaviour.
 */
export async function issueRefreshToken(
  repo: RefreshTokenRepository,
  userId: string,
  config: RefreshTokenConfig,
  meta?: SessionMeta
): Promise<{ token: string; record: RefreshTokenRecord }> {
  const token = generateSecureToken();
  const ttl = parseDurationSeconds(config.refreshTokenTtl ?? DEFAULT_REFRESH_TTL);
  const record = await repo.create({
    userId,
    tokenHash: hashToken(token),
    family: randomUUID(),
    expiresAt: new Date(Date.now() + ttl * 1000),
    userAgent: meta?.userAgent,
    ip: meta?.ip
  });
  return { token, record };
}

export function setRefreshCookie(
  cookies: Cookies,
  token: string,
  config: RefreshTokenConfig
): void {
  const ttl = parseDurationSeconds(config.refreshTokenTtl ?? DEFAULT_REFRESH_TTL);
  cookies.set(refreshCookieName(config), token, cookieOpts(config, ttl));
}

export function clearRefreshCookie(cookies: Cookies, config: RefreshTokenConfig): void {
  cookies.delete(refreshCookieName(config), { path: config.cookiePath ?? DEFAULT_COOKIE_PATH });
}

export function readRefreshCookie(cookies: Cookies, config: RefreshTokenConfig): string | null {
  return cookies.get(refreshCookieName(config)) ?? null;
}

export type RotateOutcome =
  | { kind: 'rotated'; user: FullAuthUser; token: string; record: RefreshTokenRecord }
  | { kind: 'race_ok'; user: FullAuthUser }
  | { kind: 'reused'; userId: string }
  | { kind: 'expired' }
  | { kind: 'revoked' }
  | { kind: 'not_found' };

/**
 * Validate a refresh token and — if it's the current one in its family —
 * rotate it. Any of the following invalidate the attempt:
 *
 *   - token not found                           → `not_found`
 *   - token already revoked, outside grace      → `reused` (full family is revoked)
 *   - token already revoked, inside grace + has successor → `race_ok` (concurrent rotation)
 *   - token past `expiresAt`                    → `expired`
 *
 * On success the old token is marked revoked with `replacedById` pointing at
 * the newly-issued successor, and both the raw token and its DB record are
 * returned so the caller can set the new cookie.
 *
 * Callers are responsible for (a) reading the user with `findUserById` and
 * passing it in, (b) clearing the cookie on any failure outcome, and (c)
 * setting the new cookie on `rotated`. On `race_ok`, callers should re-issue
 * the access token but leave the refresh cookie untouched — the winner of
 * the race has already written the successor cookie to the same browser jar.
 */
export async function rotateRefreshToken(
  repo: RefreshTokenRepository,
  rawToken: string,
  findUser: (userId: string) => Promise<FullAuthUser | null>,
  config: RefreshTokenConfig
): Promise<RotateOutcome> {
  const tokenHash = hashToken(rawToken);
  const existing = await repo.findByHash(tokenHash);
  if (!existing) return { kind: 'not_found' };

  if (existing.revokedAt) {
    // Concurrent-rotation grace: a real browser fires parallel requests the
    // moment the access cookie expires. The winner rotates; the loser reads
    // the predecessor as revoked-with-replacedById. If the revoke is within
    // the grace window we treat it as a race, not a replay.
    const age = Date.now() - existing.revokedAt.getTime();
    if (existing.replacedById && age <= ROTATION_GRACE_MS) {
      const user = await findUser(existing.userId);
      if (!user) return { kind: 'revoked' };
      return { kind: 'race_ok', user };
    }
    // Outside grace: genuine reuse → compromise the entire family.
    await repo.revokeFamily(existing.family);
    return { kind: 'reused', userId: existing.userId };
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    await repo.revoke(existing.id);
    return { kind: 'expired' };
  }

  const user = await findUser(existing.userId);
  if (!user) {
    await repo.revoke(existing.id);
    return { kind: 'revoked' };
  }

  const successorToken = generateSecureToken();
  const ttl = parseDurationSeconds(config.refreshTokenTtl ?? DEFAULT_REFRESH_TTL);
  const successor = await repo.create({
    userId: existing.userId,
    tokenHash: hashToken(successorToken),
    family: existing.family,
    expiresAt: new Date(Date.now() + ttl * 1000),
    // Carry the device metadata across rotation so the session keeps its
    // identity (the live row in a family is what the session list shows).
    userAgent: existing.userAgent ?? undefined,
    ip: existing.ip ?? undefined
  });

  let won: boolean;
  try {
    // CAS revoke of the predecessor: succeeds only while it is still live.
    // Two concurrent first-rotations of the same token both reach here, each
    // having created a successor — but exactly one `revoke` returns true.
    won = await repo.revoke(existing.id, successor.id);
  } catch (err) {
    // Revoke threw (store error). A live successor with a non-revoked
    // predecessor would leave the family with two live tokens — a zombie that
    // defeats reuse-detection. Best-effort rollback: revoke the just-created
    // successor so the family is only the original (still-live) token. The
    // caller will see this as an error and retry.
    try {
      await repo.revoke(successor.id);
    } catch {
      // Both the predecessor-revoke AND the successor-rollback failed. We can
      // no longer guarantee a single live token, so fail safe: burn the whole
      // family. A defeated reuse-detection (two live tokens) is worse than
      // forcing this device to re-authenticate. If even this throws, there's
      // nothing more we can do — surface the original error regardless.
      await repo.revokeFamily(existing.family).catch(() => {});
    }
    throw err;
  }

  if (!won) {
    // Lost the rotation race: a concurrent request already revoked the
    // predecessor and wrote the real successor cookie to the browser jar.
    // Roll back our orphan successor so only one live token remains, then
    // report a race — the caller reissues just the access token and leaves
    // the refresh cookie alone (the winner's value stands).
    await repo.revoke(successor.id).catch(() => {});
    return { kind: 'race_ok', user };
  }

  return { kind: 'rotated', user, token: successorToken, record: successor };
}

/**
 * Revoke the refresh token sitting in the request cookie (if any). Used by
 * logout to invalidate the current device's token without touching other
 * active sessions. No-ops when the cookie is absent or the DB row is missing.
 *
 * Replay of an already-revoked token at `/logout` is treated the same as at
 * the rotation path: the whole family is revoked (someone with a stolen copy
 * is presenting it, the stolen-token threat model applies).
 */
export async function revokeRefreshFromCookie(
  cookies: Cookies,
  repo: RefreshTokenRepository,
  config: RefreshTokenConfig
): Promise<void> {
  const raw = readRefreshCookie(cookies, config);
  if (!raw) return;
  const record = await repo.findByHash(hashToken(raw));
  if (!record) return;
  if (record.revokedAt) {
    await repo.revokeFamily(record.family);
    return;
  }
  await repo.revoke(record.id);
}
