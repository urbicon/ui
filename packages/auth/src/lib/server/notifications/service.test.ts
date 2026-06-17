import { describe, expect, it, vi } from 'vitest';
import type {
  NotificationPreferenceRepository,
  NotificationRepository
} from '../adapters/types.js';
import { createNotificationRegistry } from './registry.js';
import { createNotificationService } from './service.js';
import { createSSEManager } from './sse.js';

function createMockNotificationRepo(): NotificationRepository {
  let idCounter = 0;
  return {
    create: vi.fn(async (data) => ({
      id: `n-${++idCounter}`,
      ...data,
      body: data.body ?? null,
      url: data.url ?? null,
      icon: data.icon ?? null,
      readAt: null,
      createdAt: new Date()
    })),
    findByUser: vi.fn(async () => []),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
    getUnreadCount: vi.fn(async () => 0)
  };
}

function createMockPrefRepo(): NotificationPreferenceRepository {
  return {
    findByUser: vi.fn(async () => []),
    upsert: vi.fn()
  };
}

describe('createNotificationService', () => {
  it('should send SSE notification to online users', async () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'test_event',
      title: 'Test Title',
      body: 'Test Body',
      recipients: ['user-1']
    });

    const sse = createSSEManager();
    const ctrl = {
      enqueue: vi.fn(),
      close: vi.fn(),
      error: vi.fn(),
      desiredSize: 1
    } as unknown as ReadableStreamDefaultController;
    sse.addConnection('user-1', ctrl);

    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await service.send('test_event', {});

    expect(notifRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        typeKey: 'test_event',
        title: 'Test Title',
        body: 'Test Body'
      })
    );
    expect(ctrl.enqueue).toHaveBeenCalled();
  });

  it('should resolve dynamic title/body/url', async () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'dynamic',
      title: (data) => `Hello ${data.name}`,
      body: (data) => `You got ${data.count} items`,
      url: (data) => `/items/${data.id}`,
      recipients: ['user-1']
    });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await service.send('dynamic', { name: 'Alice', count: 3, id: '42' });

    expect(notifRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello Alice',
        body: 'You got 3 items',
        url: '/items/42'
      })
    );
  });

  it('should throw for unknown notification type', async () => {
    const registry = createNotificationRegistry();
    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await expect(service.send('nonexistent', {})).rejects.toThrow('Unknown notification type');
  });

  it('should resolve recipients via async function', async () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'custom_recipients',
      title: 'Custom',
      recipients: async () => ['user-a', 'user-b']
    });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await service.send('custom_recipients', {});

    expect(notifRepo.create).toHaveBeenCalledTimes(2);
  });

  it("should throw for recipients: 'admins' when no resolver is wired", async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'admin_alert', title: 'Alert', recipients: 'admins' });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await expect(service.send('admin_alert', {})).rejects.toThrow('resolveAdminRecipients');
    // It must NOT silently deliver to nobody.
    expect(notifRepo.create).not.toHaveBeenCalled();
  });

  it("should resolve recipients: 'admins' via the resolver", async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'admin_alert', title: 'Alert', recipients: 'admins' });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const resolveAdminRecipients = vi.fn(async () => ['admin-1', 'admin-2']);
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo },
      resolveAdminRecipients
    });

    await service.send('admin_alert', {});

    expect(resolveAdminRecipients).toHaveBeenCalledOnce();
    expect(notifRepo.create).toHaveBeenCalledTimes(2);
    expect(notifRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1' }));
    expect(notifRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-2' }));
  });

  it('should respect notification preferences', async () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'pref_test',
      title: 'Pref',
      recipients: ['user-1'],
      channels: ['sse']
    });

    const sse = createSSEManager();
    const ctrl = {
      enqueue: vi.fn(),
      close: vi.fn(),
      error: vi.fn(),
      desiredSize: 1
    } as unknown as ReadableStreamDefaultController;
    sse.addConnection('user-1', ctrl);

    const notifRepo = createMockNotificationRepo();
    const prefRepo = createMockPrefRepo();
    // User disabled SSE for this type
    vi.mocked(prefRepo.findByUser).mockResolvedValue([
      { typeKey: 'pref_test', sse: false, push: true, email: true }
    ]);

    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo, notificationPreference: prefRepo }
    });

    await service.send('pref_test', {});

    // Notification is persisted but not sent via SSE
    expect(notifRepo.create).toHaveBeenCalled();
    expect(ctrl.enqueue).not.toHaveBeenCalled();
  });

  it('prunes expired push subscriptions and reports results via onPushResult', async () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'offline_push',
      title: 'Ping',
      recipients: ['user-1'],
      channels: ['push']
    });

    // user-1 has no SSE connection → offline → the push branch runs.
    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();

    const subs = [
      { endpoint: 'https://push.example.com/live', keys: { p256dh: 'a', auth: 'b' } },
      { endpoint: 'https://push.example.com/gone', keys: { p256dh: 'c', auth: 'd' } }
    ];
    const pushSubRepo = {
      findByUser: vi.fn(async () => subs),
      create: vi.fn(async () => {}),
      delete: vi.fn(async () => {})
    };

    const push = {
      sendPush: vi.fn(async () => [
        { endpoint: subs[0].endpoint, success: true, statusCode: 201 },
        { endpoint: subs[1].endpoint, success: false, statusCode: 410, expired: true }
      ]),
      cleanupExpired: vi.fn()
    };

    const onPushResult = vi.fn();

    const service = createNotificationService({
      registry,
      sse,
      push,
      repos: { notification: notifRepo, pushSubscription: pushSubRepo },
      onPushResult
    });

    await service.send('offline_push', {});

    // The 410 endpoint is pruned (scoped to the user); the live one is kept.
    expect(pushSubRepo.delete).toHaveBeenCalledWith('user-1', subs[1].endpoint);
    expect(pushSubRepo.delete).not.toHaveBeenCalledWith('user-1', subs[0].endpoint);
    // Delivery results are surfaced to the observability hook.
    expect(onPushResult).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([
        expect.objectContaining({ endpoint: subs[1].endpoint, expired: true })
      ])
    );
  });

  it('should markAsRead, markAllAsRead, getUnreadCount', async () => {
    const registry = createNotificationRegistry();
    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await service.markAsRead('n-1', 'user-1');
    expect(notifRepo.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');

    await service.markAllAsRead('user-1');
    expect(notifRepo.markAllAsRead).toHaveBeenCalledWith('user-1');

    await service.getUnreadCount('user-1');
    expect(notifRepo.getUnreadCount).toHaveBeenCalledWith('user-1');
  });
});
