import type { RequestHandler } from '@sveltejs/kit';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig, AuthUser } from '../../types.js';
import type { InvitationRepository, UserRepository } from '../adapters/types.js';
import type { AuthDeps } from '../deps.js';
import type { EmailTransport } from '../email/types.js';
import { createSessionToken } from '../jwt.js';
import { createMockAuthDeps, createMockInvitation, createMockUser } from '../test-utils.js';
import { createInvitationHandlers } from './invitation.js';

type Event = Parameters<RequestHandler>[0];

const ROLES = ['member', 'admin'];

function makeEvent(opts: {
  token?: string;
  body?: unknown;
  params?: Record<string, string>;
  method?: string;
}): Event {
  const store = new Map<string, string>();
  if (opts.token) store.set('session', opts.token);
  const hasBody = opts.body !== undefined;
  return {
    request: new Request('http://localhost/api/invitations', {
      method: opts.method ?? (hasBody ? 'POST' : 'GET'),
      ...(hasBody
        ? { body: JSON.stringify(opts.body), headers: { 'Content-Type': 'application/json' } }
        : {})
    }),
    cookies: {
      get: (n: string) => store.get(n),
      set: (n: string, v: string) => store.set(n, v),
      delete: (n: string) => store.delete(n),
      getAll: () => [],
      serialize: () => ''
    },
    url: new URL('http://localhost/api/invitations'),
    params: opts.params ?? {},
    locals: {},
    getClientAddress: () => '127.0.0.1'
  } as unknown as Event;
}

function setup(opts?: {
  user?: Partial<Parameters<typeof createMockUser>[0]>;
  authorize?: (u: AuthUser) => boolean | Promise<boolean>;
  invitation?: Partial<InvitationRepository>;
  userRepo?: Partial<UserRepository>;
  email?: EmailTransport;
  inviteEmail?: InvitationHandlerInviteEmail;
  hooks?: AuthConfig['hooks'];
  from?: string;
  invitationTtlMs?: number;
}) {
  const user = createMockUser(opts?.user ?? {});
  const deps = createMockAuthDeps({
    config: {
      ...(opts?.hooks ? { hooks: opts.hooks } : {}),
      ...(opts?.from ? { email: { from: opts.from } } : {})
    },
    user: {
      findById: vi.fn().mockResolvedValue(user),
      findByEmail: vi.fn().mockResolvedValue(null),
      ...opts?.userRepo
    },
    invitation: {
      list: vi.fn().mockResolvedValue([]),
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(createMockInvitation()),
      markEmailed: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      ...opts?.invitation
    },
    email: opts?.email
  });
  const handlers = createInvitationHandlers(deps, {
    authorize: opts?.authorize ?? ((u) => u.role === 'admin'),
    roles: ROLES,
    inviteEmail: opts?.inviteEmail,
    ...(opts?.invitationTtlMs === undefined ? {} : { invitationTtlMs: opts.invitationTtlMs })
  });
  return { deps, user, handlers };
}

type InvitationHandlerInviteEmail = Parameters<typeof createInvitationHandlers>[1]['inviteEmail'];

function tokenFor(deps: AuthDeps, user: ReturnType<typeof createMockUser>) {
  return createSessionToken(
    { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    deps.config.jwt
  );
}

describe('createInvitationHandlers — authorization', () => {
  it('GET returns 401 without a session', async () => {
    const { handlers } = setup();
    const res = await handlers.GET(makeEvent({}));
    expect(res.status).toBe(401);
  });

  it('GET returns 401 when the token version is stale', async () => {
    const { deps, user, handlers } = setup({ user: { tokenVersion: 5 } });
    // Token minted at version 0, but the stored user is now at version 5.
    const token = await createSessionToken(
      { userId: user.id, email: user.email, role: user.role, tokenVersion: 0 },
      deps.config.jwt
    );
    const res = await handlers.GET(makeEvent({ token }));
    expect(res.status).toBe(401);
  });

  it('GET returns 403 for an authenticated non-admin', async () => {
    const { deps, user, handlers } = setup({ user: { role: 'member' } });
    const res = await handlers.GET(makeEvent({ token: await tokenFor(deps, user) }));
    expect(res.status).toBe(403);
  });

  it('POST returns 403 for an authenticated non-admin', async () => {
    const { deps, user, handlers } = setup({ user: { role: 'member' } });
    const res = await handlers.POST(
      makeEvent({ token: await tokenFor(deps, user), body: { email: 'a@b.com', role: 'member' } })
    );
    expect(res.status).toBe(403);
    expect(deps.repos.invitation.create).not.toHaveBeenCalled();
  });

  it('fails closed when authorize throws (no mutation, no listing)', async () => {
    const { deps, user, handlers } = setup({
      authorize: () => {
        throw new Error('authz boom');
      }
    });
    await expect(handlers.GET(makeEvent({ token: await tokenFor(deps, user) }))).rejects.toThrow(
      'authz boom'
    );
    expect(deps.repos.invitation.list).not.toHaveBeenCalled();
  });
});

describe('createInvitationHandlers — GET', () => {
  it('lists invitations for an admin', async () => {
    const { deps, user, handlers } = setup({
      invitation: { list: vi.fn().mockResolvedValue([createMockInvitation({ id: 'inv-9' })]) }
    });
    const res = await handlers.GET(makeEvent({ token: await tokenFor(deps, user) }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invitations).toHaveLength(1);
    expect(data.invitations[0].id).toBe('inv-9');
  });

  it('marks the admin PII list no-store', async () => {
    const { deps, user, handlers } = setup();
    const res = await handlers.GET(makeEvent({ token: await tokenFor(deps, user) }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('createInvitationHandlers — POST', () => {
  it('rejects an invalid email with 400', async () => {
    const { deps, user, handlers } = setup();
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'not-an-email', role: 'member' }
      })
    );
    expect(res.status).toBe(400);
    expect(deps.repos.invitation.create).not.toHaveBeenCalled();
  });

  it('rejects a role outside the allow-list with 400 (privilege escalation guard)', async () => {
    const { deps, user, handlers } = setup();
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'superadmin' }
      })
    );
    expect(res.status).toBe(400);
    expect(deps.repos.invitation.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the email already has a user', async () => {
    const { deps, user, handlers } = setup({
      userRepo: { findByEmail: vi.fn().mockResolvedValue(createMockUser({ id: 'existing' })) }
    });
    const res = await handlers.POST(
      makeEvent({ token: await tokenFor(deps, user), body: { email: 'a@b.com', role: 'member' } })
    );
    expect(res.status).toBe(409);
    expect(deps.repos.invitation.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the email is already invited', async () => {
    const { deps, user, handlers } = setup({
      invitation: { findByEmail: vi.fn().mockResolvedValue(createMockInvitation()) }
    });
    const res = await handlers.POST(
      makeEvent({ token: await tokenFor(deps, user), body: { email: 'a@b.com', role: 'member' } })
    );
    expect(res.status).toBe(409);
    expect(deps.repos.invitation.create).not.toHaveBeenCalled();
  });

  it('creates the invitation with invitedById = caller and returns 201', async () => {
    const { deps, user, handlers } = setup();
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'New@B.com', role: 'member', sendEmail: false }
      })
    );
    expect(res.status).toBe(201);
    expect(deps.repos.invitation.create).toHaveBeenCalledWith({
      email: 'new@b.com', // normalized
      role: 'member',
      invitedById: user.id,
      // Hashed on the way in — the raw token exists only in the response below.
      tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      expiresAt: expect.any(Date)
    });
    const data = await res.json();
    expect(data.invitation).toBeDefined();
    expect(data.emailSent).toBe(false);
    // #68: without a mail transport this URL is the ONLY way the invitation
    // reaches anyone, so it has to come back even when nothing was sent.
    expect(data.inviteUrl).toContain('/auth/register?token=');
  });

  it('defaults the invitation to a 7-day life, and honours an override', async () => {
    const { deps, user, handlers } = setup();
    const before = Date.now();
    await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'ttl@b.com', role: 'member', sendEmail: false }
      })
    );
    const { expiresAt } = (deps.repos.invitation.create as Mock).mock.calls[0][0];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime() - before).toBeGreaterThan(sevenDays - 5000);
    expect(expiresAt.getTime() - before).toBeLessThan(sevenDays + 5000);

    const short = setup({ invitationTtlMs: 60_000 });
    await short.handlers.POST(
      makeEvent({
        token: await tokenFor(short.deps, short.user),
        body: { email: 'short@b.com', role: 'member', sendEmail: false }
      })
    );
    const shortExpiry = (short.deps.repos.invitation.create as Mock).mock.calls[0][0].expiresAt;
    expect(shortExpiry.getTime() - Date.now()).toBeLessThan(61_000);
  });

  it('withholds inviteUrl when the invitation was emailed', async () => {
    // The invitee holds the token; handing the admin a second copy would put the
    // credential in a second place for nothing — and an admin could redeem it as
    // the invitee, landing a pre-verified account under `autoVerifyInvited`.
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({ email: { send } });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'mailed@b.com', role: 'member', sendEmail: true }
      })
    );

    const data = await res.json();
    expect(data.emailSent).toBe(true);
    expect(data.inviteUrl).toBeUndefined();
    expect(data.invitation.emailedAt).not.toBeNull();
  });

  it('reports the truth when the mail went out but recording it failed', async () => {
    // `markEmailed` used to sit inside the send's try/catch, so a database
    // failure after a successful send was reported as "the email failed" — the
    // response claimed emailSent: true with emailedAt set, while the row said
    // null, and a resend queue on onInvitationEmailFailed would post a SECOND
    // mail carrying the same live token.
    const send = vi.fn().mockResolvedValue(undefined);
    const onInvitationEmailFailed = vi.fn();
    const { deps, user, handlers } = setup({
      email: { send },
      hooks: { onInvitationEmailFailed },
      invitation: { markEmailed: vi.fn().mockRejectedValue(new Error('deadlock')) }
    });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'halfway@b.com', role: 'member', sendEmail: true }
      })
    );

    const data = await res.json();
    expect(send, 'the mail did go out').toHaveBeenCalledTimes(1);
    expect(data.emailSent, 'and is reported as sent').toBe(true);
    // The delivery record is what failed, so THAT is what the response reflects.
    expect(data.invitation.emailedAt, 'but the record is missing').toBeNull();
    // Not a mail failure — the resend hook must not fire and mail it twice.
    expect(onInvitationEmailFailed).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('refuses a TTL that cannot bound anything', () => {
    // `Infinity` produced an Invalid Date, whose getTime() is NaN, and
    // `NaN <= Date.now()` is false — every invitation lived forever, silently.
    // Fail-open on the one value that bounds the credential's life.
    for (const bad of [Number.POSITIVE_INFINITY, Number.NaN, 0, -1]) {
      expect(() => setup({ invitationTtlMs: bad }), `ttl ${bad}`).toThrow(/invitationTtlMs/);
    }
  });

  it('records emailedAt only when the mail actually went out', async () => {
    // `emailedAt` is what lets `autoVerifyInvited` skip verification, so it has
    // to mean "the mail went out", not "we tried" (#149/#68).
    const failing = vi.fn().mockRejectedValue(new Error('smtp down'));
    const { deps, user, handlers } = setup({ email: { send: failing } });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'nomail@b.com', role: 'member', sendEmail: true }
      })
    );

    expect((await res.json()).emailSent).toBe(false);
    expect(deps.repos.invitation.markEmailed).not.toHaveBeenCalled();
  });

  it('sends the invite email when sendEmail is true', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({ email: { send } });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    expect(res.status).toBe(201);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'a@b.com' });
    expect((await res.json()).emailSent).toBe(true);
  });

  it('does not send an email when sendEmail is omitted/false', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({ email: { send } });
    const res = await handlers.POST(
      makeEvent({ token: await tokenFor(deps, user), body: { email: 'a@b.com', role: 'member' } })
    );
    expect(res.status).toBe(201);
    expect(send).not.toHaveBeenCalled();
    expect((await res.json()).emailSent).toBe(false);
  });

  it('still succeeds (emailSent:false) and logs when the invite email fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('smtp down'));
    const { deps, user, handlers } = setup({ email: { send } });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    // The durable effect (the invitation row) still committed.
    expect(deps.repos.invitation.create).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect((await res.json()).emailSent).toBe(false);
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('propagates a throwing inviteEmail builder instead of masking it as a send failure', async () => {
    const { deps, user, handlers } = setup({
      email: { send: vi.fn() },
      inviteEmail: () => {
        throw new Error('builder boom');
      }
    });
    await expect(
      handlers.POST(
        makeEvent({
          token: await tokenFor(deps, user),
          body: { email: 'a@b.com', role: 'member', sendEmail: true }
        })
      )
    ).rejects.toThrow('builder boom');
    // The durable row still committed before the (programming-error) throw.
    expect(deps.repos.invitation.create).toHaveBeenCalledTimes(1);
  });

  it('propagates a failing invitation.create rather than returning a misleading 201', async () => {
    const { deps, user, handlers } = setup({
      invitation: { create: vi.fn().mockRejectedValue(new Error('unique violation')) }
    });
    await expect(
      handlers.POST(
        makeEvent({ token: await tokenFor(deps, user), body: { email: 'a@b.com', role: 'member' } })
      )
    ).rejects.toThrow('unique violation');
  });

  it('reports a send failure to the onInvitationEmailFailed hook', async () => {
    const onInvitationEmailFailed = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockRejectedValue(new Error('smtp down'));
    const { deps, user, handlers } = setup({ email: { send }, hooks: { onInvitationEmailFailed } });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    expect(res.status).toBe(201);
    expect(onInvitationEmailFailed).toHaveBeenCalledWith('a@b.com', expect.any(Error));
  });

  it('survives a throwing onInvitationEmailFailed hook (still 201)', async () => {
    const { deps, user, handlers } = setup({
      email: { send: vi.fn().mockRejectedValue(new Error('smtp down')) },
      hooks: { onInvitationEmailFailed: vi.fn().mockRejectedValue(new Error('hook boom')) }
    });
    const res = await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).emailSent).toBe(false);
  });

  it('uses a custom inviteEmail builder when provided', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({
      email: { send },
      inviteEmail: ({ url }) => ({ subject: 'Custom invite', html: `<a href="${url}">join</a>` })
    });
    await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    expect(send.mock.calls[0][0]).toMatchObject({ subject: 'Custom invite' });
  });

  it('threads config.email.from into the invite email (Issue #17)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({ email: { send }, from: 'Acme <invite@acme.test>' });
    await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    expect(send.mock.calls[0][0].from).toBe('Acme <invite@acme.test>');
    // The builder also receives `from` so a custom template can reuse it.
  });

  it('lets a custom inviteEmail builder override config.email.from', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({
      email: { send },
      from: 'Acme <invite@acme.test>',
      inviteEmail: ({ url, from }) => ({
        subject: 'Custom',
        html: `<a href="${url}">join</a> (default from: ${from})`,
        from: 'Override <noreply@acme.test>'
      })
    });
    await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'a@b.com', role: 'member', sendEmail: true }
      })
    );
    expect(send.mock.calls[0][0].from).toBe('Override <noreply@acme.test>');
    // The default `from` was passed into the builder ctx.
    expect(send.mock.calls[0][0].html).toContain('Acme <invite@acme.test>');
  });

  it('builds the register link with the invitee email prefilled (?email=)', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { deps, user, handlers } = setup({ email: { send } });
    await handlers.POST(
      makeEvent({
        token: await tokenFor(deps, user),
        body: { email: 'Invitee@B.com', role: 'member', sendEmail: true }
      })
    );
    // Default template links to /auth/register?email=<normalized invitee>, the
    // param RegisterPage prefills from (Issue #14).
    // The link now leads with the one-time token — that IS the credential —
    // and keeps the email param RegisterPage prefills from (Issue #14). The
    // separator is `&amp;` because the template escapes for HTML.
    const html = send.mock.calls[0][0].html;
    expect(html).toMatch(/\/auth\/register\?token=[0-9a-f]+&(amp;)?email=invitee%40b\.com/);
  });
});

describe('createInvitationHandlers — DELETE', () => {
  it('returns 400 without an id param', async () => {
    const { deps, user, handlers } = setup();
    const res = await handlers.DELETE(
      makeEvent({ token: await tokenFor(deps, user), method: 'DELETE' })
    );
    expect(res.status).toBe(400);
    expect(deps.repos.invitation.delete).not.toHaveBeenCalled();
  });

  it('deletes by id for an admin', async () => {
    const { deps, user, handlers } = setup();
    const res = await handlers.DELETE(
      makeEvent({ token: await tokenFor(deps, user), method: 'DELETE', params: { id: 'inv-7' } })
    );
    expect(res.status).toBe(200);
    expect(deps.repos.invitation.delete).toHaveBeenCalledWith('inv-7');
  });

  it('returns 403 for a non-admin', async () => {
    const { deps, user, handlers } = setup({ user: { role: 'member' } });
    const res = await handlers.DELETE(
      makeEvent({ token: await tokenFor(deps, user), method: 'DELETE', params: { id: 'inv-7' } })
    );
    expect(res.status).toBe(403);
    expect(deps.repos.invitation.delete).not.toHaveBeenCalled();
  });
});
