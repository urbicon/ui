import { createServer as createHttpServer, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createMcpServer } from '../server.js';

function respondError(res: ServerResponse, status: number, code: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

/**
 * Serve the MCP over Streamable HTTP on `/mcp`, **session-less**: every request
 * is self-contained, so each `POST` gets a throw-away {@link createServer} +
 * transport pair that is closed again when the response ends.
 *
 * The SDK's session mode (`sessionIdGenerator: () => randomUUID()`) is
 * deliberately **not** used. It would keep a server instance per session in a
 * map that only a client's explicit `DELETE` — or a clean transport close —
 * ever empties, so every client that just goes away (crash, kill, dropped
 * connection) strands ~0.4 MB of heap forever; on an unauthenticated endpoint a
 * single anonymous `POST` is enough to do it. That leak reached ~1 GB in
 * production. Sessions bought nothing here: the server sends no notifications
 * and holds no per-client state, and rebuilding it per request costs ~0.2 ms.
 *
 * Consequently `GET` (the standalone SSE stream) and `DELETE` (session
 * teardown) answer `405` — both explicitly permitted by the MCP spec for a
 * server that offers no sessions. Any non-`/mcp` path returns a plain-text
 * banner (a lightweight liveness ping).
 *
 * @param port - TCP port to listen on (binds `http://localhost:<port>/mcp`).
 * @returns A stop handle; `index.ts` ignores it and runs until the process
 *   exits, the transport test uses it to shut the listener down.
 */
export async function startHttpTransport(port: number): Promise<{ close: () => Promise<void> }> {
  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname !== '/mcp') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Urbicon UI MCP Server');
      return;
    }

    if (req.method !== 'POST') {
      respondError(
        res,
        405,
        -32600,
        'Method not allowed — this server is session-less; every request must be a self-contained POST'
      );
      return;
    }

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    // Tear down when the response ends — whether it completed or the client
    // hung up. This is the only lifetime the pair has; nothing outlives it.
    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('MCP request failed:', err);
      if (res.headersSent) {
        res.end();
      } else {
        respondError(res, 500, -32603, 'Internal server error');
      }
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      console.error(`Urbicon UI MCP Server listening on http://localhost:${port}/mcp`);
      resolve();
    });
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      })
  };
}
