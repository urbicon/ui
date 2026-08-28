// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationListenerProps } from './index.js';
import NotificationListener from './NotificationListener.svelte';

// Mounts the real component against a stubbed global `fetch` whose response
// body is a hand-driven `ReadableStream`. Fake timers stand in for the backoff
// clock; `advance(0)` flushes the microtask chain a body read runs through.

const enc = new TextEncoder();

interface FakeStream {
  response: Response;
  send: (text: string) => void;
  close: () => void;
  cancelled: () => number;
}

/**
 * A `text/event-stream` response with a body the test feeds. Like a real
 * `fetch`, aborting the request's signal errors the body with an AbortError —
 * so the reader's pending `read()` rejects, which is the path the component
 * must swallow on unmount.
 */
function sseStream(
  status = 200,
  honourAbort = true,
  contentType = 'text/event-stream; charset=utf-8'
): FakeStream {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      cancelled++;
    }
  });
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': contentType }
  });
  (response as Response & { __abort?: () => void }).__abort = honourAbort
    ? () => controller.error(new DOMException('The operation was aborted.', 'AbortError'))
    : undefined;
  return {
    response,
    send: (text) => controller.enqueue(enc.encode(text)),
    close: () => controller.close(),
    cancelled: () => cancelled
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

type Outcome = Response | Error;

/** Stub `fetch` with a queue of outcomes; records every call's `RequestInit`. */
function stubFetch(...outcomes: Outcome[]) {
  const queue = [...outcomes];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error('fetch queue exhausted');
    if (next instanceof Error) throw next;
    const abort = (next as Response & { __abort?: () => void }).__abort;
    if (abort) init?.signal?.addEventListener('abort', abort, { once: true });
    return next;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

let dispose: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function render(props: NotificationListenerProps = {}) {
  const instance = mount(NotificationListener, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const record = { id: 'n1', title: 'Hi' };
const envelope = (n: unknown) => JSON.stringify({ type: 'notification', notification: n });

describe('NotificationListener (component)', () => {
  it('opens the stream with fetch (same-origin, no-store) and delivers notification events', async () => {
    const stream = sseStream();
    const fetchMock = stubFetch(stream.response);
    const onNotification = vi.fn();
    render({ onNotification });
    await advance(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/notifications/stream');
    expect(init.credentials).toBe('same-origin');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);

    stream.send(`: heartbeat\n\ndata: ${envelope(record)}\n\n`);
    await advance(0);
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onNotification).toHaveBeenCalledWith(record);
  });

  it('parses a notification whose JSON spans several data: lines', async () => {
    const stream = sseStream();
    stubFetch(stream.response);
    const onNotification = vi.fn();
    render({ onNotification });
    await advance(0);

    stream.send('data: {"type":"notification",\r\ndata: "notification":{"id":"n2"}}\r\n\r\n');
    await advance(0);
    expect(onNotification).toHaveBeenCalledWith({ id: 'n2' });
  });

  it('ignores non-JSON data and envelopes that are not notifications', async () => {
    const stream = sseStream();
    stubFetch(stream.response);
    const onNotification = vi.fn();
    const onError = vi.fn();
    render({ onNotification, onError });
    await advance(0);

    stream.send('data: not json\n\ndata: {"type":"ping"}\n\ndata: [1]\n\n');
    await advance(0);
    expect(onNotification).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports 429 connection_limit through onRefused once and never reconnects', async () => {
    const fetchMock = stubFetch(
      jsonResponse(429, { error: 'Too many open connections.', code: 'connection_limit' })
    );
    const onRefused = vi.fn();
    const onReconnect = vi.fn();
    const onError = vi.fn();
    render({ onRefused, onReconnect, onError });
    await advance(0);

    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledWith('connection_limit', 429);

    // The old EventSource loop would have fired five reconnects by now.
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onReconnect).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onRefused).toHaveBeenCalledTimes(1);
  });

  it('passes undefined as the code when a refusal carries no JSON body', async () => {
    stubFetch(new Response('<html>gateway</html>', { status: 403 }));
    const onRefused = vi.fn();
    render({ onRefused });
    await advance(0);
    expect(onRefused).toHaveBeenCalledWith(undefined, 403);
  });

  it('keeps the backoff for a 5xx — positive control for the 4xx rule', async () => {
    const fetchMock = stubFetch(
      jsonResponse(503, { error: 'down', code: 'server_error' }),
      sseStream().response
    );
    const onRefused = vi.fn();
    const onReconnect = vi.fn();
    render({ onRefused, onReconnect });
    await advance(0);

    expect(onRefused).toHaveBeenCalledWith('server_error', 503);
    expect(onReconnect).toHaveBeenCalledWith(1);
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a 2xx that is not text/event-stream as final — the login page a redirect landed on', async () => {
    // `createAuthHandle` answers a guarded non-/api/ path with a 302 to the
    // login page; `fetch` follows it and hands back 200 text/html. Parsed as
    // SSE that is an empty stream that ends at once — with the count reset on
    // every 2xx, a fetch per second for the page's lifetime.
    const html = sseStream(200, true, 'text/html; charset=utf-8');
    const fetchMock = stubFetch(html.response, sseStream().response);
    const onRefused = vi.fn();
    const onError = vi.fn();
    render({ onRefused, onError });
    await advance(0);
    // The body is cancelled unread — the page's HTML is never parsed as SSE.
    expect(html.cancelled()).toBe(1);
    await advance(60_000);

    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledWith(undefined, 200);
    expect(onError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps polling every 30 s on not_authenticated — uncounted — and opens once the session is back', async () => {
    const refused = () =>
      jsonResponse(401, { error: 'Please sign in.', code: 'not_authenticated' });
    const stream = sseStream();
    const fetchMock = stubFetch(
      refused(),
      refused(),
      refused(),
      refused(),
      refused(),
      refused(),
      stream.response
    );
    const onRefused = vi.fn();
    const onReconnect = vi.fn();
    const onNotification = vi.fn();
    render({ onRefused, onReconnect, onNotification, maxReconnectAttempts: 2 });
    await advance(0);
    expect(onRefused).toHaveBeenCalledWith('not_authenticated', 401);

    // Six refusals would have exhausted a counted backoff twice over.
    await advance(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(5 * 30_000);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(onReconnect).not.toHaveBeenCalled();

    stream.send(`data: ${envelope(record)}\n\n`);
    await advance(0);
    expect(onNotification).toHaveBeenCalledWith(record);
  });

  it('waits out Retry-After on rate_limited without spending a reconnect attempt', async () => {
    const fetchMock = stubFetch(
      jsonResponse(
        429,
        { error: 'Too many requests.', code: 'rate_limited' },
        { 'Retry-After': '2' }
      ),
      sseStream().response
    );
    const onRefused = vi.fn();
    const onReconnect = vi.fn();
    render({ onRefused, onReconnect });
    await advance(0);
    expect(onRefused).toHaveBeenCalledWith('rate_limited', 429);
    await advance(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('reads an HTTP-date Retry-After and caps the wait at 60 s', async () => {
    const inTwoMinutes = new Date(Date.now() + 120_000).toUTCString();
    const fetchMock = stubFetch(
      jsonResponse(429, { code: 'rate_limited' }, { 'Retry-After': inTwoMinutes }),
      sseStream().response
    );
    render();
    await advance(0);
    await advance(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the counted backoff for a rate_limited without Retry-After', async () => {
    const fetchMock = stubFetch(jsonResponse(429, { code: 'rate_limited' }), sseStream().response);
    const onReconnect = vi.fn();
    render({ onReconnect });
    await advance(0);
    expect(onReconnect).toHaveBeenCalledWith(1);
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is final on 403 and 404 with a code, not only on connection_limit', async () => {
    for (const [status, code] of [
      [403, 'forbidden'],
      [404, 'not_found']
    ] as const) {
      const fetchMock = stubFetch(jsonResponse(status, { code }));
      const onRefused = vi.fn();
      render({ onRefused });
      await advance(0);
      await advance(60_000);
      expect(onRefused).toHaveBeenCalledWith(code, status);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      dispose?.();
      dispose = undefined;
      vi.unstubAllGlobals();
    }
  });

  it('reconnects after a network failure with exponential backoff, then gives up', async () => {
    const failure = () => new TypeError('Failed to fetch');
    const fetchMock = stubFetch(failure(), failure(), failure(), failure());
    const onError = vi.fn();
    const onReconnect = vi.fn();
    render({ onError, onReconnect, maxReconnectAttempts: 3 });
    await advance(0);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(TypeError);
    expect(onReconnect).toHaveBeenLastCalledWith(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onReconnect).toHaveBeenLastCalledWith(2);

    await advance(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onReconnect).toHaveBeenLastCalledWith(3);

    // Attempt 3 (4 s) was the last one allowed: its failure schedules nothing.
    await advance(4000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(onReconnect).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(4);
  });

  it('starts the failure count over after a connection that lived 10 s, and reconnects when the server closes it', async () => {
    const first = sseStream();
    const second = sseStream();
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), first.response, second.response);
    const onReconnect = vi.fn();
    const onError = vi.fn();
    render({ onReconnect, onError });
    await advance(0);
    await advance(1000); // attempt 1 → `first` opens
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await advance(10_000);
    first.close();
    await advance(0);
    const lastError = onError.mock.lastCall?.[0] as Error | undefined;
    expect(lastError?.message).toMatch(/ended/);
    // The connection was healthy: this is attempt 1 again (1 s), not 2 (2 s).
    expect(onReconnect).toHaveBeenLastCalledWith(1);
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not reset the count for a connection that closed at once — a 2xx alone proves nothing', async () => {
    // A server that answers 200 text/event-stream and closes immediately must
    // meet the backoff, not a 1 s loop with the count pinned at zero.
    const streams = [sseStream(), sseStream(), sseStream()];
    const fetchMock = stubFetch(
      new TypeError('Failed to fetch'),
      ...streams.map((s) => s.response)
    );
    const onReconnect = vi.fn();
    render({ onReconnect });
    await advance(0);
    await advance(1000); // attempt 1 → streams[0] opens
    streams[0]?.close();
    await advance(0);
    expect(onReconnect).toHaveBeenLastCalledWith(2);
    await advance(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('sends Last-Event-ID on a reconnect once the stream committed an id:', async () => {
    const first = sseStream();
    const second = sseStream();
    const fetchMock = stubFetch(first.response, second.response);
    render();
    await advance(0);
    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(firstHeaders?.['Last-Event-ID']).toBeUndefined();

    first.send(`id: 41\ndata: ${envelope(record)}\n\n`);
    first.close();
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const headers = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(headers['Last-Event-ID']).toBe('41');
    expect(headers.Accept).toBe('text/event-stream');
  });

  it('omits Last-Event-ID for a non-ASCII id and warns once, instead of sending the wrong bytes', async () => {
    const first = sseStream();
    const second = sseStream();
    const fetchMock = stubFetch(first.response, second.response, sseStream().response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render();
      await advance(0);
      first.send('id: \u{1F600}\u00fc\ndata: x\n\n');
      first.close();
      await advance(1000);
      const headers = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined;
      expect(headers?.['Last-Event-ID']).toBeUndefined();
      expect(headers?.Accept).toBe('text/event-stream');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/not ASCII/);

      second.close();
      await advance(2000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('uses a server-sent retry: as the reconnect delay', async () => {
    const first = sseStream();
    const fetchMock = stubFetch(first.response, sseStream().response);
    render();
    await advance(0);
    first.send('retry: 250\n\n');
    first.close();
    await advance(249);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps a retry: past the setTimeout range at 60 s instead of wrapping to 0', async () => {
    const first = sseStream();
    const fetchMock = stubFetch(first.response, sseStream().response);
    render();
    await advance(0);
    first.send('retry: 4294967296000\n\n');
    first.close();
    await advance(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('delivers the first event of a reconnect even when the previous stream died mid-block', async () => {
    // Connection 1 breaks between a data line and its blank line. Per spec that
    // pending data is discarded; if it leaked into connection 2, the JSON
    // there would fail to parse and the notification would be lost silently.
    const first = sseStream();
    const second = sseStream();
    stubFetch(first.response, second.response);
    const onNotification = vi.fn();
    render({ onNotification });
    await advance(0);
    first.send('data: {"type":"notification",\n');
    first.close();
    await advance(1000);
    second.send(`data: ${envelope(record)}\n\n`);
    await advance(0);
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onNotification).toHaveBeenCalledWith(record);
  });

  it('reports a throw out of onNotification to the page and keeps the stream open', async () => {
    const stream = sseStream();
    stubFetch(stream.response);
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const onNotification = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('consumer bug');
      })
      .mockImplementation(() => {});
    const onError = vi.fn();
    render({ onNotification, onError });
    await advance(0);

    stream.send(`data: ${envelope(record)}\n\ndata: ${envelope({ id: 'n2' })}\n\n`);
    await advance(0);
    expect(reportError).toHaveBeenCalledTimes(1);
    const reported = reportError.mock.calls[0]?.[0] as Error | undefined;
    expect(reported?.message).toBe('consumer bug');
    expect(onNotification).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(stream.cancelled()).toBe(0);
  });

  it('aborts the request on unmount and leaves no unhandled rejection', async () => {
    const stream = sseStream();
    stubFetch(stream.response);
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    const onError = vi.fn();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      render({ onError });
      await advance(0);

      dispose?.();
      dispose = undefined;
      expect(abortSpy).toHaveBeenCalledTimes(1);

      // The body errored with AbortError (see sseStream); the loop must treat
      // that as the end, not as a drop to report and retry.
      await advance(60_000);
      expect(onError).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
      abortSpy.mockRestore();
    }
  });

  it('ends a body that does not honour the abort itself, and cancels a pending reconnect', async () => {
    // Two exits at once: a reader on a stream that ignores the signal (only
    // reader.cancel() can settle it), and a backoff timer that must not fire
    // a fetch after unmount.
    const stream = sseStream(200, false);
    const fetchMock = stubFetch(stream.response, new TypeError('Failed to fetch'));
    const onError = vi.fn();
    render({ onError });
    await advance(0);

    dispose?.();
    dispose = undefined;
    await advance(60_000);
    expect(onError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect when unmounted during the backoff wait', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), sseStream().response);
    render();
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    dispose?.();
    dispose = undefined;
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
