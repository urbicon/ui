/**
 * @summary Keeps the notification stream open and reconnects when it drops.
 * @description Headless SSE listener for real-time notifications. Reads the stream off `fetch`
 * rather than `EventSource`, so it sees the HTTP response and decides by the server's machine
 * `code`, reported through `onRefused`: `connection_limit` (and any other 4xx) is final — the same
 * request would get the same answer; `rate_limited` waits out `Retry-After`; `not_authenticated`
 * is retried every 30s, since the session may come back; a 5xx and a dropped stream reconnect
 * with exponential backoff (1s doubling, or the server's `retry:`, capped at 60s), resuming from
 * the last `id:` the stream committed. A 2xx that is not `text/event-stream` (the login page a
 * redirect landed on) is final too. Connects to `apiPath` (default `/api/notifications/stream`).
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
  /**
   * Consecutive failed reconnects (a dropped stream, a 5xx) before the
   * listener gives up; a connection that stayed open for 10s starts the count
   * over. Rate limits and a missing session are not counted. Read once at mount.
   * @default 5
   */
  maxReconnectAttempts?: number;
  /** Called when a new notification arrives via SSE. */
  onNotification?: (
    notification: import('../../../server/adapters/types.js').NotificationRecord
  ) => void;
  /**
   * Called when the stream drops or cannot be reached at all (network
   * failure, server closed it) — a reconnect with backoff follows, up to
   * `maxReconnectAttempts` in a row.
   */
  onError?: (error: Error) => void;
  /**
   * Called when the server answers the stream request with a non-2xx status,
   * or with a 2xx that is not `text/event-stream` (`code` is then
   * `undefined`). `code` is the machine code from the JSON body; map it
   * through `errorMessageFromCode` for the localized sentence. What follows
   * depends on it: `rate_limited` waits out `Retry-After`, `not_authenticated`
   * retries every 30s, a 5xx keeps the backoff; everything else —
   * `connection_limit` (the per-user cap on concurrent streams, cleared only
   * by closing a tab), 403, 404, a body without a code — is final.
   * @summary The server refused the stream; carries the machine code that decides whether a retry follows.
   */
  onRefused?: (code: string | undefined, status: number) => void;
  /** Called when a reconnection attempt starts. Receives current attempt number. */
  onReconnect?: (attempt: number) => void;
}

export { default as NotificationListener } from './NotificationListener.svelte';
