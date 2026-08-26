/**
 * @summary Keeps the notification stream open and reconnects when it drops.
 * @description Headless SSE listener for real-time notifications. Reads the stream off `fetch`
 * rather than `EventSource`, so it sees the HTTP response: a refused stream (non-2xx) is reported
 * through `onRefused` with the server's machine `code` and, for a 4xx such as `connection_limit`,
 * is not retried — repeating the same request would get the same answer. A dropped or 5xx stream
 * reconnects with exponential backoff (1–30s, or the server's `retry:`), resuming from the last
 * `id:` the stream committed. Connects to `apiPath` (default `/api/notifications/stream`).
 * Pair with `createStreamHandler(sse)` on the server; mount its `GET` on the stream route.
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
   * SSE stream endpoint. Read once when the component mounts; to switch
   * endpoints (e.g. after a user change), unmount and remount the listener.
   * @default '/api/notifications/stream'
   */
  apiPath?: string;
  /** Maximum reconnection attempts before giving up. Read once at mount. @default 5 */
  maxReconnectAttempts?: number;
  /** Called when a new notification arrives via SSE. */
  onNotification?: (
    notification: import('../../../server/adapters/types.js').NotificationRecord
  ) => void;
  /**
   * Called when an open stream drops (network failure, server closed it) —
   * a reconnect follows, up to `maxReconnectAttempts`.
   */
  onError?: (error: Error) => void;
  /**
   * Called when the server answers the stream request with a non-2xx status.
   * `code` is the machine code from the JSON body (`connection_limit` for the
   * per-user cap on concurrent streams, `not_authenticated` for a missing
   * session; `undefined` when the body carries none); map it through
   * `errorMessageFromCode` for the localized sentence. A 4xx is final — no
   * reconnect follows — a 5xx keeps the backoff.
   * @summary The server refused the stream; carries the machine code, and a 4xx is not retried.
   */
  onRefused?: (code: string | undefined, status: number) => void;
  /** Called when a reconnection attempt starts. Receives current attempt number. */
  onReconnect?: (attempt: number) => void;
}

export { default as NotificationListener } from './NotificationListener.svelte';
