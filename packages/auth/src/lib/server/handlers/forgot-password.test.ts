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

  // #294: the reset window was an inline literal — the one an operator is most
  // likely to have a compliance requirement about.
  it.each([
    { label: 'defaults to one hour', tokenTtl: undefined, ms: 60 * 60 * 1000 },
    {
      label: 'honours config.tokenTtl.passwordReset',
      tokenTtl: { passwordReset: '10m' },
      ms: 10 * 60_000
    }
  ])('$label', async ({ tokenTtl, ms }) => {
    const deps = createMockAuthDeps({
      config: tokenTtl ? { tokenTtl } : {},
      user: { findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1' })) }
    });
    const before = Date.now();
    await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }));

    await vi.waitFor(() => expect(deps.repos.user.setPasswordResetToken).toHaveBeenCalled());
    const expires: Date = vi.mocked(deps.repos.user.setPasswordResetToken).mock.calls[0][2];
    expect(expires.getTime() - before).toBeGreaterThanOrEqual(ms);
    expect(expires.getTime() - Date.now()).toBeLessThanOrEqual(ms);
  });

  it.each([
    { label: 'a malformed duration', value: '1 hour', message: /Invalid duration format/ },
    // Both of these parse. `'0h'` mails a link that is expired in the same
    // millisecond, and a window past the Date range stores an `Invalid Date`,
    // whose expiry no claim can compare against — the null-shaped hole that
    // makes a token immortal (see the adapter contract).
    { label: 'a zero window', value: '0h', message: /must name a window a token can live in/ },
    {
      label: 'a window beyond the Date range',
      value: '999999999d',
      message: /must name a window a token can live in/
    }
  ])('rejects $label at wiring time, not inside the detached task', ({ value, message }) => {
    const deps = createMockAuthDeps({ config: { tokenTtl: { passwordReset: value } } });
    expect(() => createForgotPasswordHandler(deps)).toThrow(message);
  });

  it('threads config.email.from into the reset email (Issue #17)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      config: { email: { from: 'Acme <auth@acme.test>' } },
      user: {
        findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com' }))
      },
      email: { send }
    });

    const res = await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }));
    expect(res.status).toBe(200);

    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0][0].from).toBe('Acme <auth@acme.test>');
  });

  it('sends with from:undefined when no sender is configured (transport default)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      user: {
        findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com' }))
      },
      email: { send }
    });

    await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }));
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0][0].from).toBeUndefined();
  });

  it('localizes the default reset mail and ships an html + text part (Issue #15)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      config: { email: { locale: 'de', appName: 'Cookery' } },
      user: {
        findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com' }))
      },
      email: { send }
    });

    await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }));
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());

    const mail = send.mock.calls[0][0];
    expect(mail.subject).toContain('Cookery');
    expect(mail.subject).toMatch(/zurück/i); // German "zurücksetzen"
    expect(mail.html).toContain('/auth/reset-password?token=');
    expect(typeof mail.text).toBe('string');
    expect(mail.text).toContain('/auth/reset-password?token=');
  });

  it('honours a resetEmail builder hook (Issue #15)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = createMockAuthDeps({
      user: {
        findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com' }))
      },
      email: { send }
    });
    const handler = createForgotPasswordHandler(deps, {
      resetEmail: ({ url }) => ({
        subject: 'Custom reset',
        html: `<a href="${url}">x</a>`,
        text: url
      })
    });

    await handler.POST(event({ email: 'aya@test.com' }));
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0][0].subject).toBe('Custom reset');
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
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('logs a throwing onPasswordResetFailed instead of leaving an unhandled rejection', async () => {
    const deps = createMockAuthDeps({
      config: {
        hooks: {
          onPasswordResetFailed: vi.fn().mockRejectedValue(new Error('consumer hook exploded'))
        }
      },
      user: {
        findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'u1', email: 'aya@test.com' }))
      },
      email: { send: vi.fn().mockRejectedValue(new Error('smtp down')) }
    });

    expect(
      (await createForgotPasswordHandler(deps).POST(event({ email: 'aya@test.com' }))).status
    ).toBe(200);

    // The hook runs detached from the response, so an uncaught throw would be
    // an unhandled rejection rather than a status the caller could see.
    await vi.waitFor(() =>
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('onPasswordResetFailed'),
        expect.any(Error)
      )
    );
  });

  it('returns 429 once the password-reset rate limit is exceeded', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { forgotPassword: { windowMs: 60_000, max: 1 } } },
      user: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const handler = createForgotPasswordHandler(deps);

    expect((await handler.POST(event({ email: 'a@test.com' }))).status).toBe(200);
    const limited = await handler.POST(event({ email: 'a@test.com' }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
