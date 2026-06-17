import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createForgotPasswordHandler } from './forgot-password.js';

const event = (body: unknown) => mockPostEvent(body) as unknown as RequestEvent;

describe('createForgotPasswordHandler', () => {
  it('returns 400 on a malformed email', async () => {
    const deps = createMockAuthDeps();
    const res = await createForgotPasswordHandler(deps).POST(event({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns success and does nothing for an unknown email (no enumeration)', async () => {
    const send = vi.fn();
    const deps = createMockAuthDeps({
      user: { findByEmail: vi.fn().mockResolvedValue(null) },
      email: { send }
    });
    const res = await createForgotPasswordHandler(deps).POST(event({ email: 'ghost@test.com' }));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    // Drain microtasks AND the first macrotask, so a regression that schedules
    // any detached work on the unknown-email path would surface here.
    await new Promise((r) => setTimeout(r, 0));
    expect(send).not.toHaveBeenCalled();
    expect(deps.repos.user.setPasswordResetToken).not.toHaveBeenCalled();
  });

  it('returns success and issues a reset email for a known email', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      user: {
        findByEmail: vi
          .fn()
          .mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com', name: 'Aya' }))
      },
      email: { send }
    });

    const res = await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    // The reset work is detached from the response — wait for it to land.
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(deps.repos.user.setPasswordResetToken).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
      expect.any(Date)
    );
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe('aya@test.com');
    expect(mail.subject).toMatch(/reset/i);
    expect(mail.html).toContain('/auth/reset-password?token=');
  });

  it('returns success WITHOUT waiting for the email to send (decoupled timing)', async () => {
    // email.send never resolves; the handler must still respond — proving the
    // response time is independent of the (existing-user-only) send.
    let release!: () => void;
    const pending = new Promise<void>((r) => (release = r));
    const send = vi.fn().mockReturnValue(pending);
    const deps = createMockAuthDeps({
      user: { findByEmail: vi.fn().mockResolvedValue(createMockUser()) },
      email: { send }
    });

    const res = await createForgotPasswordHandler(deps).POST(event({ email: 'test@test.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    release(); // let the detached task settle so it doesn't leak across tests
  });

  it('invokes onPasswordResetFailed when the detached reset work fails (observability seam)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onPasswordResetFailed = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      config: { hooks: { onPasswordResetFailed } },
      user: {
        findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com' }))
      },
      email: { send: vi.fn().mockRejectedValue(new Error('smtp down')) }
    });

    const res = await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }));
    // Still a success response — the failure must not leak existence.
    expect(res.status).toBe(200);

    // The detached failure surfaces through the hook (not as an HTTP error).
    await vi.waitFor(() =>
      expect(onPasswordResetFailed).toHaveBeenCalledWith('aya@test.com', expect.any(Error))
    );
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('returns 429 once the password-reset rate limit is exceeded', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { passwordReset: { windowMs: 60_000, max: 1 } } },
      user: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const handler = createForgotPasswordHandler(deps);

    expect((await handler.POST(event({ email: 'a@test.com' }))).status).toBe(200);
    const limited = await handler.POST(event({ email: 'a@test.com' }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
