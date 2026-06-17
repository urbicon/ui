import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createDeleteAccountHandler } from './delete-account.js';

async function authed<R extends string>(deps: AuthDeps<R>, body: unknown) {
  const ev = mockPostEvent(body);
  await setSessionCookie(
    ev.cookies as unknown as Cookies,
    { userId: 'user-1', email: 'test@test.com', role: 'admin' as R, tokenVersion: 0 },
    deps.config.jwt
  );
  return ev;
}

const run = (deps: AuthDeps<string>, ev: ReturnType<typeof mockPostEvent>) =>
  createDeleteAccountHandler(deps).POST(ev as unknown as RequestEvent);

async function reauthableUser() {
  return createMockUser({ id: 'user-1', passwordHash: await hashPassword('current') });
}

describe('createDeleteAccountHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const deps = createMockAuthDeps();
    const res = await run(deps, mockPostEvent({ currentPassword: 'current' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when the current password is missing', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser()) }
    });
    const res = await run(deps, await authed(deps, {}));
    expect(res.status).toBe(400);
  });

  it('returns 403 and does not delete when the current password is wrong', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(await reauthableUser()) }
    });
    const res = await run(deps, await authed(deps, { currentPassword: 'WRONG' }));
    expect(res.status).toBe(403);
    expect(deps.repos.user.delete).not.toHaveBeenCalled();
  });

  it('archives via the hook, deletes the user and clears the session cookie', async () => {
    const order: string[] = [];
    const onAccountDeleted = vi.fn(async () => void order.push('hook'));
    const user = await reauthableUser();
    const deps = createMockAuthDeps({
      config: { hooks: { onAccountDeleted } },
      user: { findById: vi.fn().mockResolvedValue(user) }
    });
    (deps.repos.user.delete as ReturnType<typeof vi.fn>).mockImplementation(
      async () => void order.push('delete')
    );
    const ev = await authed(deps, { currentPassword: 'current' });

    const res = await run(deps, ev);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    // The hook runs BEFORE the row is removed (archive-then-erase), with the
    // sanitized user (no password hash).
    expect(order).toEqual(['hook', 'delete']);
    expect(onAccountDeleted).toHaveBeenCalledWith(
      expect.not.objectContaining({ passwordHash: expect.anything() })
    );
    expect(deps.repos.user.delete).toHaveBeenCalledWith('user-1');
    // This device is signed out.
    expect(ev._cookieStore.get('session')).toBeUndefined();
  });

  it('aborts the deletion (fail-closed) when the archive hook throws', async () => {
    const deps = createMockAuthDeps({
      config: { hooks: { onAccountDeleted: vi.fn().mockRejectedValue(new Error('archive down')) } },
      user: { findById: vi.fn().mockResolvedValue(await reauthableUser()) }
    });
    const ev = await authed(deps, { currentPassword: 'current' });

    await expect(run(deps, ev)).rejects.toThrow('archive down');
    expect(deps.repos.user.delete).not.toHaveBeenCalled();
  });
});
