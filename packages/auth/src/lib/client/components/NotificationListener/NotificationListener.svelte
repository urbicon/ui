<script lang="ts">
  import { onMount } from 'svelte';
  import type { NotificationRecord } from '../../../server/adapters/types.js';
  import { parseJsonBody, wireError } from '../../utils/http.js';
  import {
    createEventStreamParser,
    readEventStream,
    type ServerSentEvent
  } from '../../utils/sse.js';
  import type { NotificationListenerProps } from './index.js';

  let {
    apiPath = '/api/notifications/stream',
    maxReconnectAttempts = 5,
    onNotification,
    onError,
    onRefused,
    onReconnect
  }: NotificationListenerProps = $props();

  function notificationOf(event: ServerSentEvent): NotificationRecord | undefined {
    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return undefined;
    }
    if (typeof payload !== 'object' || payload === null) return undefined;
    const envelope = payload as { type?: unknown; notification?: unknown };
    return envelope.type === 'notification' && envelope.notification
      ? (envelope.notification as NotificationRecord)
      : undefined;
  }

  onMount(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const parser = createEventStreamParser();
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleReconnect() {
      if (reconnectAttempts >= maxReconnectAttempts) return;
      reconnectAttempts++;
      // A server-sent `retry:` names the delay; without one, exponential
      // backoff capped at 30 s.
      const delay = parser.retry ?? Math.min(1000 * 2 ** (reconnectAttempts - 1), 30_000);
      onReconnect?.(reconnectAttempts);
      reconnectTimer = setTimeout(connect, delay);
    }

    // Never awaited: the stream stays open as long as this promise is pending.
    // Every rejection is caught inside, so the abort at unmount leaves no
    // unhandled rejection behind.
    async function connect() {
      reconnectTimer = null;
      try {
        const headers: Record<string, string> = { Accept: 'text/event-stream' };
        // Sent only once the server has committed an `id:`. The shipped
        // `createStreamHandler` sends none, so against it this header never
        // appears; a consumer stream that does gets resumed from its cursor.
        if (parser.lastEventId !== '') headers['Last-Event-ID'] = parser.lastEventId;

        const res = await fetch(apiPath, {
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
          signal
        });

        if (!res.ok) {
          onRefused?.(wireError(await parseJsonBody(res)).code, res.status);
          // A 4xx answers *this request*: repeating it verbatim gets the same
          // answer — a `connection_limit` clears only when a tab closes, a
          // `not_authenticated` only with a new session. A 5xx is the server's
          // state and may pass, so it keeps the backoff.
          if (res.status < 500) return;
          scheduleReconnect();
          return;
        }
        if (!res.body) throw new Error('Notification stream has no body');

        reconnectAttempts = 0;
        await readEventStream(
          res.body,
          parser,
          (event) => {
            const notification = notificationOf(event);
            if (notification) onNotification?.(notification);
          },
          signal
        );
        if (signal.aborted) return;
        // The server closed the stream (restart, idle proxy): a drop, not a refusal.
        onError?.(new Error('Notification stream ended'));
        scheduleReconnect();
      } catch (err) {
        if (signal.aborted) return;
        onError?.(err instanceof Error ? err : new Error(String(err)));
        scheduleReconnect();
      }
    }

    void connect();

    return () => {
      controller.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  });
</script>
