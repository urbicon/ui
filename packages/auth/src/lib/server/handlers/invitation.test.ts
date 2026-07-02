import type { RequestHandler } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig, AuthUser } from '../../types.js';
import type { InvitationRepository, UserRepository } from '../adapters/types.js';
import { createSessionToken } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import type { EmailTransport } from '../email/types.js';
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
      delete: vi.fn().mockResolvedValue(undefined),
      ...opts?.invitation
    },
    email: opts?.email
  });
  const handlers = createInvitationHandlers(deps, {
    authorize: opts?.authorize ?? ((u) => u.role === 'admin'),
    roles: ROLES,
    inviteEmail: opts?.inviteEmail
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
      invitedById: user.id
    });
    const data = await res.json();
    expect(data.invitation).toBeDefined();
    expect(data.emailSent).toBe(false);
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
    expect(send.mock.calls[0][0].html).toContain('/auth/register?email=invitee%40b.com');
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
