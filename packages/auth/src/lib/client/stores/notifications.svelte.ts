import type { NotificationRecord } from '../../server/adapters/types.js';
import { type CsrfClientOptions, csrfFetch } from '../csrf.js';

export interface NotificationStoreConfig {
  basePath?: string;
  /**
   * CSRF cookie/header names — only needed when the server overrides the
   * defaults via `config.csrf`. Omit to use the package defaults.
   */
  csrf?: CsrfClientOptions;
}

export function createNotificationStore(config?: NotificationStoreConfig) {
  const basePath = config?.basePath ?? '/api/notifications';
  const csrf = config?.csrf;

  let notifications = $state<NotificationRecord[]>([]);
  let loading = $state(false);
  const unreadCount = $derived(notifications.filter((n) => !n.readAt).length);

  async function load(options?: { limit?: number; unreadOnly?: boolean }): Promise<void> {
    try {
      loading = true;
      const parts: string[] = [];
      if (options?.limit) parts.push(`limit=${options.limit}`);
      if (options?.unreadOnly) parts.push('unreadOnly=true');
      const qs = parts.length > 0 ? `?${parts.join('&')}` : '';

      const res = await fetch(`${basePath}${qs}`);
      const data = await res.json();
      notifications = data.notifications ?? [];
    } catch {
      // Ignore
    } finally {
      loading = false;
    }
  }

  async function markAsRead(id: string): Promise<void> {
    // Only apply the optimistic state change once the server confirms it —
    // otherwise a 4xx/5xx would leave the UI showing "read" while the server
    // still has it unread.
    const res = await csrfFetch(`${basePath}/${id}/read`, { method: 'POST' }, csrf);
    if (!res.ok) return;
    /* eslint-disable svelte/prefer-svelte-reactivity */
    notifications = notifications.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n));
    /* eslint-enable svelte/prefer-svelte-reactivity */
  }

  async function markAllAsRead(): Promise<void> {
    const res = await csrfFetch(`${basePath}/read-all`, { method: 'POST' }, csrf);
    if (!res.ok) return;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }));
  }

  function add(notification: NotificationRecord): void {
    notifications = [notification, ...notifications];
  }

  async function deleteNotification(id: string): Promise<void> {
    const res = await csrfFetch(`${basePath}/${id}`, { method: 'DELETE' }, csrf);
    if (!res.ok) return;
    notifications = notifications.filter((n) => n.id !== id);
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
    load,
    markAsRead,
    markAllAsRead,
    add,
    delete: deleteNotification
  };
}
