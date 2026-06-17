import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../types.js';
import type { AuthDeps } from '../deps.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createMeHandler } from './me.js';

/**
 * `me` is the session-introspection endpoint and the second half of the
 * server-side invalidation mechanism: even a cryptographically valid access
 * cookie is refused once its `tokenVersion` no longer matches the row (the
 * other half — the actual bump — lives in `incrementTokenVersion`, exercised by
 * the reset-password handler). These were the previously untested paths flagged
 * in the auth-hardening audit (Cluster J).
 */

const event = () => mockPostEvent({});

/** Mint a valid access cookie into the event's jar, keyed to `deps.config.jwt`. */
async function signIn<R extends string>(
  ev: ReturnType<typeof mockPostEvent>,
  deps: AuthDeps<R>,
  session: AuthSession<R>
): Promise<void> {
  await setSessionCookie(ev.cookies as unknown as Cookies, session, deps.config.jwt);
}

describe('createMeHandler', () => {
  it('returns 401 and a null user when no session cookie is present', async () => {
    const deps = createMockAuthDeps();
    const ev = event();

    const res = await createMeHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ user: null });
    // No cookie → the user table is never consulted.
    expect(deps.repos.user.findById).not.toHaveBeenCalled();
  });

  it('returns 401 when the cookie is valid but the user no longer exists', async () => {
    const deps = createMockAuthDeps({ user: { findById: vi.fn().mockResolvedValue(null) } });
    const ev = event();
    await signIn(ev, deps, {
      userId: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      tokenVersion: 0
    });

    const res = await createMeHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ user: null });
  });

  it('returns 401 when the token version is stale (server-side invalidation)', async () => {
    // The cookie was minted at version 0; the row has since advanced to 1
    // (e.g. a password reset or "log out everywhere"). The still-valid JWT must
    // be refused — this is the regression guard for the invalidation check.
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 })) }
    });
    const ev = event();
    await signIn(ev, deps, {
      userId: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      tokenVersion: 0
    });

    const res = await createMeHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ user: null });
  });

  it('returns 401 when the cookie version is AHEAD of the row (exact-match, not directional)', async () => {
    // Pin the check to strict inequality: a cookie minted at v2 against a row at
    // v1 must also be refused. With the stale case above (cookie behind row),
    // this pair rules out a one-directional (`>`/`<`) comparison that would let
    // a mismatched token through in one direction.
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 })) }
    });
    const ev = event();
    await signIn(ev, deps, {
      userId: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      tokenVersion: 2
    });

    const res = await createMeHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ user: null });
  });

  it('returns 200 with the sanitized user when the session is valid and current', async () => {
    const deps = createMockAuthDeps({
      user: {
        findById: vi
          .fn()
          .mockResolvedValue(createMockUser({ passwordHash: 'super-secret-hash', tokenVersion: 3 }))
      }
    });
    const ev = event();
    await signIn(ev, deps, {
      userId: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      tokenVersion: 3
    });

    const res = await createMeHandler(deps).GET(ev as unknown as RequestEvent);
    expect(res.status).toBe(200);
    // A shared cache must never store/replay this authenticated identity.
    expect(res.headers.get('cache-control')).toBe('no-store');
    const data = await res.json();
    expect(data.user.id).toBe('user-1');
    expect(data.user.email).toBe('test@test.com');
    // The allowlist must never let the password hash reach the client.
    expect(data.user).not.toHaveProperty('passwordHash');
    expect(deps.repos.user.findById).toHaveBeenCalledWith('user-1');
  });

  it('marks the 401 (no session) response uncacheable too', async () => {
    const deps = createMockAuthDeps();
    const res = await createMeHandler(deps).GET(event() as unknown as RequestEvent);
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
