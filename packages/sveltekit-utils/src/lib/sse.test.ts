import { describe, expect, it, vi } from 'vitest';
import { type SseEvent, SseRequestError, streamSse } from './sse';

const encoder = new TextEncoder();

/** Build a ReadableStream that emits `bytes` split into fixed-size chunks. */
function streamOf(
  bytes: Uint8Array,
  chunkSize: number,
  hooks?: { onCancel?: () => void }
): ReadableStream<Uint8Array> {
  const size = chunkSize <= 0 ? Math.max(bytes.length, 1) : chunkSize;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) {
        controller.enqueue(bytes.slice(i, i + size));
      }
      controller.close();
    },
    cancel() {
      hooks?.onCancel?.();
    }
  });
}

/** A 200 `text/event-stream` Response carrying `text`, chunked at the byte level. */
function sseResponse(text: string, chunkSize: number, init?: ResponseInit): Response {
  return new Response(streamOf(encoder.encode(text), chunkSize), init);
}

/** An injectable fetch that always returns `response`. */
function fetchReturning(response: Response): typeof globalThis.fetch {
  return vi.fn(async () => response) as unknown as typeof globalThis.fetch;
}

/** A recording fetch: captures the RequestInit it was called with. */
function recordingFetch(response: Response): {
  fetch: typeof globalThis.fetch;
  init(): RequestInit & { headers: Record<string, string> };
} {
  const calls: Array<RequestInit> = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    calls.push(init);
    return response;
  }) as unknown as typeof globalThis.fetch;
  return {
    fetch,
    init: () => calls[0] as RequestInit & { headers: Record<string, string> }
  };
}

/** Drain a stream and collect every dispatched event. */
async function collect(text: string, chunkSize: number): Promise<SseEvent[]> {
  const out: SseEvent[] = [];
  for await (const ev of streamSse('/x', { fetch: fetchReturning(sseResponse(text, chunkSize)) })) {
    out.push(ev);
  }
  return out;
}

// Chunk sizes exercised for decomposition-invariance (1/2/3 split multi-byte
// chars and CRLF pairs; a huge size delivers the whole string in one chunk).
const CHUNK_SIZES = [1, 2, 3, 7, 50, 1_000_000];

describe('streamSse — parsing', () => {
  it('parses a sequence of event/data frames', async () => {
    const text =
      'event: token\ndata: {"t":"a"}\n\n' +
      'event: token\ndata: {"t":"b"}\n\n' +
      'event: done\ndata: [DONE]\n\n';
    expect(await collect(text, 1_000_000)).toEqual([
      { event: 'token', data: '{"t":"a"}' },
      { event: 'token', data: '{"t":"b"}' },
      { event: 'done', data: '[DONE]' }
    ]);
  });

  it('defaults the event name to "message" when no event field is present', async () => {
    expect(await collect('data: hello\n\n', 1_000_000)).toEqual([
      { event: 'message', data: 'hello' }
    ]);
  });

  it.each(CHUNK_SIZES)('is chunk-invariant for LF frames (chunk=%i)', async (size) => {
    const text = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
    expect(await collect(text, size)).toEqual([
      { event: 'a', data: '1' },
      { event: 'b', data: '2' }
    ]);
  });

  it.each(CHUNK_SIZES)('is chunk-invariant for CRLF frames (chunk=%i)', async (size) => {
    const text = 'event: a\r\ndata: 1\r\n\r\nevent: b\r\ndata: 2\r\n\r\n';
    expect(await collect(text, size)).toEqual([
      { event: 'a', data: '1' },
      { event: 'b', data: '2' }
    ]);
  });

  it.each(CHUNK_SIZES)(
    'is chunk-invariant with a multi-byte emoji in data (chunk=%i)',
    async (size) => {
      // 🎉 is 4 UTF-8 bytes; chunk sizes 1/2/3 split it mid-character.
      const text = 'data: hi 🎉 there\n\n';
      expect(await collect(text, size)).toEqual([{ event: 'message', data: 'hi 🎉 there' }]);
    }
  );

  it.each(CHUNK_SIZES)(
    'treats a CRLF split across the chunk boundary as one line break (chunk=%i)',
    async (size) => {
      const text = 'data: line1\r\ndata: line2\r\n\r\n';
      // If \r\n were mis-read as two terminators, line1 would dispatch alone.
      expect(await collect(text, size)).toEqual([{ event: 'message', data: 'line1\nline2' }]);
    }
  );

  it('joins multiple data lines with \\n', async () => {
    expect(await collect('data: a\ndata: b\ndata: c\n\n', 1_000_000)).toEqual([
      { event: 'message', data: 'a\nb\nc' }
    ]);
  });

  it('removes exactly one leading space after the field colon', async () => {
    const one = await collect('data: x\n\n', 1_000_000);
    const none = await collect('data:x\n\n', 1_000_000);
    const two = await collect('data:  x\n\n', 1_000_000);
    expect(one[0]?.data).toBe('x');
    expect(none[0]?.data).toBe('x');
    expect(two[0]?.data).toBe(' x'); // second space preserved
  });

  it('ignores comment lines (starting with a colon)', async () => {
    const text = ': keep-alive\ndata: x\n: another comment\n\n';
    expect(await collect(text, 1_000_000)).toEqual([{ event: 'message', data: 'x' }]);
  });

  it('treats a field line with no colon as that field with an empty value', async () => {
    // Bare `data` line → empty data value; unknown bare fields are ignored.
    expect(await collect('data\n\n', 1_000_000)).toEqual([{ event: 'message', data: '' }]);
    expect(await collect('nonsense\ndata: y\n\n', 1_000_000)).toEqual([
      { event: 'message', data: 'y' }
    ]);
  });

  it('does not dispatch an event that carried no data line', async () => {
    // `event: ping` with no data → discarded; the following data-only event fires.
    expect(await collect('event: ping\n\ndata: y\n\n', 1_000_000)).toEqual([
      { event: 'message', data: 'y' }
    ]);
  });

  it.each(CHUNK_SIZES)('handles lone-\\r terminators (chunk=%i)', async (size) => {
    const text = 'data: a\r\rdata: b\r\r';
    expect(await collect(text, size)).toEqual([
      { event: 'message', data: 'a' },
      { event: 'message', data: 'b' }
    ]);
  });
});

describe('streamSse — BOM & trailing buffer', () => {
  function bomResponse(chunkSize: number): Response {
    const body = encoder.encode('data: hi\n\n');
    const bytes = new Uint8Array(3 + body.length);
    bytes.set([0xef, 0xbb, 0xbf], 0); // UTF-8 BOM
    bytes.set(body, 3);
    return new Response(streamOf(bytes, chunkSize));
  }

  it.each([1, 2, 3, 1_000_000])('strips a single leading BOM (chunk=%i)', async (size) => {
    const out: SseEvent[] = [];
    for await (const ev of streamSse('/x', { fetch: fetchReturning(bomResponse(size)) })) {
      out.push(ev);
    }
    expect(out).toEqual([{ event: 'message', data: 'hi' }]);
  });

  it('does not dispatch a trailing buffer without a final blank line', async () => {
    // Second frame has no terminating blank line → dropped.
    expect(await collect('data: a\n\ndata: b', 1_000_000)).toEqual([
      { event: 'message', data: 'a' }
    ]);
  });
});

describe('streamSse — id field', () => {
  it('attaches a set id', async () => {
    expect(await collect('id: 1\ndata: a\n\n', 1_000_000)).toEqual([
      { event: 'message', data: 'a', id: '1' }
    ]);
  });

  it('overwrites the id on a later event', async () => {
    const out = await collect('id: 1\ndata: a\n\nid: 2\ndata: b\n\n', 1_000_000);
    expect(out.map((e) => e.id)).toEqual(['1', '2']);
  });

  it('persists the last id across events that omit it', async () => {
    const out = await collect('id: 7\ndata: a\n\ndata: b\n\n', 1_000_000);
    expect(out.map((e) => e.id)).toEqual(['7', '7']);
  });

  it('ignores an id field whose value contains a NUL (persisting the prior id)', async () => {
    const text = 'id: 1\ndata: a\n\nid: b\u0000d\ndata: b\n\n';
    const out = await collect(text, 1_000_000);
    expect(out.map((e) => e.id)).toEqual(['1', '1']);
  });

  it('leaves id undefined when the stream never sets one', async () => {
    const [ev] = await collect('data: a\n\n', 1_000_000);
    expect(ev.id).toBeUndefined();
    expect('id' in ev).toBe(false);
  });

  it('leaves id undefined when the only id field is NUL-poisoned', async () => {
    const [ev] = await collect('id: x\u0000y\ndata: a\n\n', 1_000_000);
    expect(ev.id).toBeUndefined();
  });
});

describe('streamSse — request shaping', () => {
  it('serializes an object body as JSON with content-type application/json', async () => {
    const rec = recordingFetch(sseResponse('data: ok\n\n', 1_000_000));
    for await (const _ of streamSse('/api', { body: { a: 1 }, fetch: rec.fetch })) void _;
    const init = rec.init();
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers.accept).toBe('text/event-stream');
  });

  it('sends a string body verbatim and forces no content-type', async () => {
    const rec = recordingFetch(sseResponse('data: ok\n\n', 1_000_000));
    for await (const _ of streamSse('/api', { body: 'raw-payload', fetch: rec.fetch })) void _;
    const init = rec.init();
    expect(init.body).toBe('raw-payload');
    expect(init.headers['content-type']).toBeUndefined();
  });

  it('lets caller headers win over the defaults', async () => {
    const rec = recordingFetch(sseResponse('data: ok\n\n', 1_000_000));
    for await (const _ of streamSse('/api', {
      method: 'PUT',
      body: { a: 1 },
      headers: { 'content-type': 'text/plain', 'x-custom': 'yes' },
      fetch: rec.fetch
    })) {
      void _;
    }
    const init = rec.init();
    expect(init.method).toBe('PUT');
    expect(init.headers['content-type']).toBe('text/plain'); // caller override wins
    expect(init.headers['x-custom']).toBe('yes');
  });

  it('uses globalThis.fetch when none is injected', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(sseResponse('data: ok\n\n', 1_000_000));
    try {
      const out = await (async () => {
        const events: SseEvent[] = [];
        for await (const ev of streamSse('/api', { body: { a: 1 } })) events.push(ev);
        return events;
      })();
      expect(out).toEqual([{ event: 'message', data: 'ok' }]);
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('streamSse — errors', () => {
  it('throws SseRequestError with status + body on a non-2xx response', async () => {
    const fetch = fetchReturning(new Response('upstream exploded', { status: 500 }));
    const gen = streamSse('/api', { fetch });
    let err: unknown;
    try {
      await gen.next();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SseRequestError);
    expect((err as SseRequestError).status).toBe(500);
    expect((err as SseRequestError).body).toBe('upstream exploded');
  });

  it('throws SseRequestError when a 2xx response has no body', async () => {
    const fetch = fetchReturning(new Response(null, { status: 200 }));
    const gen = streamSse('/api', { fetch });
    let err: unknown;
    try {
      await gen.next();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SseRequestError);
    expect((err as SseRequestError).status).toBe(200);
    expect((err as SseRequestError).message).toMatch(/no readable body/i);
  });
});

describe('streamSse — teardown', () => {
  it('propagates an AbortError thrown mid-stream', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode('event: token\ndata: 1\n\n'));
      },
      pull(streamController) {
        // No more data until the signal aborts, at which point we error like a
        // real fetch body would.
        return new Promise<void>((resolve) => {
          if (signal.aborted) {
            streamController.error(new DOMException('Aborted', 'AbortError'));
            resolve();
            return;
          }
          signal.addEventListener(
            'abort',
            () => {
              streamController.error(new DOMException('Aborted', 'AbortError'));
              resolve();
            },
            { once: true }
          );
        });
      }
    });

    const fetch = fetchReturning(new Response(stream));
    const gen = streamSse('/api', { fetch, signal });

    const first = await gen.next();
    expect(first.value).toEqual({ event: 'token', data: '1' });

    controller.abort();

    let err: unknown;
    try {
      await gen.next();
    } catch (e) {
      err = e;
    }
    expect((err as Error).name).toBe('AbortError');
  });

  it('cancels the body reader when the consumer breaks early', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Two full frames, stream left open (a long-lived connection).
        controller.enqueue(encoder.encode('event: a\ndata: 1\n\n'));
        controller.enqueue(encoder.encode('event: b\ndata: 2\n\n'));
      },
      cancel() {
        cancelled = true;
      }
    });

    const fetch = fetchReturning(new Response(stream));
    const seen: SseEvent[] = [];
    for await (const ev of streamSse('/api', { fetch })) {
      seen.push(ev);
      break; // early break after the first event
    }

    expect(seen).toEqual([{ event: 'a', data: '1' }]);
    expect(cancelled).toBe(true);
  });
});
