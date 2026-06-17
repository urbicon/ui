import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthDeps } from '../deps.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createUpdateProfileHandler } from './update-profile.js';

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
  createUpdateProfileHandler(deps).POST(ev as unknown as RequestEvent);

describe('createUpdateProfileHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const deps = createMockAuthDeps();
    const res = await run(deps, mockPostEvent({ name: 'New Name' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when the name is empty', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser()) }
    });
    const res = await run(deps, await authed(deps, { name: '   ' }));
    expect(res.status).toBe(400);
  });

  it('updates the name and returns the refreshed sanitized user (no password hash)', async () => {
    const user = createMockUser({ id: 'user-1', name: 'Old Name', passwordHash: 'secret' });
    const deps = createMockAuthDeps({ user: { findById: vi.fn().mockResolvedValue(user) } });
    const ev = await authed(deps, { name: '  New Name  ' });

    const res = await run(deps, ev);
    expect(res.status).toBe(200);
    // Trimmed before persisting.
    expect(deps.repos.user.updateProfile).toHaveBeenCalledWith('user-1', { name: 'New Name' });
    const data = await res.json();
    expect(data.user.name).toBe('New Name');
    expect(data.user).not.toHaveProperty('passwordHash');
  });
});
