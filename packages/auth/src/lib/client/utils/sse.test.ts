import { describe, expect, it } from 'vitest';
import {
  createEventStreamParser,
  lastEventIdHeader,
  readEventStream,
  type ServerSentEvent
} from './sse.js';

const enc = new TextEncoder();
const bytes = (text: string) => enc.encode(text);

/** Feed the whole text as one chunk and return the events it completes. */
function parse(text: string): ServerSentEvent[] {
  return createEventStreamParser().push(bytes(text));
}

describe('createEventStreamParser', () => {
  it('dispatches a bare data line as a "message" event', () => {
    expect(parse('data: hello\n\n')).toEqual([{ type: 'message', data: 'hello', lastEventId: '' }]);
  });

  it('takes the event type from the event: field', () => {
    expect(parse('event: notification\ndata: x\n\n')).toEqual([
      { type: 'notification', data: 'x', lastEventId: '' }
    ]);
  });

  it('joins multiple data: lines with LF and drops the trailing one', () => {
    expect(parse('data: {"a":\ndata: 1}\n\n')[0]?.data).toBe('{"a":\n1}');
  });

  it('accepts CRLF, CR and LF line endings, mixed', () => {
    expect(parse('data: a\r\n\r\ndata: b\r\rdata: c\n\n').map((e) => e.data)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('treats a CRLF split across two chunks as one line break, not two', () => {
    const parser = createEventStreamParser();
    // The CR after "data: a" arrives in one chunk, its LF in the next. Seen as
    // two breaks, the LF would read as a blank line and split one two-line
    // event into two events.
    const first = parser.push(bytes('data: a\r'));
    const second = parser.push(bytes('\ndata: b\n\n'));
    expect(first).toEqual([]);
    expect(second.map((e) => e.data)).toEqual(['a\nb']);
  });

  it('ignores comment lines (the heartbeat) and does not dispatch on them', () => {
    expect(parse(': heartbeat\n\n: heartbeat\n\ndata: x\n\n')).toHaveLength(1);
  });

  it('commits id: on the blank line and carries it on every later event', () => {
    const parser = createEventStreamParser();
    const events = parser.push(bytes('id: 7\ndata: a\n\ndata: b\n\n'));
    expect(events.map((e) => e.lastEventId)).toEqual(['7', '7']);
    expect(parser.lastEventId).toBe('7');
  });

  it('commits an id: block without data, without dispatching an event', () => {
    const parser = createEventStreamParser();
    expect(parser.push(bytes('id: cursor\n\n'))).toEqual([]);
    expect(parser.lastEventId).toBe('cursor');
  });

  it('ignores an id: containing NUL and resets on an empty id:', () => {
    const parser = createEventStreamParser();
    parser.push(bytes('id: 1\n\n'));
    parser.push(bytes('id: bad\0id\n\n'));
    expect(parser.lastEventId).toBe('1');
    parser.push(bytes('id\n\n'));
    expect(parser.lastEventId).toBe('');
  });

  it('reads a numeric retry: and ignores a non-numeric one', () => {
    const parser = createEventStreamParser();
    expect(parser.retry).toBeUndefined();
    parser.push(bytes('retry: 2500\n\n'));
    expect(parser.retry).toBe(2500);
    parser.push(bytes('retry: soon\n\n'));
    expect(parser.retry).toBe(2500);
  });

  it('strips exactly one leading space from a field value', () => {
    expect(parse('data:  two spaces\n\n')[0]?.data).toBe(' two spaces');
    expect(parse('data:nospace\n\n')[0]?.data).toBe('nospace');
  });

  it('dispatches an empty-data event for a field with no colon', () => {
    expect(parse('data\n\n')).toEqual([{ type: 'message', data: '', lastEventId: '' }]);
  });

  it('dispatches nothing for a blank line with no data buffered', () => {
    expect(parse('\n\n\n')).toEqual([]);
    expect(parse('event: typed\n\ndata: x\n\n')).toEqual([
      // The type buffer resets on the empty dispatch: "typed" must not leak
      // onto the next block.
      { type: 'message', data: 'x', lastEventId: '' }
    ]);
  });

  it('ignores fields it does not know', () => {
    expect(parse('foo: bar\ndata: x\n\n')).toEqual([
      { type: 'message', data: 'x', lastEventId: '' }
    ]);
  });

  it('keeps a multi-byte character intact across a chunk boundary', () => {
    const parser = createEventStreamParser();
    const utf8 = bytes('data: Müll\n\n');
    const cut = utf8.indexOf(0xc3) + 1; // between the two bytes of "ü"
    expect(parser.push(utf8.slice(0, cut))).toEqual([]);
    expect(parser.push(utf8.slice(cut))[0]?.data).toBe('Müll');
  });

  it('drops a leading BOM', () => {
    const parser = createEventStreamParser();
    expect(parser.push(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('data: x\n\n')]))).toEqual([
      { type: 'message', data: 'x', lastEventId: '' }
    ]);
  });

  it('does not dispatch a block the stream ended in the middle of', () => {
    expect(parse('data: partial\n')).toEqual([]);
    expect(parse('data: partial')).toEqual([]);
  });

  it('ends a line at a CR as the last byte — nothing is held back for the next chunk', () => {
    // `data: x\n\r`: the CR closes an empty line, which dispatches x right
    // there, not when (or if) another byte arrives.
    expect(parse('data: x\n\r').map((e) => e.data)).toEqual(['x']);
    expect(parse('data: x\rdata: y\r\r').map((e) => e.data)).toEqual(['x\ny']);
  });

  it('shares only lastEventId and retry between connections; a half-received block dies with its parser', () => {
    const cursor = { lastEventId: '', retry: undefined };
    const first = createEventStreamParser(cursor);
    // Connection 1 dies between the data line and the blank line.
    expect(first.push(bytes('id: 9\nretry: 500\ndata: {"half":\n'))).toEqual([]);
    expect(cursor).toEqual({ lastEventId: '', retry: 500 });
    // Connection 2 starts clean: no "{"half":" prefix leaks into its first event.
    const second = createEventStreamParser(cursor);
    expect(second.push(bytes('event: done\ndata: ok\n\n'))).toEqual([
      { type: 'done', data: 'ok', lastEventId: '' }
    ]);
    expect(second.retry).toBe(500);
  });

  it("carries a committed id onto the next connection's events until the server sends a new one", () => {
    const cursor = { lastEventId: '', retry: undefined };
    createEventStreamParser(cursor).push(bytes('id: cursor\ndata: x\n\n'));
    const next = createEventStreamParser(cursor);
    expect(next.push(bytes('event: done\ndata: ok\n\n'))).toEqual([
      { type: 'done', data: 'ok', lastEventId: 'cursor' }
    ]);
    expect(next.push(bytes('id: fresh\ndata: y\n\n'))[0]?.lastEventId).toBe('fresh');
  });
});

describe('lastEventIdHeader', () => {
  it('passes an ASCII id through unchanged', () => {
    expect(lastEventIdHeader('cursor-41')).toBe('cursor-41');
    expect(lastEventIdHeader('')).toBe('');
  });

  it('refuses a non-ASCII id rather than guess how the engine turns it into bytes', () => {
    expect(lastEventIdHeader('ü')).toBeUndefined();
    expect(lastEventIdHeader('\u{1F600}')).toBeUndefined();
    expect(lastEventIdHeader('a\u00ffb')).toBeUndefined();
  });
});

function streamOf(): {
  body: ReadableStream<Uint8Array>;
  send: (text: string) => void;
  close: () => void;
  fail: (error: unknown) => void;
  cancelled: () => number;
} {
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
  return {
    body,
    send: (text) => controller.enqueue(bytes(text)),
    close: () => controller.close(),
    fail: (error) => controller.error(error),
    cancelled: () => cancelled
  };
}

describe('readEventStream', () => {
  it('hands every completed event to onEvent and resolves when the server closes', async () => {
    const { body, send, close } = streamOf();
    const seen: string[] = [];
    const done = readEventStream(
      body,
      createEventStreamParser(),
      (e) => seen.push(e.data),
      new AbortController().signal
    );
    send('data: 1\n\n');
    send('data: 2\n\ndata: 3\n\n');
    close();
    await done;
    expect(seen).toEqual(['1', '2', '3']);
  });

  it('settles a pending read on abort instead of leaving it pending — no rejection', async () => {
    // The body never errors and never closes (a mock, a proxy holding the
    // socket): only cancelling the reader can end the loop.
    const { body } = streamOf();
    const controller = new AbortController();
    const done = readEventStream(body, createEventStreamParser(), () => {}, controller.signal);
    controller.abort();
    await expect(done).resolves.toBeUndefined();
  });

  it('returns at once on an already-aborted signal', async () => {
    const { body } = streamOf();
    const controller = new AbortController();
    controller.abort();
    await expect(
      readEventStream(body, createEventStreamParser(), () => {}, controller.signal)
    ).resolves.toBeUndefined();
  });

  it('cancels the body when onEvent throws, so the connection does not stay open', async () => {
    const { body, send, cancelled } = streamOf();
    const done = readEventStream(
      body,
      createEventStreamParser(),
      () => {
        throw new Error('consumer bug');
      },
      new AbortController().signal
    );
    send('data: x\n\n');
    await expect(done).rejects.toThrow('consumer bug');
    expect(cancelled()).toBe(1);
  });

  it('rejects when the transport fails, with the transport error', async () => {
    const { body, fail } = streamOf();
    const done = readEventStream(
      body,
      createEventStreamParser(),
      () => {},
      new AbortController().signal
    );
    fail(new TypeError('network error'));
    await expect(done).rejects.toThrow('network error');
  });
});
