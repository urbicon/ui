<script lang="ts">
  import { onMount } from 'svelte';
  import type { NotificationRecord } from '../../../server/adapters/types.js';
  import { parseJsonBody, wireError } from '../../utils/http.js';
  import {
    createEventStreamParser,
    type EventStreamCursor,
    lastEventIdHeader,
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

  // Every wait is capped here: the backoff, a server `retry:`, a `Retry-After`.
  // Past 2^31−1 ms `setTimeout` wraps to 0 — a `retry: 4294967296000` would
  // be a tight loop.
  const MAX_DELAY_MS = 60_000;
  // A refused session is polled, not abandoned: it can come back (a login in
  // another tab, a cookie rotation) while this page stays open.
  const SESSION_RETRY_MS = 30_000;
  // A connection that lived this long was healthy: the failure count starts
  // over. Tied to lifetime, not to the 2xx, so a server that answers and
  // closes at once cannot keep the count at zero and the loop at 1 s.
  const HEALTHY_AFTER_MS = 10_000;

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

  function isEventStream(res: Response): boolean {
    const type = res.headers.get('content-type') ?? '';
    return type.split(';')[0]?.trim().toLowerCase() === 'text/event-stream';
  }

  /** `Retry-After` as ms — delta-seconds or an HTTP-date; `undefined` when absent or unreadable. */
  function retryAfterMs(res: Response): number | undefined {
    const header = res.headers.get('retry-after');
    if (header === null) return undefined;
    if (/^\d+$/.test(header)) return Number(header) * 1000;
    const at = Date.parse(header);
    return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
  }

  // A throw out of `onNotification` is the consumer's bug, reported the way a
  // throw out of an `EventSource` listener is — to the page's error handler,
  // not to the stream, which stays open.
  const report = (error: unknown) =>
    typeof reportError === 'function'
      ? reportError(error)
      : queueMicrotask(() => {
          throw error;
        });

  onMount(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const cursor: EventStreamCursor = { lastEventId: '', retry: undefined };
    let warnedNonAsciiId = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function deliver(event: ServerSentEvent) {
      const notification = notificationOf(event);
      if (!notification) return;
      try {
        onNotification?.(notification);
      } catch (error) {
        report(error);
      }
    }

    function schedule(delayMs: number) {
      timer = setTimeout(connect, Math.min(delayMs, MAX_DELAY_MS));
    }

    /** A counted retry: drops and 5xx, `maxReconnectAttempts` in a row and the listener stops. */
    function backoff() {
      if (failures >= maxReconnectAttempts) return;
      failures++;
      onReconnect?.(failures);
      schedule(cursor.retry ?? 1000 * 2 ** (failures - 1));
    }

    function dropped(error: Error, openedAt: number) {
      if (openedAt !== 0 && Date.now() - openedAt >= HEALTHY_AFTER_MS) failures = 0;
      onError?.(error);
      backoff();
    }

    // Never awaited: the stream stays open as long as this promise is pending.
    // Every rejection is caught inside, so the abort at unmount leaves no
    // unhandled rejection behind.
    async function connect() {
      timer = null;
      let openedAt = 0;
      try {
        const headers: Record<string, string> = { Accept: 'text/event-stream' };
        // Sent only once the server has committed an `id:`. The shipped
        // `createStreamHandler` sends none, so against it this header never
        // appears; a consumer stream that does gets resumed from its cursor.
        if (cursor.lastEventId !== '') {
          const header = lastEventIdHeader(cursor.lastEventId);
          if (header !== undefined) headers['Last-Event-ID'] = header;
          else if (import.meta.env?.DEV && !warnedNonAsciiId) {
            warnedNonAsciiId = true;
            console.warn(
              `[auth] NotificationListener: Last-Event-ID ${JSON.stringify(cursor.lastEventId)} is not ASCII and was not sent — fetch cannot put the bytes EventSource would send on the wire in every browser. The stream resumes without a cursor.`
            );
          }
        }

        const res = await fetch(apiPath, {
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
          signal
        });

        if (!res.ok) {
          const code = wireError(await parseJsonBody(res)).code;
          onRefused?.(code, res.status);
          // What follows is decided by the code, not the status class. A 5xx
          // is the server's state and may pass. A rate limit names its own
          // wait. A missing session may return. Everything else — the
          // per-user cap that only a closing tab clears, 403, 404, a body
          // without a code — answers this request for good: repeating it
          // verbatim gets the same answer.
          if (res.status >= 500) backoff();
          else if (code === 'rate_limited') {
            const wait = retryAfterMs(res);
            if (wait === undefined) backoff();
            else schedule(wait);
          } else if (code === 'not_authenticated') schedule(SESSION_RETRY_MS);
          return;
        }
        if (!isEventStream(res)) {
          // A 2xx that is not the stream: the login page a redirect landed
          // on, a proxy's placeholder. Nothing to parse, nothing to retry.
          void res.body?.cancel().catch(() => {});
          onRefused?.(undefined, res.status);
          return;
        }
        if (!res.body) throw new Error('Notification stream has no body');

        openedAt = Date.now();
        await readEventStream(res.body, createEventStreamParser(cursor), deliver, signal);
        if (signal.aborted) return;
        // The server closed the stream (restart, idle proxy): a drop, not a refusal.
        dropped(new Error('Notification stream ended'), openedAt);
      } catch (err) {
        if (signal.aborted) return;
        dropped(err instanceof Error ? err : new Error(String(err)), openedAt);
      }
    }

    void connect();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  });
</script>
