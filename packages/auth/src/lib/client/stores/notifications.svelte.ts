import type { NotificationRecord } from '../../server/adapters/types.js';
import { type CsrfClientOptions, csrfFetch } from '../csrf.js';
import { getJson, parseJsonBody, postJson, wireError } from '../utils/http.js';

export interface NotificationStoreConfig {
  apiPath?: string;
  /**
   * CSRF cookie/header names — only needed when the server overrides the
   * defaults via `config.csrf`. Omit to use the package defaults.
   */
  csrf?: CsrfClientOptions;
  /**
   * Custom fetch implementation for all API calls. Defaults to the global
   * `fetch`. Useful for mock backends in demos/tests or custom retry layers —
   * the same injection point every component exposes (review R18).
   */
  fetcher?: typeof globalThis.fetch;
}

/**
 * Wire-contract failure of the most recent store operation. Localize like the
 * components do: `errorMessageFromCode(lastError.code, t, lastError.error)`.
 * `code: 'network_error'` is client-synthesized (the request never reached
 * the server).
 */
export interface NotificationStoreError {
  error?: string;
  code?: string;
}

/**
 * Runes store backing `<NotificationCenter>`/`<NotificationBadge>`: loads,
 * marks read and deletes the session user's notifications. Its four routes —
 * `GET {apiPath}`, `POST {apiPath}/[id]/read`, `POST {apiPath}/read-all`,
 * `DELETE {apiPath}/[id]` — are served by `createNotificationsHandlers`
 * from `@urbicon-ui/auth/server` (mount its `list`/`read`/`readAll`/`item`
 * groups under `apiPath`, default `/api/notifications`).
 *
 * Every operation returns `false` and records `lastError` when it fails —
 * an unauthenticated `load` no longer masquerades as an empty inbox, and a
 * failed mark/delete no longer no-ops silently (review R18). A successful
 * operation clears `lastError`.
 */
export function createNotificationStore(config?: NotificationStoreConfig) {
  const apiPath = config?.apiPath ?? '/api/notifications';
  const csrf = config?.csrf;
  const fetcher = config?.fetcher;

  let notifications = $state<NotificationRecord[]>([]);
  let loading = $state(false);
  let lastError = $state<NotificationStoreError | null>(null);
  const unreadCount = $derived(notifications.filter((n) => !n.readAt).length);

  async function load(options?: { limit?: number; unreadOnly?: boolean }): Promise<boolean> {
    try {
      loading = true;
      lastError = null;
      const parts: string[] = [];
      if (options?.limit) parts.push(`limit=${options.limit}`);
      if (options?.unreadOnly) parts.push('unreadOnly=true');
      const qs = parts.length > 0 ? `?${parts.join('&')}` : '';

      const { ok, data } = await getJson(`${apiPath}${qs}`, { fetcher });
      if (!ok) {
        // Keep whatever list we already have: a 401/500 must not blank the
        // inbox into a fake "no notifications" state.
        lastError = wireError(data);
        return false;
      }
      notifications = (data.notifications as NotificationRecord[] | undefined) ?? [];
      return true;
    } catch {
      lastError = { code: 'network_error' };
      return false;
    } finally {
      loading = false;
    }
  }

  async function markAsRead(id: string): Promise<boolean> {
    // Only apply the optimistic state change once the server confirms it —
    // otherwise a 4xx/5xx would leave the UI showing "read" while the server
    // still has it unread.
    try {
      const { ok, data } = await postJson(
        `${apiPath}/${encodeURIComponent(id)}/read`,
        {},
        { csrf, fetcher }
      );
      if (!ok) {
        lastError = wireError(data);
        return false;
      }
      lastError = null;
      notifications = notifications.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n));
      return true;
    } catch {
      lastError = { code: 'network_error' };
      return false;
    }
  }

  async function markAllAsRead(): Promise<boolean> {
    try {
      const { ok, data } = await postJson(`${apiPath}/read-all`, {}, { csrf, fetcher });
      if (!ok) {
        lastError = wireError(data);
        return false;
      }
      lastError = null;
      notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }));
      return true;
    } catch {
      lastError = { code: 'network_error' };
      return false;
    }
  }

  function add(notification: NotificationRecord): void {
    notifications = [notification, ...notifications];
  }

  async function deleteNotification(id: string): Promise<boolean> {
    try {
      const res = await csrfFetch(
        `${apiPath}/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
        csrf,
        fetcher
      );
      if (!res.ok) {
        lastError = wireError(await parseJsonBody(res));
        return false;
      }
      lastError = null;
      notifications = notifications.filter((n) => n.id !== id);
      return true;
    } catch {
      lastError = { code: 'network_error' };
      return false;
    }
  }

  return {
    get notifications() {
      return notifications;
    },
    get loading() {
      return loading;
    },
    get unreadCount() {
      return unreadCount;
    },
    get lastError() {
      return lastError;
    },
    load,
    markAsRead,
    markAllAsRead,
    add,
    delete: deleteNotification
  };
}
