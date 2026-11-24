/** `mcpRequest` against a live endpoint: a JSON-RPC answer whatever its status, a loud stop otherwise. */
import { afterAll, describe, expect, test } from 'vitest';
import { mcpRequest, mcpResult } from './open.ts';

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch(request) {
    switch (new URL(request.url).pathname) {
      case '/unauthorized':
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      case '/rejected':
        return Response.json(
          { jsonrpc: '2.0', id: 1, error: { code: -32022, message: 'no' } },
          { status: 400 }
        );
      default:
        return new Response('<html>502</html>', { status: 502 });
    }
  }
});
afterAll(() => server.stop(true));
const at = (path: string) => ({ url: `http://127.0.0.1:${server.port}${path}` });

describe('mcpRequest', () => {
  test('a JSON-RPC error comes back as it came, whatever its HTTP status', async () => {
    expect((await mcpRequest(at('/rejected'), 'tools/list')).error?.code).toBe(-32022);
  });

  test.each([
    ['/unauthorized', 'HTTP 401'],
    ['/gateway', 'HTTP 502']
  ])('%s is no JSON-RPC answer: a throw naming the status', async (path, status) => {
    await expect(mcpRequest(at(path), 'tools/list')).rejects.toThrow(status);
    await expect(mcpResult(at(path), 'tools/list')).rejects.toThrow(status);
  });
});
