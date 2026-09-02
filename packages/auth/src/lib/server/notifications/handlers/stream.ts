import type { RequestHandler } from '@sveltejs/kit';
import { privateEndpoints } from '../../handlers/_shared.js';
import { authError } from '../../handlers/errors.js';
import type { SSEManager } from '../sse.js';
import { localsUserId } from './locals-user.js';

export interface StreamHandlerOptions {
  /**
   * Heartbeat interval in ms. A comment line (`: heartbeat`) is sent
   * periodically to keep the stream alive through idle-timeout proxies and to
   * detect a dead socket (enqueue then throws → the connection is pruned).
   * Default 25_000 (25s). Set 0 to disable.
   */
  heartbeatMs?: number;
  /**
   * Max concurrent SSE connections per user. Requests beyond this are refused
   * with 429, bounding the file descriptors / memory a single account can
   * hold open. Default 5.
   */
  maxConnectionsPerUser?: number;
}

export function createStreamHandler(
  sse: SSEManager,
  options?: StreamHandlerOptions
): { GET: RequestHandler } {
  const heartbeatMs = options?.heartbeatMs ?? 25_000;
  const maxConnectionsPerUser = options?.maxConnectionsPerUser ?? 5;

  return privateEndpoints({
    GET: async ({ locals, request }) => {
      const userId = localsUserId(locals);
      if (!userId) {
        return authError('not_authenticated');
      }

      // Per-user connection cap (DoS guard): refuse beyond the limit so one
      // account can't exhaust FDs/memory by opening unbounded streams. Its own
      // code, not `rate_limited`, so a reader can tell "wait" from "close a
      // tab" without matching English prose — `<NotificationListener>` reads
      // it off the refused response and stops reconnecting. The
      // check-then-register gap below crosses no `await`, and `start()` runs
      // synchronously, so on single-threaded JS runtimes no concurrent request
      // can interleave past this check — the count is exact, no lock needed.
      if (sse.connectionCount(userId) >= maxConnectionsPerUser) {
        return authError('connection_limit');
      }

      const encoder = new TextEncoder();
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let registered: ReadableStreamDefaultController | undefined;

      // Idempotent teardown: clears the heartbeat and removes the connection
      // from the registry so `isOnline` stays accurate and dead controllers
      // don't accumulate. Safe to call from both cancel() and abort.
      const cleanup = () => {
        if (heartbeat !== undefined) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
        if (registered) {
          sse.removeConnection(userId, registered);
          registered = undefined;
        }
      };

      const stream = new ReadableStream({
        start(controller) {
          registered = controller;
          sse.addConnection(userId, controller);

          // Initial heartbeat so the client sees an open stream immediately.
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            cleanup();
            return;
          }

          // Periodic keep-alive; a failed enqueue means the socket is gone.
          if (heartbeatMs > 0) {
            heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(`: heartbeat\n\n`));
              } catch {
                cleanup();
              }
            }, heartbeatMs);
            // Don't keep a Node process alive solely for the heartbeat.
            (heartbeat as { unref?: () => void }).unref?.();
          }
        },
        cancel() {
          // Client disconnected (tab closed, navigated away).
          cleanup();
        }
      });

      // Belt-and-suspenders: some runtimes surface a disconnect via the request
      // AbortSignal rather than stream cancel(). cleanup() is idempotent;
      // `once` lets the listener (and the closure it captures) be released
      // right after it fires instead of lingering until the signal is GC'd.
      request.signal?.addEventListener('abort', cleanup, { once: true });

      // No `Cache-Control` here: the stream carries one user's notification
      // rows, so it takes the `no-store` every other private endpoint in this
      // package gets from `privateEndpoints` around the bundle. It used to say
      // `no-cache`, the conventional SSE header — but `no-cache` only forces
      // revalidation and still permits a shared cache to KEEP the response;
      // `no-store` is the one that forbids holding it.
      //
      // No `Connection: keep-alive` either: it's a hop-by-hop header, illegal
      // under HTTP/2 (where SSE usually runs) and rejected by some runtimes.
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' }
      });
    }
  });
}
