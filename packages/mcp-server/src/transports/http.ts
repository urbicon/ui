import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createMcpServer } from '../server.js';

export async function startHttpTransport(port: number): Promise<void> {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname !== '/mcp') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Urbicon UI MCP Server');
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'POST') {
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (session) {
        await session.handleRequest(req, res);
      } else if (!sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID()
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res);
        if (transport.sessionId) sessions.set(transport.sessionId, transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid session' },
            id: null
          })
        );
      }
    } else if (req.method === 'GET') {
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (session) {
        await session.handleRequest(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Missing or invalid session' },
            id: null
          })
        );
      }
    } else if (req.method === 'DELETE') {
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (session && sessionId) {
        await session.handleRequest(req, res);
        sessions.delete(sessionId);
      } else {
        res.writeHead(204);
        res.end();
      }
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Method not allowed' },
          id: null
        })
      );
    }
  });

  httpServer.listen(port, () => {
    console.error(`Urbicon UI MCP Server listening on http://localhost:${port}/mcp`);
  });
}
