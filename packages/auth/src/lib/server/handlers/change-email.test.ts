import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthDeps } from '../deps.js';
import { hashPassword } from '../password.js';
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

  // #294: the confirmation window was an inline literal.
  it.each([
    { label: 'defaults to one hour', tokenTtl: undefined, ms: 60 * 60 * 1000 },
    {
      label: 'honours config.tokenTtl.emailChange',
      tokenTtl: { emailChange: '5m' },
      ms: 5 * 60_000
    }
  ])('$label', async ({ tokenTtl, ms }) => {
    const deps = createMockAuthDeps({
      config: tokenTtl ? { tokenTtl } : {},
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        findByEmail: vi.fn().mockResolvedValue(null)
      }
    });
    const ev = await authed(deps, { newEmail: 'new@test.com', currentPassword: 'current' });
    const before = Date.now();
    await run(deps, ev);

    await vi.waitFor(() => expect(deps.repos.user.setEmailChangeToken).toHaveBeenCalled());
    const expires: Date = vi.mocked(deps.repos.user.setEmailChangeToken).mock.calls[0][3];
    expect(expires.getTime() - before).toBeGreaterThanOrEqual(ms);
    expect(expires.getTime() - Date.now()).toBeLessThanOrEqual(ms);
  });

  it('rejects a malformed tokenTtl at wiring time, not inside the detached task', () => {
    const deps = createMockAuthDeps({ config: { tokenTtl: { emailChange: '60min' } } });
    expect(() => createChangeEmailHandler(deps)).toThrow(/Invalid duration format/);
  });

  it('both default mails ship a text part and localize via config.email.locale (Issue #15)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      config: { email: { locale: 'de', appName: 'Cookery' } },
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        findByEmail: vi.fn().mockResolvedValue(null)
      },
      email: { send }
    });
    const ev = await authed(deps, { newEmail: 'new@test.com', currentPassword: 'current' });
    await run(deps, ev);

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    for (const [mail] of send.mock.calls) {
      expect(typeof mail.text).toBe('string');
      expect(mail.text.length).toBeGreaterThan(0);
      expect(mail.subject).toContain('Cookery');
    }
    const notice = send.mock.calls.find((c) => c[0].to === 'old@test.com')![0];
    expect(notice.html).toContain('new@test.com'); // names the pending address
  });

  it('honours the verifyEmailChangeEmail + changeEmailEmail builder hooks (Issue #15)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      user: {
        findById: vi.fn().mockResolvedValue(await currentUser()),
        findByEmail: vi.fn().mockResolvedValue(null)
      },
      email: { send }
    });
    const ev = await authed(deps, { newEmail: 'new@test.com', currentPassword: 'current' });
    await createChangeEmailHandler(deps, {
      verifyEmailChangeEmail: ({ url }) => ({
        subject: 'Confirm please',
        html: `<a href="${url}">x</a>`,
        text: url
      }),
      changeEmailEmail: ({ newEmail }) => ({
        subject: 'Heads up',
        html: `changed to ${newEmail}`,
        text: `changed to ${newEmail}`
      })
    }).POST(ev as unknown as RequestEvent);

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    const confirm = send.mock.calls.find((c) => c[0].to === 'new@test.com')![0];
    const notice = send.mock.calls.find((c) => c[0].to === 'old@test.com')![0];
    expect(confirm.subject).toBe('Confirm please');
    expect(notice.subject).toBe('Heads up');
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
    expect(deps.logger.error).toHaveBeenCalled();
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
