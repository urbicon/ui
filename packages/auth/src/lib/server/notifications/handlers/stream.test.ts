import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { createSSEManager } from '../sse.js';
import { createStreamHandler } from './stream.js';

function mockEvent(user?: { id: string }, signal?: AbortSignal): RequestEvent {
  return {
    locals: user ? { user } : {},
    request: new Request('http://localhost/api/notifications/stream', signal ? { signal } : {})
  } as unknown as RequestEvent;
}

const decode = (chunk: Uint8Array | undefined) => new TextDecoder().decode(chunk);

describe('createStreamHandler', () => {
  it('returns 401 for an unauthenticated request', async () => {
    const res = await createStreamHandler(createSSEManager()).GET(mockEvent());
    expect(res.status).toBe(401);
  });

  it('registers the connection and emits an initial heartbeat', async () => {
    const sse = createSSEManager();
    const res = await createStreamHandler(sse, { heartbeatMs: 0 }).GET(mockEvent({ id: 'u1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(sse.isOnline('u1')).toBe(true);

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(decode(value)).toContain('heartbeat');
    await reader.cancel();
  });

  it('does not set the HTTP/2-illegal Connection header', async () => {
    const res = await createStreamHandler(createSSEManager(), { heartbeatMs: 0 }).GET(
      mockEvent({ id: 'u1' })
    );
    expect(res.headers.get('Connection')).toBeNull();
    await res.body!.cancel();
  });

  // Cluster C.1: the previous cancel() was a no-op, so disconnected clients
  // leaked into the registry forever and isOnline drifted.
  it('removes the connection when the stream is cancelled (client disconnect)', async () => {
    const sse = createSSEManager();
    const res = await createStreamHandler(sse, { heartbeatMs: 0 }).GET(mockEvent({ id: 'u1' }));
    expect(sse.isOnline('u1')).toBe(true);

    await res.body!.cancel();

    expect(sse.isOnline('u1')).toBe(false);
    expect(sse.connectionCount('u1')).toBe(0);
  });

  // Some runtimes (e.g. Cloudflare Workers) signal a disconnect via the request
  // AbortSignal rather than calling stream cancel() — that path must clean up too.
  it('removes the connection when the request is aborted (runtime abort path)', async () => {
    const sse = createSSEManager();
    const ac = new AbortController();
    const res = await createStreamHandler(sse, { heartbeatMs: 0 }).GET(
      mockEvent({ id: 'u1' }, ac.signal)
    );
    expect(sse.isOnline('u1')).toBe(true);

    ac.abort();

    expect(sse.isOnline('u1')).toBe(false);
    expect(sse.connectionCount('u1')).toBe(0);
    await res.body!.cancel(); // idempotent no-op after the abort already cleaned up
  });

  // Cluster C.3: a per-user cap bounds FDs/memory.
  it('refuses connections beyond the per-user limit with 429', async () => {
    const sse = createSSEManager();
    const handler = createStreamHandler(sse, { maxConnectionsPerUser: 2, heartbeatMs: 0 });

    const r1 = await handler.GET(mockEvent({ id: 'u1' }));
    const r2 = await handler.GET(mockEvent({ id: 'u1' }));
    const r3 = await handler.GET(mockEvent({ id: 'u1' }));

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect((await r3.json()).code, 'connection cap carries the machine code').toBe('rate_limited');

    // A different user is unaffected.
    expect((await handler.GET(mockEvent({ id: 'u2' }))).status).toBe(200);

    await r1.body!.cancel();
    await r2.body!.cancel();
  });

  it('frees a slot after a connection is cancelled, allowing a new one', async () => {
    const sse = createSSEManager();
    const handler = createStreamHandler(sse, { maxConnectionsPerUser: 1, heartbeatMs: 0 });

    const r1 = await handler.GET(mockEvent({ id: 'u1' }));
    expect(r1.status).toBe(200);
    expect((await handler.GET(mockEvent({ id: 'u1' }))).status).toBe(429);

    await r1.body!.cancel();

    // Slot freed → a fresh connection is accepted again.
    const r3 = await handler.GET(mockEvent({ id: 'u1' }));
    expect(r3.status).toBe(200);
    await r3.body!.cancel();
  });
});
