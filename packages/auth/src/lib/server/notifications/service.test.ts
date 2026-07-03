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

  it("resolves recipients: 'online' to the users connected right now — and nobody else", async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'broadcast', title: 'Hi', recipients: 'online' });

    const sse = createSSEManager();
    const ctrl = () =>
      ({
        enqueue: vi.fn(),
        close: vi.fn(),
        error: vi.fn()
      }) as unknown as ReadableStreamDefaultController;
    sse.addConnection('user-1', ctrl());
    sse.addConnection('user-2', ctrl());
    // user-3 exists but is offline → per the presence-based contract they get
    // nothing: no DB row, no push.

    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await service.send('broadcast', {});

    expect(notifRepo.create).toHaveBeenCalledTimes(2);
    expect(notifRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(notifRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }));
  });

  it("throws a migration error for the renamed recipients: 'all' (backstop for third-party registries)", async () => {
    // The built-in registry already rejects 'all' at register() time; this
    // pins the send()-side backstop for consumers who implement the
    // NotificationRegistry interface themselves.
    const legacyType = {
      key: 'legacy',
      title: 'Legacy',
      recipients: 'all' as unknown as 'online'
    };
    const registry = {
      register: () => {},
      get: () => legacyType,
      list: () => [legacyType]
    };

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo }
    });

    await expect(service.send('legacy', {})).rejects.toThrow("renamed to 'online'");
    expect(notifRepo.create).not.toHaveBeenCalled();
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
      create: vi.fn(async () => 'created' as const),
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

  it('logs per-endpoint delivery failures by default — the common failure mode must not need the optional hook', async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'p', title: 'Hi', recipients: ['user-1'], channels: ['push'] });

    const sse = createSSEManager(); // offline → push branch
    const notifRepo = createMockNotificationRepo();
    const pushSubRepo = {
      findByUser: vi.fn(async () => [
        { endpoint: 'https://push.example.com/ok', keys: { p256dh: 'a', auth: 'b' } },
        { endpoint: 'https://push.example.com/forbidden', keys: { p256dh: 'c', auth: 'd' } }
      ]),
      create: vi.fn(async () => 'created' as const),
      delete: vi.fn(async () => {})
    };
    // sendPush isolates per-endpoint failures into results — a VAPID
    // misconfig shows up as a 403 on every send, forever.
    const push = {
      sendPush: vi.fn(async () => [
        { endpoint: 'https://push.example.com/ok', success: true, statusCode: 201 },
        { endpoint: 'https://push.example.com/forbidden', success: false, statusCode: 403 }
      ]),
      cleanupExpired: vi.fn()
    };

    const logger = { warn: vi.fn(), error: vi.fn() };
    const service = createNotificationService({
      registry,
      sse,
      push,
      repos: { notification: notifRepo, pushSubscription: pushSubRepo },
      logger
    });

    await service.send('p', {});

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed for 1/2'),
      expect.arrayContaining([403])
    );
  });

  it('does not log expired endpoints as failures (they are pruned, not failing)', async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'p', title: 'Hi', recipients: ['user-1'], channels: ['push'] });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const pushSubRepo = {
      findByUser: vi.fn(async () => [
        { endpoint: 'https://push.example.com/gone', keys: { p256dh: 'a', auth: 'b' } }
      ]),
      create: vi.fn(async () => 'created' as const),
      delete: vi.fn(async () => {})
    };
    const push = {
      sendPush: vi.fn(async () => [
        {
          endpoint: 'https://push.example.com/gone',
          success: false,
          statusCode: 410,
          expired: true
        }
      ]),
      cleanupExpired: vi.fn()
    };

    const logger = { warn: vi.fn(), error: vi.fn() };
    const service = createNotificationService({
      registry,
      sse,
      push,
      repos: { notification: notifRepo, pushSubscription: pushSubRepo },
      logger
    });

    await service.send('p', {});

    expect(pushSubRepo.delete).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a failed prune instead of swallowing it — a dead endpoint would be re-fetched forever', async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'p', title: 'Hi', recipients: ['user-1'], channels: ['push'] });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const pushSubRepo = {
      findByUser: vi.fn(async () => [
        { endpoint: 'https://push.example.com/gone', keys: { p256dh: 'a', auth: 'b' } }
      ]),
      create: vi.fn(async () => 'created' as const),
      delete: vi.fn(async () => {
        throw new Error('delete permission revoked');
      })
    };
    const push = {
      sendPush: vi.fn(async () => [
        {
          endpoint: 'https://push.example.com/gone',
          success: false,
          statusCode: 410,
          expired: true
        }
      ]),
      cleanupExpired: vi.fn()
    };

    const logger = { warn: vi.fn(), error: vi.fn() };
    const service = createNotificationService({
      registry,
      sse,
      push,
      repos: { notification: notifRepo, pushSubscription: pushSubRepo },
      logger
    });

    await expect(service.send('p', {})).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to prune'),
      expect.any(Error)
    );
    // Capability discipline: the endpoint URL must not appear in the log line.
    const pruneLine = vi
      .mocked(logger.warn)
      .mock.calls.find(([msg]) => String(msg).includes('failed to prune'));
    expect(String(pruneLine?.[0])).not.toContain('push.example.com/gone');
  });

  it('logs a throwing onPushResult hook instead of losing the consumer’s observability silently', async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'p', title: 'Hi', recipients: ['user-1'], channels: ['push'] });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    const pushSubRepo = {
      findByUser: vi.fn(async () => [
        { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' } }
      ]),
      create: vi.fn(async () => 'created' as const),
      delete: vi.fn(async () => {})
    };
    const push = {
      sendPush: vi.fn(async () => [
        { endpoint: 'https://push.example.com/x', success: true, statusCode: 201 }
      ]),
      cleanupExpired: vi.fn()
    };

    const logger = { warn: vi.fn(), error: vi.fn() };
    const service = createNotificationService({
      registry,
      sse,
      push,
      repos: { notification: notifRepo, pushSubscription: pushSubRepo },
      onPushResult: () => {
        throw new Error('typo in the metrics call');
      },
      logger
    });

    await expect(service.send('p', {})).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('onPushResult hook threw'),
      expect.any(Error)
    );
  });

  it('isolates a per-recipient failure: later recipients still get their notification', async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'multi', title: 'Hi', recipients: ['user-1', 'user-2', 'user-3'] });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    // The insert for user-2 blows up (DB blip); user-3 must not be skipped.
    vi.mocked(notifRepo.create).mockImplementation(async (data) => {
      if (data.userId === 'user-2') throw new Error('db blip');
      return {
        id: 'n-x',
        userId: data.userId,
        typeKey: data.typeKey,
        title: data.title,
        body: null,
        url: null,
        icon: null,
        readAt: null,
        createdAt: new Date()
      };
    });

    const logger = { warn: vi.fn(), error: vi.fn() };
    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo },
      logger
    });

    // send() resolves (best-effort per recipient) …
    await service.send('multi', {});

    // … all three recipients were attempted …
    expect(notifRepo.create).toHaveBeenCalledTimes(3);
    expect(notifRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-3' }));
    // … and the failure is not silent.
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('user-2'), expect.any(Error));
  });

  it('a throwing consumer logger cannot break delivery (shielded sink)', async () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'multi', title: 'Hi', recipients: ['user-1', 'user-2'] });

    const sse = createSSEManager();
    const notifRepo = createMockNotificationRepo();
    vi.mocked(notifRepo.create).mockImplementation(async (data) => {
      if (data.userId === 'user-1') throw new Error('db blip');
      return {
        id: 'n-x',
        userId: data.userId,
        typeKey: data.typeKey,
        title: data.title,
        body: null,
        url: null,
        icon: null,
        readAt: null,
        createdAt: new Date()
      };
    });

    const service = createNotificationService({
      registry,
      sse,
      repos: { notification: notifRepo },
      logger: {
        warn: vi.fn(),
        error: vi.fn(() => {
          throw new Error('sink is broken too');
        })
      }
    });

    await expect(service.send('multi', {})).resolves.toBeUndefined();
    expect(notifRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }));
  });

  it('logs a whole-transport push failure instead of swallowing it', async () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'push_down',
      title: 'Hi',
      recipients: ['user-1'],
      channels: ['push']
    });

    const sse = createSSEManager(); // user-1 offline → push branch runs
    const notifRepo = createMockNotificationRepo();
    const pushSubRepo = {
      findByUser: vi.fn(async () => [
        { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' } }
      ]),
      create: vi.fn(async () => 'created' as const),
      delete: vi.fn(async () => {})
    };
    const push = {
      sendPush: vi.fn(async () => {
        throw new Error('transport down');
      }),
      cleanupExpired: vi.fn()
    };

    const logger = { warn: vi.fn(), error: vi.fn() };
    const service = createNotificationService({
      registry,
      sse,
      push,
      repos: { notification: notifRepo, pushSubscription: pushSubRepo },
      logger
    });

    await service.send('push_down', {});

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('push transport failed'),
      expect.any(Error)
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

    await service.markAsRead('user-1', 'n-1');
    expect(notifRepo.markAsRead).toHaveBeenCalledWith('user-1', 'n-1');

    await service.markAllAsRead('user-1');
    expect(notifRepo.markAllAsRead).toHaveBeenCalledWith('user-1');

    await service.getUnreadCount('user-1');
    expect(notifRepo.getUnreadCount).toHaveBeenCalledWith('user-1');

    // Mutation-test finding: with (userId, id) both plain strings, a swapped
    // forwarding turns the owner-scoped delete into a silent no-op (200, row
    // stays). Pin the exact argument order for the two remaining hops.
    await service.deleteNotification('user-1', 'n-1');
    expect(notifRepo.delete).toHaveBeenCalledWith('user-1', 'n-1');

    await service.getForUser('user-1', { limit: 5, unreadOnly: true });
    expect(notifRepo.findByUser).toHaveBeenCalledWith('user-1', { limit: 5, unreadOnly: true });
  });
});
