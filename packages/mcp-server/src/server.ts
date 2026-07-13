import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDesignPrompts } from './prompts/design-prompts.js';
import { registerCatalogResource } from './resources/catalog.js';
import { registerGuideResources } from './resources/guides.js';
import { registerFindComponentsTool } from './tools/find-components.js';
import { registerFindIconsTool } from './tools/find-icons.js';
import { registerGetChecklistTool } from './tools/get-checklist.js';
import { registerGetComponentTool } from './tools/get-component.js';
import { registerGetCssReferenceTool } from './tools/get-css-reference.js';
import { registerGetDesignPrinciplesTool } from './tools/get-design-principles.js';
import { registerGetPatternTool } from './tools/get-pattern.js';
import { registerGetRecipeTool } from './tools/get-recipe.js';
import { registerSuggestImplementationTool } from './tools/suggest-implementation.js';
import { registerValidateDesignTool } from './tools/validate-design.js';

/**
 * Assemble a fully-wired `urbicon-ui` MCP server: the two resources, the ten
 * read-only tools, and the design-verb prompts. Deliberately stateless — it
 * never reads or writes a consumer's design manifest (that lives in the
 * consumer repo, via the `urbicon` CLI or the agent's own file tools), so a
 * fresh instance can be created per HTTP session. Called by both transports.
 *
 * @returns A ready-to-connect `McpServer`; the caller attaches a transport
 *   (`startStdioTransport` / `startHttpTransport`).
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'urbicon-ui',
    version: '0.5.0'
  });

  // Resources
  registerCatalogResource(server);
  registerGuideResources(server);

  // Tools — all read-only. Manifest read/write (context · record-decision ·
  // sync-manifest) lives in the consumer's repo via the `urbicon` CLI or the
  // agent's own file tools, not on this stateless remote server.
  // See docs/internal/DESIGN-MCP-V2.md.
  registerFindComponentsTool(server);
  registerGetComponentTool(server);
  registerGetRecipeTool(server);
  registerSuggestImplementationTool(server);
  registerGetChecklistTool(server);
  registerGetCssReferenceTool(server);
  registerFindIconsTool(server);
  registerGetDesignPrinciplesTool(server);
  registerGetPatternTool(server);
  registerValidateDesignTool(server);

  // Prompts — the deliverable design process (Option E)
  registerDesignPrompts(server);

  return server;
}
