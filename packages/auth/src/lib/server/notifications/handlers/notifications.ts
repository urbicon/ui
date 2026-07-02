import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { NotificationService } from '../service.js';
import { localsUserId } from './locals-user.js';

/**
 * Notification CRUD: the server half of `createNotificationStore` (and with
 * it `<NotificationCenter>`/`<NotificationBadge>`). Returns four route-shaped
 * handler groups matching the paths the client store calls:
 *
 * ```ts
 * const notifications = createNotificationsHandlers(service);
 * // src/routes/api/notifications/+server.ts
 * export const GET = notifications.list.GET;
 * // src/routes/api/notifications/read-all/+server.ts
 * export const POST = notifications.readAll.POST;
 * // src/routes/api/notifications/[id]/read/+server.ts
 * export const POST = notifications.read.POST;
 * // src/routes/api/notifications/[id]/+server.ts
 * export const DELETE = notifications.item.DELETE;
 * ```
 *
 * (The static `read-all` route takes precedence over the `[id]` param route,
 * so all four share the base path.) Every method derives the caller from
 * `locals.user` — set by the auth handle — and goes through the
 * ownership-scoped `NotificationService` methods, so the id in the URL alone
 * can never read or mutate another user's rows.
 */
export function createNotificationsHandlers(service: NotificationService): {
  list: { GET: RequestHandler };
  readAll: { POST: RequestHandler };
  read: { POST: RequestHandler };
  item: { DELETE: RequestHandler };
} {
  return {
    list: {
      GET: async ({ locals, url }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Query params are UI hints, read-tolerantly: a malformed or
        // non-positive `limit` means "no limit" rather than a 400.
        const limitRaw = url.searchParams.get('limit');
        const limitParsed = limitRaw === null ? Number.NaN : Number.parseInt(limitRaw, 10);
        const notifications = await service.getForUser(userId, {
          limit: Number.isInteger(limitParsed) && limitParsed > 0 ? limitParsed : undefined,
          unreadOnly: url.searchParams.get('unreadOnly') === 'true'
        });
        return json({ notifications });
      }
    },

    readAll: {
      POST: async ({ locals }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return json({ error: 'Unauthorized' }, { status: 401 });
        }

        await service.markAllAsRead(userId);
        return json({ success: true });
      }
    },

    read: {
      POST: async ({ locals, params }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = params.id;
        if (!id) {
          return json({ error: 'Notification id is required' }, { status: 400 });
        }

        await service.markAsRead(id, userId);
        return json({ success: true });
      }
    },

    item: {
      DELETE: async ({ locals, params }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = params.id;
        if (!id) {
          return json({ error: 'Notification id is required' }, { status: 400 });
        }

        await service.deleteNotification(id, userId);
        return json({ success: true });
      }
    }
  };
}
