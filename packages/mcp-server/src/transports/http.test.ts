import { existsSync } from 'node:fs';
import { getCatalogPath } from '@urbicon-ui/design-content';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHttpTransport } from './http.js';

// Integration test over the real listener: it guards the session-less contract
// that replaced the SDK's session mode. That mode kept one server instance per
// session in a map only an explicit client `DELETE` ever emptied, so every
// client that vanished stranded ~0.4 MB — ~1 GB in production. The leak was
// invisible to unit tests because nothing exercised the transport itself.
const catalogAvailable = existsSync(getCatalogPath());

const PORT = 3197;
const ENDPOINT = `http://localhost:${PORT}/mcp`;

const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' }
  }
};

function post(body: unknown): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify(body)
  });
}

/** Unwrap either a plain JSON body or an SSE frame carrying one. */
async function readJson(res: Response): Promise<{ result?: unknown; error?: unknown }> {
  const text = await res.text();
  const start = text.indexOf('data: ');
  return JSON.parse(start === -1 ? text : text.slice(start + 6));
}

describe.skipIf(!catalogAvailable)('http transport (session-less)', () => {
  let stop: () => Promise<void>;

  beforeAll(async () => {
    stop = (await startHttpTransport(PORT)).close;
  });

  afterAll(async () => {
    await stop();
  });

  // The retention property itself is not asserted here: measuring it needs
  // `bun:jsc`, and vitest runs under Node. It was verified by hand instead
  // (2,500 requests, forced GC: object count flat at ~113,600, +0.05/request;
  // session mode retained ~9,000 objects and 0.44 MB per session). What these
  // assertions guard is the configuration that guarantees it — a handed-out
  // session id is exactly the observable that reappears if anyone puts
  // `sessionIdGenerator` back.
  it('hands out no session id, on any request', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await post(INIT);
      expect(res.status).toBe(200);
      expect(res.headers.get('mcp-session-id')).toBeNull();
      await res.text();
    }
  });

  it('answers a cold tools/call, with no preceding initialize on this connection', async () => {
    // The load-bearing property of a session-less server: each request arrives
    // at a fresh instance, so nothing may depend on a prior handshake.
    const res = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'find_components', arguments: { query: 'button' } }
    });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    expect(JSON.stringify(body.result)).toContain('Button');
  });

  it('rejects GET and DELETE with 405 — there is no stream and no session to tear down', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await fetch(ENDPOINT, { method });
      expect(res.status).toBe(405);
      await res.text();
    }
  });

  it('serves the liveness banner off /mcp', async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('Urbicon UI MCP Server');
  });
});
