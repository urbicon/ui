import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadCatalog } from '../data/catalog-loader.js';
import { formatCompactCatalog } from '../utils/format-catalog.js';

export function registerCatalogResource(server: McpServer): void {
  server.resource('catalog', 'urbicon://catalog', async (uri) => {
    const catalog = await loadCatalog();

    const md = formatCompactCatalog(catalog.components, {
      recipes: catalog.recipes
    });

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: md
        }
      ]
    };
  });
}
