import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createChangeEmailHandler } from './change-email.js';

async function authed<R extends string>(deps: AuthDeps<R>, body: unknown) {
  const ev = mockPostEvent(body);
  await setSessionCookie(
    ev.cookies as unknown as Cookies,
    { userId: 'user-1', email: 'old@test.com', role: 'admin' as R, tokenVersion: 0 },
    deps.config.jwt
  );
  return ev;
}

const run = (deps: AuthDeps<string>, ev: ReturnType<typeof mockPostEvent>) =>
  createChangeEmailHandler(deps).POST(ev as unknown as RequestEvent);

/** A re-authable user whose current password is 'current' and email 'old@test.com'. */
async function currentUser() {
  return createMockUser({
    id: 'user-1',
    email: 'old@test.com',
    name: 'Aya',
    passwordHash: await hashPassword('current')
  });
}

describe('createChangeEmailHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const deps = createMockAuthDeps();
    const res = await run(deps, mockPostEvent({ newEmail: 'new@test.com', currentPassword: 'x' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on a malformed new email', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser()) }
    });
    const res = await run(
      deps,
      await authed(deps, { newEmail: 'nope', currentPassword: 'current' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when the current password is wrong', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(await currentUser()) }
    });
    const ev = await authed(deps, { newEmail: 'new@test.com', currentPassword: 'WRONG' });

    const res = await run(deps, ev);
    expect(res.status).toBe(403);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.repos.user.setEmailChangeToken).not.toHaveBeenCalled();
  });

  it('issues the token + both mails and fires the hook on success', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const onEmailChangeRequested = vi.fn();
    const deps = createMockAuthDeps({
      config: { hooks: { onEmailChangeRequested } },
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        findByEmail: vi.fn().mockResolvedValue(null)
      },
      email: { send }
    });
    const ev = await authed(deps, { newEmail: 'new@test.com', currentPassword: 'current' });

    const res = await run(deps, ev);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(deps.repos.user.setEmailChangeToken).toHaveBeenCalledWith(
      'user-1',
      'new@test.com',
      expect.any(String),
      expect.any(Date)
    );
    // Confirmation to the NEW address with the verification link …
    const confirm = send.mock.calls.find((c) => c[0].to === 'new@test.com')![0];
    expect(confirm.html).toContain('/auth/verify-email-change?token=');
    // … and a notice to the OLD address.
    expect(send.mock.calls.some((c) => c[0].to === 'old@test.com')).toBe(true);
    expect(onEmailChangeRequested).toHaveBeenCalledWith('user-1', 'new@test.com');
  });

  it('is account-enumeration safe: a taken target still returns success but stages nothing', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        // The target address already belongs to someone else.
        findByEmail: vi
          .fn()
          .mockResolvedValue(createMockUser({ id: 'other', email: 'taken@test.com' }))
      },
      email: { send }
    });
    const ev = await authed(deps, { newEmail: 'taken@test.com', currentPassword: 'current' });

    const res = await run(deps, ev);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    // No token, no mail to the foreign address — the response leaked nothing.
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.repos.user.setEmailChangeToken).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('routes a decoupled failure to onEmailChangeFailed without leaking it to the user', async () => {
    const onEmailChangeFailed = vi.fn().mockResolvedValue(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = createMockAuthDeps({
      config: { hooks: { onEmailChangeFailed } },
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        findByEmail: vi.fn().mockResolvedValue(null)
      },
      email: { send: vi.fn().mockRejectedValue(new Error('smtp down')) }
    });
    const ev = await authed(deps, { newEmail: 'new@test.com', currentPassword: 'current' });

    const res = await run(deps, ev);
    // Still success — the decoupled failure must not reach the response.
    expect(res.status).toBe(200);

    await vi.waitFor(() =>
      expect(onEmailChangeFailed).toHaveBeenCalledWith('user-1', 'new@test.com', expect.any(Error))
    );
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('no-ops when the new email equals the current one', async () => {
    const send = vi.fn();
    const deps = createMockAuthDeps({
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        findByEmail: vi.fn().mockResolvedValue(null)
      },
      email: { send }
    });
    const ev = await authed(deps, { newEmail: 'old@test.com', currentPassword: 'current' });

    const res = await run(deps, ev);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.repos.user.setEmailChangeToken).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
