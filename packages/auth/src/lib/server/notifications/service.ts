import type {
  NotificationPreferenceRepository,
  NotificationRecord,
  NotificationRepository,
  PushSubscriptionRepository
} from '../adapters/types.js';
import type { PushPayload, PushResult, PushService } from './push.js';
import type { NotificationRegistry } from './registry.js';
import type { SSEManager } from './sse.js';

export interface NotificationServiceDeps {
  registry: NotificationRegistry;
  sse: SSEManager;
  push?: PushService;
  repos: {
    notification: NotificationRepository;
    pushSubscription?: PushSubscriptionRepository;
    notificationPreference?: NotificationPreferenceRepository;
  };
  /**
   * Resolves the user IDs that receive notification types declared with
   * `recipients: 'admins'`. The package has no notion of roles itself, so the
   * consumer must wire this (e.g. `() => repo.findAdminUserIds()`).
   *
   * If a type uses `recipients: 'admins'` and this resolver is **not**
   * provided, `send()` throws — silently delivering admin alerts (suspicious
   * login, new passkey, …) to nobody would drop security-relevant signals with
   * no indication anything is wrong. For data-dependent recipients use the
   * function form of `recipients` instead.
   */
  resolveAdminRecipients?: () => string[] | Promise<string[]>;
  /**
   * Optional observability hook called with the raw push-delivery results for
   * each recipient. The service swallows push failures (a single bad
   * subscription must not break a send), so without this hook a consumer has no
   * way to see crypto errors, rate-limited endpoints, or 4xx/5xx. Invoked
   * defensively — a throwing hook never breaks delivery.
   */
  onPushResult?: (userId: string, results: PushResult[]) => void;
}

export interface NotificationService {
  send(typeKey: string, data: Record<string, unknown>): Promise<void>;
  getForUser(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<NotificationRecord[]>;
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  deleteNotification(id: string, userId: string): Promise<void>;
}

function resolveString(
  value: string | ((data: Record<string, unknown>) => string),
  data: Record<string, unknown>
): string {
  return typeof value === 'function' ? value(data) : value;
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const { registry, sse, push, repos, resolveAdminRecipients, onPushResult } = deps;

  return {
    async send(typeKey, data) {
      const typeDef = registry.get(typeKey);
      if (!typeDef) {
        throw new Error(`Unknown notification type: ${typeKey}`);
      }

      const title = resolveString(typeDef.title, data);
      const body = typeDef.body ? resolveString(typeDef.body, data) : undefined;
      const url = typeDef.url ? resolveString(typeDef.url, data) : undefined;
      const channels = typeDef.channels ?? ['sse', 'push'];

      // Resolve recipients
      let recipientIds: string[];
      if (typeDef.recipients === 'all') {
        recipientIds = sse.getOnlineUserIds();
      } else if (typeDef.recipients === 'admins') {
        if (!resolveAdminRecipients) {
          throw new Error(
            `Notification type "${typeKey}" uses recipients: 'admins', but no ` +
              `resolveAdminRecipients resolver was provided to createNotificationService. ` +
              `Wire one (e.g. () => repo.findAdminUserIds()) or use a recipients function.`
          );
        }
        recipientIds = await resolveAdminRecipients();
      } else if (Array.isArray(typeDef.recipients)) {
        recipientIds = typeDef.recipients;
      } else {
        recipientIds = await typeDef.recipients(data);
      }

      // Persist and deliver to each recipient
      for (const userId of recipientIds) {
        const notification = await repos.notification.create({
          userId,
          typeKey,
          title,
          body,
          url,
          icon: typeDef.icon
        });

        // Check user preferences
        let prefs = { sse: true, push: true, email: true };
        if (repos.notificationPreference) {
          const userPrefs = await repos.notificationPreference.findByUser(userId);
          const typePref = userPrefs.find((p) => p.typeKey === typeKey);
          if (typePref) {
            prefs = typePref;
          }
        }

        // SSE delivery
        if (channels.includes('sse') && prefs.sse && sse.isOnline(userId)) {
          sse.notifyUser(userId, {
            type: 'notification',
            notification
          });
        }

        // Push delivery (when user is offline)
        if (channels.includes('push') && prefs.push && push && repos.pushSubscription) {
          if (!sse.isOnline(userId)) {
            const pushRepo = repos.pushSubscription;
            const subscriptions = await pushRepo.findByUser(userId);
            if (subscriptions.length > 0) {
              const payload: PushPayload = { title, body, url, icon: typeDef.icon };
              const results = await push
                .sendPush(subscriptions, payload)
                .catch((): PushResult[] => []);

              if (onPushResult) {
                try {
                  onPushResult(userId, results);
                } catch {
                  // An observability hook must never break delivery.
                }
              }

              // Prune subscriptions the push service reported as gone (410/404).
              // sendPush already proved they're dead, so delete directly rather
              // than re-probing — abandoned endpoints would otherwise be retried
              // on every send forever.
              for (const result of results) {
                if (result.expired) {
                  await pushRepo.delete(userId, result.endpoint).catch(() => {});
                }
              }
            }
          }
        }
      }
    },

    async getForUser(userId, options) {
      return repos.notification.findByUser(userId, options);
    },

    async markAsRead(id, userId) {
      await repos.notification.markAsRead(id, userId);
    },

    async markAllAsRead(userId) {
      await repos.notification.markAllAsRead(userId);
    },

    async getUnreadCount(userId) {
      return repos.notification.getUnreadCount(userId);
    },

    async deleteNotification(id, userId) {
      await repos.notification.delete(id, userId);
    }
  };
}
