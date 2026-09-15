import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { privateEndpoints } from '../../handlers/_shared.js';
import { authError } from '../../handlers/errors.js';
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
 *
 * None of the four carries a rate limit, and that is the decision rather than
 * an omission: reading, flipping a read flag and removing a row the caller
 * already owns create nothing, verify no secret and reach no third party, so
 * what they touch is bounded by what the caller owns — the clause of the
 * package's rule for authenticated writes that carries no limit (AUTH.md →
 * Rate-Limiting, Lockout & Route Scope). The request rate of an authenticated
 * caller is the edge's brake, not this package's. Pinned in
 * `notifications.test.ts`.
 */
export function createNotificationsHandlers(service: NotificationService): {
  list: { GET: RequestHandler };
  readAll: { POST: RequestHandler };
  read: { POST: RequestHandler };
  item: { DELETE: RequestHandler };
} {
  return privateEndpoints({
    list: {
      GET: async ({ locals, url }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return authError('not_authenticated');
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
          return authError('not_authenticated');
        }

        await service.markAllAsRead(userId);
        return json({ success: true });
      }
    },

    read: {
      POST: async ({ locals, params }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return authError('not_authenticated');
        }

        const id = params.id;
        if (!id) {
          return authError('validation_error', { message: 'Notification id is required' });
        }

        await service.markAsRead(userId, id);
        return json({ success: true });
      }
    },

    item: {
      DELETE: async ({ locals, params }) => {
        const userId = localsUserId(locals);
        if (!userId) {
          return authError('not_authenticated');
        }

        const id = params.id;
        if (!id) {
          return authError('validation_error', { message: 'Notification id is required' });
        }

        await service.deleteNotification(userId, id);
        return json({ success: true });
      }
    }
  });
}
