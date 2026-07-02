import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { RefreshTokenRecord } from '../adapters/types.js';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { readRefreshCookie } from '../refresh-token.js';
import { readJsonBody } from '../validation.js';
import { NO_STORE, requireSessionUser } from './_shared.js';
import { authError } from './errors.js';

/**
 * A user-facing summary of one active session (one refresh-token family). The
 * raw token hash is never exposed; `id` is the opaque, user-scoped family UUID
 * used to revoke the session.
 */
export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ip: string | null;
  /** ISO timestamp of the live token in the family ≈ "last active". */
  lastActive: string;
  /** Whether this is the session making the current request. */
  current: boolean;
}

/** Resolve the family of the refresh token in the current request, or null. */
async function currentFamily<R extends string>(
  event: Pick<RequestEvent, 'cookies'>,
  deps: AuthDeps<R>
): Promise<string | null> {
  const { config, repos } = deps;
  if (!config.refreshToken || !repos.refreshToken) return null;
  const raw = readRefreshCookie(event.cookies, config.refreshToken);
  if (!raw) return null;
  const record = await repos.refreshToken.findByHash(hashToken(raw));
  return record?.family ?? null;
}

/**
 * GET — list the authenticated user's active sessions. Requires
 * `config.refreshToken` rotation (a session is a refresh-token family); without
 * it there is nothing server-side to list, so the response is an empty list
 * with `available: false`. The session of the current request is flagged
 * `current: true`.
 */
export function createListSessionsHandler<R extends string>(
  deps: AuthDeps<R>
): { GET: RequestHandler } {
  return {
    GET: async (event) => {
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return authError('not_authenticated', 401, { headers: NO_STORE });

      const repo = deps.repos.refreshToken;
      if (!deps.config.refreshToken || !repo) {
        return json({ sessions: [], available: false }, { headers: NO_STORE });
      }

      const current = await currentFamily(event, deps);
      const rows = await repo.listActiveByUser(user.id);

      // Collapse to one entry per family (rotation keeps one live token per
      // family, but a sub-second rotation window can momentarily expose two —
      // keep the newest, whose createdAt is "last active").
      const byFamily = new Map<string, RefreshTokenRecord>();
      for (const r of rows) {
        const prev = byFamily.get(r.family);
        if (!prev || r.createdAt.getTime() > prev.createdAt.getTime()) byFamily.set(r.family, r);
      }

      const sessions: SessionSummary[] = [...byFamily.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => ({
          id: r.family,
          userAgent: r.userAgent,
          ip: r.ip,
          lastActive: r.createdAt.toISOString(),
          current: r.family === current
        }));

      return json({ sessions, available: true }, { headers: NO_STORE });
    }
  };
}

/**
 * POST — revoke a single session by its family id (from `params.id` or the JSON
 * body `{ id }`). Ownership-scoped: revoking a family that isn't the caller's
 * returns 404 (an attacker knowing/guessing a family id can't sign out another
 * user — IDOR defense). Revoking the current session is allowed (remote
 * sign-out of this device).
 */
export function createRevokeSessionHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return authError('not_authenticated', 401);

      const repo = deps.repos.refreshToken;
      if (!deps.config.refreshToken || !repo) {
        return authError('feature_unavailable', 400, {
          message: 'Session management is not available.'
        });
      }

      const body = (await readJsonBody(event.request)) as { id?: unknown };
      const rawId: unknown = event.params?.id ?? body.id;
      if (typeof rawId !== 'string' || rawId.length === 0) {
        return authError('validation_error', 400, { message: 'A session id is required.' });
      }

      const revoked = await repo.revokeFamilyForUser(user.id, rawId);
      if (!revoked) return authError('session_not_found', 404);
      return json({ success: true });
    }
  };
}

/**
 * POST — revoke every session except the current one ("sign out all other
 * devices"). Scoped to the caller; the current family (resolved from the
 * request's refresh cookie) is kept signed in.
 */
export function createRevokeOtherSessionsHandler<R extends string>(
  deps: AuthDeps<R>
): { POST: RequestHandler } {
  return {
    POST: async (event) => {
      const user = await requireSessionUser(deps, event.cookies);
      if (!user) return authError('not_authenticated', 401);

      const repo = deps.repos.refreshToken;
      if (!deps.config.refreshToken || !repo) {
        return authError('feature_unavailable', 400, {
          message: 'Session management is not available.'
        });
      }

      // Keep the current family; '' keeps nothing if the request has no live
      // refresh cookie (then "all others" is effectively all).
      const keep = (await currentFamily(event, deps)) ?? '';
      await repo.revokeOtherFamiliesForUser(user.id, keep);
      return json({ success: true });
    }
  };
}
