import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { NotificationService } from '../service.js';
import { createNotificationsHandlers } from './notifications.js';

/**
 * The notification CRUD endpoints back `createNotificationStore`. Every verb
 * must scope to `locals.user.id` (set by the auth handle) — the id in the URL
 * alone must never reach another user's rows (IDOR guard), and the service is
 * the layer that enforces that scoping, so these tests assert the exact
 * (id, userId) arguments handed to it.
 */

function mockService(overrides: Partial<NotificationService> = {}): NotificationService {
  return {
    send: vi.fn(),
    getForUser: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUnreadCount: vi.fn().mockResolvedValue(0),
    deleteNotification: vi.fn(),
    ...overrides
  };
}

function event(opts: {
  user?: { id: string };
  params?: Record<string, string>;
  search?: string;
}): RequestEvent {
  return {
    url: new URL(`http://localhost/api/notifications${opts.search ?? ''}`),
    params: opts.params ?? {},
    locals: opts.user ? { user: opts.user } : {}
  } as unknown as RequestEvent;
}

describe('createNotificationsHandlers — list.GET', () => {
  it('returns 401 when unauthenticated', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).list.GET(event({}));
    expect(res.status).toBe(401);
    expect(service.getForUser).not.toHaveBeenCalled();
  });

  it('returns the notifications scoped to the session user', async () => {
    const rows = [{ id: 'n1', userId: 'owner-1', typeKey: 'security', title: 'New login' }];
    const service = mockService({ getForUser: vi.fn().mockResolvedValue(rows) });
    const res = await createNotificationsHandlers(service).list.GET(
      event({ user: { id: 'owner-1' } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifications: rows });
    expect(service.getForUser).toHaveBeenCalledWith('owner-1', {
      limit: undefined,
      unreadOnly: false
    });
  });

  it('passes limit and unreadOnly through, tolerating malformed limits', async () => {
    const service = mockService();
    const handlers = createNotificationsHandlers(service);

    await handlers.list.GET(event({ user: { id: 'u1' }, search: '?limit=25&unreadOnly=true' }));
    expect(service.getForUser).toHaveBeenLastCalledWith('u1', { limit: 25, unreadOnly: true });

    // A malformed or non-positive limit is a UI hint gone wrong, not a 400 —
    // it degrades to "no limit".
    await handlers.list.GET(event({ user: { id: 'u1' }, search: '?limit=banana' }));
    expect(service.getForUser).toHaveBeenLastCalledWith('u1', {
      limit: undefined,
      unreadOnly: false
    });
    await handlers.list.GET(event({ user: { id: 'u1' }, search: '?limit=-5' }));
    expect(service.getForUser).toHaveBeenLastCalledWith('u1', {
      limit: undefined,
      unreadOnly: false
    });
  });
});

describe('createNotificationsHandlers — read.POST', () => {
  it('returns 401 when unauthenticated', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).read.POST(
      event({ params: { id: 'n1' } })
    );
    expect(res.status).toBe(401);
    expect(service.markAsRead).not.toHaveBeenCalled();
  });

  it('returns 400 without an id param', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).read.POST(event({ user: { id: 'u1' } }));
    expect(res.status).toBe(400);
    expect(service.markAsRead).not.toHaveBeenCalled();
  });

  it('marks the notification read scoped to the session user', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).read.POST(
      event({ user: { id: 'owner-1' }, params: { id: 'n1' } })
    );
    expect(res.status).toBe(200);
    // (id, userId) order matters: the service scopes the mutation by owner.
    expect(service.markAsRead).toHaveBeenCalledWith('n1', 'owner-1');
  });
});

describe('createNotificationsHandlers — readAll.POST', () => {
  it('returns 401 when unauthenticated', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).readAll.POST(event({}));
    expect(res.status).toBe(401);
    expect(service.markAllAsRead).not.toHaveBeenCalled();
  });

  it('marks all read for the session user only', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).readAll.POST(
      event({ user: { id: 'owner-1' } })
    );
    expect(res.status).toBe(200);
    expect(service.markAllAsRead).toHaveBeenCalledWith('owner-1');
  });
});

describe('createNotificationsHandlers — item.DELETE', () => {
  it('returns 401 when unauthenticated', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).item.DELETE(
      event({ params: { id: 'n1' } })
    );
    expect(res.status).toBe(401);
    expect(service.deleteNotification).not.toHaveBeenCalled();
  });

  it('returns 400 without an id param', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).item.DELETE(
      event({ user: { id: 'u1' } })
    );
    expect(res.status).toBe(400);
    expect(service.deleteNotification).not.toHaveBeenCalled();
  });

  it('deletes scoped to the session user', async () => {
    const service = mockService();
    const res = await createNotificationsHandlers(service).item.DELETE(
      event({ user: { id: 'owner-1' }, params: { id: 'n1' } })
    );
    expect(res.status).toBe(200);
    expect(service.deleteNotification).toHaveBeenCalledWith('n1', 'owner-1');
  });
});

describe('locals shape contract (R5)', () => {
  it('rejects a transformUser-reshaped locals.user without a string id (401, no query)', async () => {
    // The documented failure mode: a consumer transformUser returning
    // { auth: user, tenant } used to flow user.id === undefined into
    // findByUserId — Prisma drops an undefined where-filter, so that read
    // could return ANOTHER user's rows. localsUserId fails closed instead.
    const service = mockService();
    const res = await createNotificationsHandlers(service).list.GET({
      url: new URL('http://localhost/api/notifications'),
      params: {},
      locals: { user: { name: 'reshaped', auth: { id: 'u-1' } } }
    } as unknown as Parameters<ReturnType<typeof createNotificationsHandlers>['list']['GET']>[0]);
    expect(res.status).toBe(401);
    expect(service.getForUser).not.toHaveBeenCalled();
  });
});
