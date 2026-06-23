import type { RequestEvent } from '@sveltejs/kit';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../../types.js';
import type { EmailTransport } from '../email/types.js';
import {
  createMockAuthDeps,
  createMockInvitation,
  createMockUser,
  mockPostEvent
} from '../test-utils.js';
import { createRegisterHandler } from './register.js';

const event = (body: unknown) => mockPostEvent(body) as unknown as RequestEvent;
const validBody = { email: 'new@test.com', name: 'New User', password: 'a-good-password' };

describe('createRegisterHandler', () => {
  it('returns 400 on invalid input', async () => {
    const deps = createMockAuthDeps();
    const res = await createRegisterHandler(deps).POST(event({ email: 'x' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the password is too weak', async () => {
    const deps = createMockAuthDeps({ config: { password: { minLength: 12 } } });
    const res = await createRegisterHandler(deps).POST(event({ ...validBody, password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 without an invitation', async () => {
    const deps = createMockAuthDeps({
      invitation: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const res = await createRegisterHandler(deps).POST(event(validBody));
    expect(res.status).toBe(403);
    // Carries BOTH the English prose (back-compat) and a machine code (Issue #18).
    const body = await res.json();
    expect(body.error).toBe('An invitation is required to register.');
    expect(body.code).toBe('invitation_required');
  });

  it('returns 403 when the invitation is already used', async () => {
    const deps = createMockAuthDeps({
      invitation: {
        findByEmail: vi.fn().mockResolvedValue(createMockInvitation({ usedAt: new Date() }))
      }
    });
    const res = await createRegisterHandler(deps).POST(event(validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('invitation_used');
  });

  it('returns 409 when the email is already registered', async () => {
    const deps = createMockAuthDeps({
      user: { findByEmail: vi.fn().mockResolvedValue(createMockUser()) },
      invitation: { findByEmail: vi.fn().mockResolvedValue(createMockInvitation()) }
    });
    const res = await createRegisterHandler(deps).POST(event(validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('email_taken');
    // Must not consume the invitation when rejecting an existing email.
    expect(deps.repos.invitation.markUsedIfUnused).not.toHaveBeenCalled();
  });

  // Cluster G.2 (Finding M2): registration is invitation-gated, and that gate
  // IS the enumeration defense — a non-invited request gets the SAME 403
  // whether or not the email is already registered, so status never leaks to
  // an attacker who doesn't already hold an admin-minted invitation.
  it('does not leak registration status to a non-invited request', async () => {
    const unregistered = createMockAuthDeps({
      invitation: { findByEmail: vi.fn().mockResolvedValue(null) },
      user: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const registered = createMockAuthDeps({
      invitation: { findByEmail: vi.fn().mockResolvedValue(null) },
      user: { findByEmail: vi.fn().mockResolvedValue(createMockUser()) }
    });

    const r1 = await createRegisterHandler(unregistered).POST(event(validBody));
    const r2 = await createRegisterHandler(registered).POST(event(validBody));

    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
    expect(await r1.json()).toEqual(await r2.json());
    // The gate short-circuits before the user table is ever consulted.
    expect(registered.repos.user.findByEmail).not.toHaveBeenCalled();
  });

  it('does not burn the invitation when user creation fails (Issue 1)', async () => {
    const deps = createMockAuthDeps({
      user: {
        findByEmail: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new Error('unique constraint violation'))
      },
      invitation: { findByEmail: vi.fn().mockResolvedValue(createMockInvitation()) }
    });
    // The create throws; the handler propagates it (→ 500 at the framework
    // level). The point is the invitation must NOT have been consumed.
    await expect(createRegisterHandler(deps).POST(event(validBody))).rejects.toThrow();
    expect(deps.repos.invitation.markUsedIfUnused).not.toHaveBeenCalled();
  });

  it('completes with a warning if the invitation was consumed concurrently after create', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const findByEmail = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createMockUser({ id: 'u-new' }));
    const deps = createMockAuthDeps({
      user: {
        findByEmail,
        create: vi.fn().mockResolvedValue({
          id: 'u-new',
          email: 'new@test.com',
          name: 'New User',
          role: 'admin',
          emailVerified: false
        })
      },
      invitation: {
        findByEmail: vi.fn().mockResolvedValue(createMockInvitation()),
        markUsedIfUnused: vi.fn().mockResolvedValue(false)
      }
    });
    const res = await createRegisterHandler(deps).POST(event(validBody));
    // The account already exists, so the request succeeds, but the anomaly is
    // surfaced loudly.
    expect(res.status).toBe(201);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('claims the invitation and creates the user on success', async () => {
    const onUserCreated = vi.fn();
    const findByEmail = vi
      .fn()
      .mockResolvedValueOnce(null) // existing-user check
      .mockResolvedValueOnce(createMockUser({ id: 'u-new', email: 'new@test.com' })); // re-read
    const deps = createMockAuthDeps({
      config: { hooks: { onUserCreated } },
      user: {
        findByEmail,
        create: vi.fn().mockResolvedValue({
          id: 'u-new',
          email: 'new@test.com',
          name: 'New User',
          role: 'admin',
          emailVerified: false
        })
      },
      invitation: { findByEmail: vi.fn().mockResolvedValue(createMockInvitation()) }
    });

    const res = await createRegisterHandler(deps).POST(event(validBody));

    expect(res.status).toBe(201);
    expect(deps.repos.invitation.markUsedIfUnused).toHaveBeenCalledWith('inv-1');
    expect(deps.repos.user.create).toHaveBeenCalledTimes(1);
    expect(deps.email.send).toHaveBeenCalledTimes(1);
    expect(onUserCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-new' }));
    const data = await res.json();
    expect(data.user).not.toHaveProperty('passwordHash');
  });

  it('returns 500 if the user vanishes between create and re-read', async () => {
    const deps = createMockAuthDeps({
      user: {
        findByEmail: vi.fn().mockResolvedValue(null), // existing check AND re-read both null
        create: vi.fn().mockResolvedValue({
          id: 'u-new',
          email: 'new@test.com',
          name: 'New User',
          role: 'admin',
          emailVerified: false
        })
      },
      invitation: { findByEmail: vi.fn().mockResolvedValue(createMockInvitation()) }
    });
    const res = await createRegisterHandler(deps).POST(event(validBody));
    expect(res.status).toBe(500);
  });

  // Cluster J: each handler must read its OWN rate-limit key. A typo (e.g.
  // wiring register to the wrong slice) would silently disable the limit, so we
  // assert the `register` key specifically activates it.
  it('returns 429 with a Retry-After header once the register rate limit is exceeded', async () => {
    const deps = createMockAuthDeps({
      config: { rateLimit: { register: { windowMs: 60_000, max: 1 } } },
      invitation: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const handler = createRegisterHandler(deps);
    // The first request spends the per-IP budget (its 403 outcome is irrelevant
    // — the limiter runs before any handler logic); the second is refused.
    await handler.POST(event(validBody));
    const limited = await handler.POST(event(validBody));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  // --- Issue #15: localized default verification mail + builder hook ---

  // Deps wired for a successful registration (so the verification mail is sent).
  function successDeps(send: Mock, config?: Partial<AuthConfig>) {
    return createMockAuthDeps({
      config,
      user: {
        findByEmail: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createMockUser({ id: 'u-new', email: 'new@test.com' })),
        create: vi.fn().mockResolvedValue(createMockUser({ id: 'u-new', email: 'new@test.com' }))
      },
      invitation: { findByEmail: vi.fn().mockResolvedValue(createMockInvitation()) },
      email: { send: send as unknown as EmailTransport['send'] }
    });
  }

  it('sends a localized verification mail with an html + text part by default', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = successDeps(send, { email: { locale: 'de', appName: 'Cookery' } });
    await createRegisterHandler(deps).POST(event(validBody));

    const mail = send.mock.calls[0][0];
    expect(mail.subject).toContain('Cookery');
    expect(mail.subject).toMatch(/Bestätige/); // German default
    expect(mail.html).toContain('/auth/verify-email?token=');
    expect(typeof mail.text).toBe('string');
    expect(mail.text.length).toBeGreaterThan(0);
  });

  it('honours a verificationEmail builder hook (overriding the default)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const deps = successDeps(send);
    const handler = createRegisterHandler(deps, {
      verificationEmail: ({ url, appName }) => ({
        subject: 'Custom verify',
        html: `<a href="${url}">go</a>`,
        text: `go ${url} (${appName})`
      })
    });
    await handler.POST(event(validBody));

    const mail = send.mock.calls[0][0];
    expect(mail.subject).toBe('Custom verify');
    expect(mail.html).toContain('/auth/verify-email?token=');
  });
});
