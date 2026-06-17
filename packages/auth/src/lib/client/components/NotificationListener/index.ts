/**
 * @description Headless SSE listener for real-time notifications. Reconnects with exponential backoff (1–30s).
 * Connects to `basePath` (default `/api/notifications/stream`). Pair with `createStreamHandler(sse)` on the server — mount its `GET` on the stream route.
 *
 * @tag data
 * @related NotificationCenter
 * @related NotificationBadge
 *
 * @example
 * ```svelte
 * <NotificationListener onNotification={(n) => store.add(n)} />
 * ```
 */
export interface NotificationListenerProps {
  /**
   * SSE stream endpoint. Read once when the component mounts — to switch
   * endpoints (e.g. after a user change), unmount and remount the listener.
   * @default '/api/notifications/stream'
   */
  basePath?: string;
  /** Maximum reconnection attempts before giving up. Read once at mount. @default 5 */
  maxReconnectAttempts?: number;
  /** Called when a new notification arrives via SSE. */
  onNotification?: (
    notification: import('../../../server/adapters/types.js').NotificationRecord
  ) => void;
  /** Called when the SSE connection encounters an error. */
  onError?: (error: Event) => void;
  /** Called when a reconnection attempt starts. Receives current attempt number. */
  onReconnect?: (attempt: number) => void;
}

export { default as NotificationListener } from './NotificationListener.svelte';
