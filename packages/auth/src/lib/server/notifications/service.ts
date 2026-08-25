import type { AuthLogger } from '../../types.js';
import type {
  NotificationPreferenceRepository,
  NotificationRecord,
  NotificationRepository,
  PushSubscriptionRepository
} from '../adapters/types.js';
import { shieldLogger } from '../logger.js';
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
  /**
   * Sink for per-recipient delivery failures (see {@link NotificationService.send}).
   * Defaults to `console`; calls are shielded, so a throwing sink cannot break
   * delivery — same contract as `AuthConfig.logger`.
   */
  logger?: AuthLogger;
}

export interface NotificationService {
  /**
   * Resolve the type's recipients, then persist + deliver to each of them.
   *
   * **Failure semantics:** configuration errors (unknown type, unwired
   * `resolveAdminRecipients`, the legacy `'all'` target) throw before any
   * delivery. Once delivery starts it is **best-effort per recipient**: a
   * failure for one recipient (DB blip on the insert, preference read, …) is
   * reported to `deps.logger` and delivery continues with the remaining
   * recipients — `send()` resolves. Push-transport failures are additionally
   * observable per recipient via `onPushResult`.
   */
  send(typeKey: string, data: Record<string, unknown>): Promise<void>;
  getForUser(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<NotificationRecord[]>;
  /** Scoped to the owner; owner-first parameter order (see adapters/types.ts). */
  markAsRead(userId: string, id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  /** Scoped to the owner; owner-first parameter order (see adapters/types.ts). */
  deleteNotification(userId: string, id: string): Promise<void>;
}

function resolveString(
  value: string | ((data: Record<string, unknown>) => string),
  data: Record<string, unknown>
): string {
  return typeof value === 'function' ? value(data) : value;
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const { registry, sse, push, repos, resolveAdminRecipients, onPushResult } = deps;
  const logger = shieldLogger(deps.logger ?? console);

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
      // Migration guard for JS consumers the compiler can't warn: 'all' was
      // renamed to 'online' because it only ever reached currently-online
      // users — silently accepting it would keep that misleading semantic.
      if ((typeDef.recipients as unknown) === 'all') {
        throw new Error(
          `Notification type "${typeKey}" uses recipients: 'all', which was renamed to ` +
            `'online' (it only ever reached users with an open SSE stream in this process — ` +
            `offline accounts got neither a DB row nor a push). Use 'online', or a recipients ` +
            `function for a true all-accounts broadcast.`
        );
      }
      if (typeDef.recipients === 'online') {
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

      // Persist and deliver to each recipient — isolated per recipient: a
      // DB blip for user k must not cost users k+1…n their notification.
      // Failures are best-effort-logged, not rethrown (see the interface JSDoc).
      for (const userId of recipientIds) {
        try {
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
                const results = await push.sendPush(subscriptions, payload).catch((err) => {
                  // sendPush isolates per-subscription failures itself, so
                  // reaching this catch means the whole transport call died.
                  // Keep the send alive (the DB row exists) but say so.
                  logger.error(`[auth] push transport failed for user ${userId}:`, err);
                  return [] as PushResult[];
                });

                if (onPushResult) {
                  try {
                    onPushResult(userId, results);
                  } catch (err) {
                    // An observability hook must never break delivery — but a
                    // throwing hook means the consumer just lost their push
                    // observability, which they must be able to see.
                    logger.warn('[auth] onPushResult hook threw:', err);
                  }
                }

                // The common failure mode is per-endpoint: sendPush isolates
                // each subscription via allSettled and reports failures as
                // results, so they never hit the transport catch above. A
                // VAPID misconfig (403 on every send, forever) or corrupt
                // stored keys would otherwise be invisible unless the
                // optional onPushResult hook is wired — the logger is the
                // floor, the hook the rich channel. Expired endpoints are
                // excluded: they are handled (pruned) right below.
                const failed = results.filter((r) => !r.success && !r.expired);
                if (failed.length > 0) {
                  logger.warn(
                    `[auth] push delivery to user ${userId} failed for ${failed.length}/${results.length} subscription(s):`,
                    failed.map((r) => r.statusCode ?? String(r.error))
                  );
                }

                // Prune subscriptions the push service reported as gone (410/404).
                // sendPush already proved they're dead, so delete directly rather
                // than re-probing — abandoned endpoints would otherwise be retried
                // on every send forever.
                for (const result of results) {
                  if (result.expired) {
                    // Best-effort (the outer catch must not abort the loop),
                    // but never silent: a persistently failing prune means
                    // this dead endpoint is re-fetched on every future send —
                    // exactly the waste pruning exists to prevent. Endpoint
                    // URLs stay out of the log line (capability discipline).
                    await pushRepo.delete(userId, result.endpoint).catch((err) => {
                      logger.warn(
                        `[auth] failed to prune an expired push subscription for user ${userId}:`,
                        err
                      );
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          logger.error(`[auth] notification "${typeKey}" delivery to user ${userId} failed:`, err);
        }
      }
    },

    async getForUser(userId, options) {
      return repos.notification.findByUser(userId, options);
    },

    async markAsRead(userId, id) {
      await repos.notification.markAsRead(userId, id);
    },

    async markAllAsRead(userId) {
      await repos.notification.markAllAsRead(userId);
    },

    async getUnreadCount(userId) {
      return repos.notification.getUnreadCount(userId);
    },

    async deleteNotification(userId, id) {
      await repos.notification.delete(userId, id);
    }
  };
}
