/**
 * Zero-dependency Server-Sent Events reader for **one-shot POST streams** — the
 * pattern where a SvelteKit API route relays an LLM (or any) stream to the
 * browser as `text/event-stream`. It replaces the hand-rolled
 * `fetch` + frame-splitting loop that grows around every such endpoint.
 *
 * This is deliberately **not** an `EventSource` replacement:
 * - It POSTs a body (EventSource is GET-only) and takes an injectable `fetch`,
 *   so it also runs inside a SvelteKit `load`.
 * - It does **not** reconnect. The `retry:` field (and any unknown field) is
 *   parsed and ignored — a dropped connection surfaces as the underlying
 *   `fetch`/read error, which the consumer sees and decides what to do about.
 *
 * The parser implements the core of the WHATWG SSE stream-interpretation
 * algorithm and is **chunk-decomposition-invariant**: the emitted event
 * sequence is identical no matter how the byte stream is split into chunks —
 * including a split inside a CRLF pair or in the middle of a multi-byte UTF-8
 * character (a `TextDecoder` with `stream: true` coalesces the latter).
 *
 * Supported line terminators: `\r\n`, `\n`, and a lone `\r` (a `\r` followed by
 * a non-`\n` char is its own terminator). Fields: `data` (accumulated; multiple
 * `data:` lines join with `\n`), `event` (event name), `id` (event id; a value
 * containing a NUL is ignored per spec). Comment lines (starting with `:`) and
 * `retry:`/unknown fields are ignored. An event is dispatched on a blank line
 * and only if it carried at least one `data` line; a trailing buffer without a
 * final blank line is not dispatched. A single leading UTF-8 BOM is stripped.
 */

/** One parsed Server-Sent Event. */
export interface SseEvent {
  /** Event name from the `event:` field; `'message'` when omitted. */
  event: string;
  /** Data payload — all `data:` lines of the event joined with `\n`. */
  data: string;
  /** Last `id:` field seen at dispatch time, when the stream sets one. */
  id?: string;
}

/** Options for {@link streamSse}. */
export interface StreamSseOptions {
  /**
   * HTTP method for the request.
   * @default 'POST'
   */
  method?: string;
  /**
   * Extra request headers. These win over the defaults: `accept:
   * text/event-stream` is always sent, and `content-type: application/json` is
   * added for a non-string {@link body} — pass either key here to override.
   */
  headers?: Record<string, string>;
  /**
   * Request body. A string is sent verbatim (no `content-type` is forced); any
   * other value is JSON-stringified and sent with `content-type:
   * application/json`. `undefined`/`null` sends no body.
   */
  body?: unknown;
  /** Abort signal; aborting rejects the in-flight read with an `AbortError`. */
  signal?: AbortSignal;
  /**
   * `fetch` implementation to use — pass SvelteKit's `load` fetch to stream
   * during SSR / to inherit its request context.
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * Thrown by {@link streamSse} when the response is not usable: a non-2xx status,
 * or a 2xx response with no readable body. Carries the HTTP {@link status} and a
 * best-effort {@link body} text (raw — the consumer decides how to interpret it,
 * e.g. extract a JSON `message`).
 */
export class SseRequestError extends Error {
  /** HTTP status of the failing response. */
  readonly status: number;
  /** Best-effort response body text (`''` when there was nothing to read). */
  readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `SSE request failed with status ${status}`);
    this.name = 'SseRequestError';
    this.status = status;
    this.body = body;
  }
}

/** Build the request headers + serialized body from the options (caller headers win). */
function buildRequest(options: StreamSseOptions): {
  headers: Record<string, string>;
  body: BodyInit | undefined;
} {
  const headers: Record<string, string> = { accept: 'text/event-stream' };
  let body: BodyInit | undefined;

  const raw = options.body;
  if (raw !== undefined && raw !== null) {
    if (typeof raw === 'string') {
      body = raw;
    } else {
      body = JSON.stringify(raw);
      headers['content-type'] = 'application/json';
    }
  }

  if (options.headers) Object.assign(headers, options.headers);
  return { headers, body };
}

/**
 * Stream a POST (or other-method) endpoint that answers `text/event-stream` and
 * yield each parsed {@link SseEvent} as it is dispatched.
 *
 * The generator does not resolve until the server closes the stream (or it is
 * aborted / the consumer `break`s). On teardown — normal completion, early
 * `break`, `throw`, or abort — the underlying body reader is cancelled in a
 * `finally`, so a `break` out of the `for await` closes the HTTP connection
 * rather than leaking it. An abort propagates as an `AbortError`; it is not
 * swallowed.
 *
 * @param url - Endpoint to stream from.
 * @param options - Method, headers, body, abort signal, injectable `fetch`.
 * @returns An async generator of {@link SseEvent}s.
 * @throws {SseRequestError} when the response is non-2xx or has no body.
 * @example
 * ```typescript
 * import { streamSse } from '@urbicon-ui/sveltekit-utils/sse';
 *
 * const controller = new AbortController();
 * for await (const ev of streamSse('/api/chat', {
 *   body: { messages },
 *   signal: controller.signal
 * })) {
 *   if (ev.event === 'token') appendToken(JSON.parse(ev.data).text);
 *   else if (ev.event === 'error') throw new Error(JSON.parse(ev.data).message);
 * }
 * ```
 */
export async function* streamSse(
  url: string,
  options: StreamSseOptions = {}
): AsyncGenerator<SseEvent, void, undefined> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const { headers, body } = buildRequest(options);

  const response = await doFetch(url, {
    method: options.method ?? 'POST',
    headers,
    body,
    signal: options.signal
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new SseRequestError(response.status, text);
  }
  if (response.body == null) {
    throw new SseRequestError(
      response.status,
      '',
      `SSE response had no readable body (status ${response.status})`
    );
  }

  // `ignoreBOM: true` passes a leading BOM through as U+FEFF so we strip exactly
  // one ourselves (matching the SSE spec / EventSource), rather than relying on
  // the decoder's implicit stripping.
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const reader = response.body.getReader();

  let buffer = '';
  let streamStart = true;

  // Event being assembled across lines.
  let dataBuffer = '';
  let hasData = false;
  let eventType = '';
  // Last event id (persists across events until reset); `undefined` = never set.
  let lastEventId: string | undefined;

  function stripLeadingBom(): void {
    if (streamStart && buffer.length > 0) {
      if (buffer.charCodeAt(0) === 0xfeff) buffer = buffer.slice(1);
      streamStart = false;
    }
  }

  function handleLine(line: string): SseEvent | undefined {
    // Blank line → dispatch the accumulated event.
    if (line === '') {
      if (!hasData) {
        // No data field: reset event type + data, do not dispatch (id persists).
        eventType = '';
        dataBuffer = '';
        return undefined;
      }
      // Strip the single trailing '\n' accumulated after the last data line.
      const data = dataBuffer.endsWith('\n') ? dataBuffer.slice(0, -1) : dataBuffer;
      const event: SseEvent = { event: eventType === '' ? 'message' : eventType, data };
      if (lastEventId !== undefined) event.id = lastEventId;
      eventType = '';
      dataBuffer = '';
      hasData = false;
      return event;
    }

    // Comment line.
    if (line.charCodeAt(0) === 0x3a /* : */) return undefined;

    let field: string;
    let value: string;
    const colon = line.indexOf(':');
    if (colon === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      // Remove a single leading space after the colon; further spaces stay.
      if (value.charCodeAt(0) === 0x20 /* space */) value = value.slice(1);
    }

    switch (field) {
      case 'event':
        eventType = value;
        break;
      case 'data':
        dataBuffer += `${value}\n`;
        hasData = true;
        break;
      case 'id':
        // A value containing a NUL is ignored (spec); otherwise it persists.
        if (!value.includes('\u0000')) lastEventId = value;
        break;
      // 'retry' and any unknown field are ignored — this is a one-shot stream
      // with no reconnect (see the module doc).
    }
    return undefined;
  }

  // Emit every complete line currently in `buffer`, updating `buffer` to the
  // unconsumed remainder. When `ended` is false a trailing lone `\r` is held
  // back, because the next chunk might begin with `\n` (a split CRLF pair).
  function* consume(ended: boolean): Generator<SseEvent, void, undefined> {
    let start = 0;
    for (;;) {
      const idxN = buffer.indexOf('\n', start);
      const idxR = buffer.indexOf('\r', start);
      if (idxN === -1 && idxR === -1) break;

      let term: number;
      let isCr: boolean;
      if (idxN === -1) {
        term = idxR;
        isCr = true;
      } else if (idxR === -1 || idxN < idxR) {
        term = idxN;
        isCr = false;
      } else {
        term = idxR;
        isCr = true;
      }

      // Hold a trailing CR that could be the first half of a CRLF split across
      // chunk boundaries — unless the stream has ended (then it terminates).
      if (isCr && term === buffer.length - 1 && !ended) break;

      const line = buffer.slice(start, term);
      let next = term + 1;
      if (isCr && buffer.charCodeAt(term + 1) === 0x0a /* \n */) next = term + 2;
      start = next;

      const event = handleLine(line);
      if (event) yield event;
    }
    buffer = buffer.slice(start);
  }

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      stripLeadingBom();
      yield* consume(false);
    }
    // Flush any bytes the decoder is still holding, then interpret the tail. A
    // held trailing `\r` now terminates its line; an incomplete final line (no
    // terminator) stays in `buffer` and is discarded (spec).
    buffer += decoder.decode();
    stripLeadingBom();
    yield* consume(true);
  } finally {
    // Cancel closes the connection on an early `break`/`throw`; on a fully
    // drained or already-errored (aborted) stream it is a best-effort no-op.
    try {
      await reader.cancel();
    } catch {
      /* teardown is best-effort */
    }
  }
}
