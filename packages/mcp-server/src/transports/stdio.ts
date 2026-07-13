import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Connect an assembled server over stdio — the transport for a local, single-
 * client host (one server instance per process; the client speaks JSON-RPC on
 * stdin/stdout). For a shared network endpoint use {@link startHttpTransport}.
 *
 * @param server - A server from {@link createServer}.
 */
export async function startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
