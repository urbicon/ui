/**
 * Server-sent events read off a `fetch` body, parsed per WHATWG HTML
 * § 9.2.6 "Parsing an event stream".
 *
 * Why not `EventSource`: it hides the HTTP response. A refused stream
 * (non-2xx) reaches it as an opaque `error` event without status or body, so
 * a client on it cannot tell a network drop from a `429 connection_limit` and
 * retries both. Off `fetch`, the response stays in the caller's hands.
 */

export interface ServerSentEvent {
  /** The `event:` field; `'message'` when the block carried none. */
  type: string;
  /** The `data:` lines joined with `\n`, the trailing newline removed. */
  data: string;
  /** The last event ID committed by the stream so far; `''` until an `id:` arrives. */
  lastEventId: string;
}

export interface EventStreamParser {
  /** Feed one chunk of bytes; returns every event the chunk completed, in order. */
  push(chunk: Uint8Array): ServerSentEvent[];
  /** Last event ID string (the value to send as `Last-Event-ID` on a reconnect). */
  readonly lastEventId: string;
  /** Reconnection time from the last `retry:` field, in ms; `undefined` until one arrives. */
  readonly retry: number | undefined;
}

const LF = 10;
const CR = 13;

export function createEventStreamParser(): EventStreamParser {
  // `stream: true` below keeps a multi-byte sequence that straddles two chunks
  // intact; the default `ignoreBOM: false` drops a leading BOM, as the spec asks.
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let data = '';
  let idBuffer = '';
  let lastEventId = '';
  let retry: number | undefined;

  function dispatch(out: ServerSentEvent[]): void {
    // Spec order: the ID commits on every blank line, *before* the empty-data
    // check — an `id:` block without data still moves the reconnect cursor.
    lastEventId = idBuffer;
    if (data === '') {
      eventType = '';
      return;
    }
    out.push({
      type: eventType || 'message',
      data: data.endsWith('\n') ? data.slice(0, -1) : data,
      lastEventId
    });
    eventType = '';
    data = '';
  }

  function processLine(line: string, out: ServerSentEvent[]): void {
    if (line === '') {
      dispatch(out);
      return;
    }
    if (line.charCodeAt(0) === 58 /* ':' */) return; // comment (the server's heartbeat)

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.charCodeAt(0) === 32 /* ' ' */) value = value.slice(1);

    switch (field) {
      case 'event':
        eventType = value;
        break;
      case 'data':
        data += `${value}\n`;
        break;
      case 'id':
        if (!value.includes('\0')) idBuffer = value;
        break;
      case 'retry':
        if (/^\d+$/.test(value)) retry = Number(value);
        break;
      // Any other field is ignored, per spec.
    }
  }

  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      const out: ServerSentEvent[] = [];
      let start = 0;
      let i = 0;
      while (i < buffer.length) {
        const c = buffer.charCodeAt(i);
        if (c === LF) {
          processLine(buffer.slice(start, i), out);
          start = ++i;
        } else if (c === CR) {
          // A CR at the very end may be the first half of a CRLF whose LF is
          // still in flight — leave it for the next chunk.
          if (i + 1 === buffer.length) break;
          processLine(buffer.slice(start, i), out);
          i += buffer.charCodeAt(i + 1) === LF ? 2 : 1;
          start = i;
        } else {
          i++;
        }
      }
      buffer = buffer.slice(start);
      return out;
    },
    get lastEventId() {
      return lastEventId;
    },
    get retry() {
      return retry;
    }
  };
}

/**
 * Pump `body` through `parser`, handing every completed event to `onEvent`.
 * Resolves when the server closes the stream or `signal` aborts; rejects when
 * the transport fails (a real `fetch` errors the body on abort, which is why
 * the caller checks `signal.aborted` before treating a rejection as a drop).
 */
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  parser: EventStreamParser,
  onEvent: (event: ServerSentEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  // A pending `read()` on a body that never errors (a mock, a proxy that keeps
  // the socket) would outlive the abort; cancelling the reader settles it.
  const cancel = () => void reader.cancel().catch(() => {});
  if (signal.aborted) {
    cancel();
    return;
  }
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      for (const event of parser.push(value)) onEvent(event);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
