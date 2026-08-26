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

/**
 * What survives a reconnect: the last event ID string (sent as
 * `Last-Event-ID`, and the ID the next connection's events carry until the
 * server sends a new `id:`) and the reconnection time. Owned by the
 * connection loop and written by every parser it creates. The parser's own
 * line and event buffers die with the connection — which is what "any pending
 * data must be discarded" at end of stream requires, with no reset step to
 * forget; an `id:` the dead connection never committed goes with them.
 */
export interface EventStreamCursor {
  lastEventId: string;
  retry: number | undefined;
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

/**
 * One parser per connection. `cursor` is shared with the next connection's
 * parser; everything else here is scoped to this stream.
 */
export function createEventStreamParser(
  cursor: EventStreamCursor = { lastEventId: '', retry: undefined }
): EventStreamParser {
  // `stream: true` below keeps a multi-byte sequence that straddles two chunks
  // intact; the default `ignoreBOM: false` drops a leading BOM, as the spec asks.
  const decoder = new TextDecoder();
  let buffer = '';
  // A CR ends the line where it stands; an LF right after it belongs to the
  // same line break — also when that LF is the first byte of the next chunk.
  let skipLF = false;
  let eventType = '';
  let data = '';
  // Seeded from the committed ID, as `EventSource` seeds a reconnect's parser:
  // the first blank line of the new stream re-commits it, so its events carry
  // the ID the previous connection ended on.
  let idBuffer = cursor.lastEventId;

  function dispatch(out: ServerSentEvent[]): void {
    // Spec order: the ID commits on every blank line, *before* the empty-data
    // check — an `id:` block without data still moves the reconnect cursor.
    cursor.lastEventId = idBuffer;
    if (data === '') {
      eventType = '';
      return;
    }
    out.push({
      type: eventType || 'message',
      data: data.endsWith('\n') ? data.slice(0, -1) : data,
      lastEventId: cursor.lastEventId
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
        if (/^\d+$/.test(value)) cursor.retry = Number(value);
        break;
      // Any other field is ignored, per spec.
    }
  }

  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      const out: ServerSentEvent[] = [];
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer.charCodeAt(i);
        if (skipLF) {
          skipLF = false;
          if (c === LF) {
            start = i + 1;
            continue;
          }
        }
        if (c === LF || c === CR) {
          processLine(buffer.slice(start, i), out);
          start = i + 1;
          skipLF = c === CR;
        }
      }
      buffer = buffer.slice(start);
      return out;
    },
    get lastEventId() {
      return cursor.lastEventId;
    },
    get retry() {
      return cursor.retry;
    }
  };
}

/**
 * The `Last-Event-ID` value for a `fetch` header, or `undefined` when the ID
 * cannot be sent as `EventSource` would send it. `EventSource` puts the ID's
 * UTF-8 bytes on the wire; `fetch` header values are byte strings, and the
 * engines disagree on how a string becomes bytes — Chromium writes one byte
 * per code unit (`ü` → `fc`, an emoji throws), WebKit re-encodes as UTF-8
 * (measured; pre-mapping the UTF-8 bytes onto code units then double-encodes
 * there). ASCII is the same bytes everywhere; anything else is not sent.
 */
export function lastEventIdHeader(id: string): string | undefined {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII is the whole point
  return /^[\x00-\x7f]*$/.test(id) ? id : undefined;
}

/**
 * Pump `body` through `parser`, handing every completed event to `onEvent`.
 * Resolves when the server closes the stream or `signal` aborts; rejects when
 * the transport fails (a real `fetch` errors the body on abort, which is why
 * the caller checks `signal.aborted` before treating a rejection as a drop),
 * or when `onEvent` throws. However the loop ends, the body is cancelled —
 * a connection left open by a throw would still count against the server's
 * per-user cap.
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
    cancel();
  }
}
