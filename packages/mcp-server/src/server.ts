import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDesignPrompts } from './prompts/design-prompts.js';
import { registerCatalogResource } from './resources/catalog.js';
import { registerGuideResources } from './resources/guides.js';
import { registerFindComponentsTool } from './tools/find-components.js';
import { registerFindIconsTool } from './tools/find-icons.js';
import { registerGetChecklistTool } from './tools/get-checklist.js';
import { registerGetComponentTool } from './tools/get-component.js';
import { registerGetCssReferenceTool } from './tools/get-css-reference.js';
import { registerGetDesignContextTool } from './tools/get-design-context.js';
import { registerGetDesignPrinciplesTool } from './tools/get-design-principles.js';
import { registerGetPatternTool } from './tools/get-pattern.js';
import { registerGetRecipeTool } from './tools/get-recipe.js';
import { registerRecordDesignDecisionTool } from './tools/record-design-decision.js';
import { registerSuggestImplementationTool } from './tools/suggest-implementation.js';
import { registerSyncDesignManifestTool } from './tools/sync-design-manifest.js';
import { registerValidateDesignTool } from './tools/validate-design.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'urbicon-ui',
    version: '0.5.0'
  });

  // Resources
  registerCatalogResource(server);
  registerGuideResources(server);

  // Tools
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
  registerGetDesignContextTool(server);
  registerRecordDesignDecisionTool(server);
  registerSyncDesignManifestTool(server);

  // Prompts — the deliverable design process (Option E)
  registerDesignPrompts(server);

  return server;
}
