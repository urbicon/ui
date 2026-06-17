import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryRefreshTokenRepository } from '../adapters/in-memory-refresh-token.js';
import type { RefreshTokenRepository } from '../adapters/types.js';
import { hashToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { issueRefreshToken } from '../refresh-token.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import {
  createListSessionsHandler,
  createRevokeOtherSessionsHandler,
  createRevokeSessionHandler
} from './sessions.js';

const SESSION = { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 };

/** Deps wired with refresh-token rotation + the in-memory refresh repo. */
function setup() {
  const refreshToken = createInMemoryRefreshTokenRepository();
  const deps = createMockAuthDeps({
    config: { refreshToken: {} },
    user: { findById: vi.fn().mockResolvedValue(createMockUser({ id: 'user-1' })) },
    refreshToken
  });
  return { deps, refreshToken };
}

/** A signed-in event; optionally carrying a refresh cookie marking the current session. */
async function authed<R extends string>(deps: AuthDeps<R>, body: unknown, currentToken?: string) {
  const ev = mockPostEvent(body);
  await setSessionCookie(ev.cookies as unknown as Cookies, SESSION as never, deps.config.jwt);
  if (currentToken) ev.cookies.set('refresh', currentToken);
  return ev;
}

const revokedAt = async (repo: RefreshTokenRepository, token: string) =>
  (await repo.findByHash(hashToken(token)))?.revokedAt ?? null;

describe('createListSessionsHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const { deps } = setup();
    const res = await createListSessionsHandler(deps).GET(
      mockPostEvent({}) as unknown as RequestEvent
    );
    expect(res.status).toBe(401);
  });

  it('returns an empty list with available:false when refresh tokens are not configured', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser({ id: 'user-1' })) }
    });
    const ev = await authed(deps, {});
    const res = await createListSessionsHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [], available: false });
  });

  it('lists active sessions, flags the current one, and is uncacheable', async () => {
    const { deps, refreshToken } = setup();
    await issueRefreshToken(refreshToken, 'user-1', {}, { userAgent: 'UA-A' });
    const b = await issueRefreshToken(refreshToken, 'user-1', {}, { userAgent: 'UA-B' });
    const ev = await authed(deps, {}, b.token);

    const res = await createListSessionsHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const data = await res.json();
    expect(data.available).toBe(true);
    expect(data.sessions).toHaveLength(2);
    const current = data.sessions.find((s: { current: boolean }) => s.current);
    expect(current.id).toBe(b.record.family);
    expect(current.userAgent).toBe('UA-B');
    // Every other session is not current.
    expect(data.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
  });

  it('never lists another user’s sessions', async () => {
    const { deps, refreshToken } = setup();
    await issueRefreshToken(refreshToken, 'user-1', {});
    await issueRefreshToken(refreshToken, 'other-user', {});
    const ev = await authed(deps, {});

    const data = await (
      await createListSessionsHandler(deps).GET(ev as unknown as RequestEvent)
    ).json();
    expect(data.sessions).toHaveLength(1);
  });
});

describe('createRevokeSessionHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const { deps } = setup();
    const res = await createRevokeSessionHandler(deps).POST(
      mockPostEvent({ id: 'x' }) as unknown as RequestEvent
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when no session id is given', async () => {
    const { deps } = setup();
    const ev = await authed(deps, {});
    const res = await createRevokeSessionHandler(deps).POST(ev as unknown as RequestEvent);
    expect(res.status).toBe(400);
  });

  it('returns 404 and does not revoke another user’s session (IDOR)', async () => {
    const { deps, refreshToken } = setup();
    const other = await issueRefreshToken(refreshToken, 'other-user', {});
    const ev = await authed(deps, { id: other.record.family });

    const res = await createRevokeSessionHandler(deps).POST(ev as unknown as RequestEvent);
    expect(res.status).toBe(404);
    expect(await revokedAt(refreshToken, other.token), 'foreign token untouched').toBeNull();
  });

  it('revokes the caller’s own session', async () => {
    const { deps, refreshToken } = setup();
    const mine = await issueRefreshToken(refreshToken, 'user-1', {});
    const ev = await authed(deps, { id: mine.record.family });

    const res = await createRevokeSessionHandler(deps).POST(ev as unknown as RequestEvent);
    expect(res.status).toBe(200);
    expect(await revokedAt(refreshToken, mine.token)).toBeInstanceOf(Date);
  });
});

describe('createRevokeOtherSessionsHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const { deps } = setup();
    const res = await createRevokeOtherSessionsHandler(deps).POST(
      mockPostEvent({}) as unknown as RequestEvent
    );
    expect(res.status).toBe(401);
  });

  it('revokes every other session but keeps the current one', async () => {
    const { deps, refreshToken } = setup();
    const current = await issueRefreshToken(refreshToken, 'user-1', {});
    const other = await issueRefreshToken(refreshToken, 'user-1', {});
    const ev = await authed(deps, {}, current.token);

    const res = await createRevokeOtherSessionsHandler(deps).POST(ev as unknown as RequestEvent);
    expect(res.status).toBe(200);
    expect(await revokedAt(refreshToken, current.token), 'current kept').toBeNull();
    expect(await revokedAt(refreshToken, other.token), 'other revoked').toBeInstanceOf(Date);
  });
});
