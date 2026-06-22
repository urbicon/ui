import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { matchComponents } from '@urbicon-ui/design-engine/search';
import { z } from 'zod';
import { loadCatalog } from '../data/catalog-loader.js';
import { formatCompactCatalog } from '../utils/format-catalog.js';

export function registerFindComponentsTool(server: McpServer): void {
  server.tool(
    'find_components',
    'Browse and search the Urbicon UI component catalog. Without a query, lists all components grouped by category. With a query, performs fuzzy search across names, descriptions, and tags.',
    {
      query: z
        .string()
        .optional()
        .describe(
          'Search query to find components by name, description, or functionality (e.g. "date input", "modal", "accordeon")'
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          'Filter by category (form, layout, feedback, navigation, action, display, data) or by origin (auth = all components from the @urbicon-ui/auth package)'
        )
    },
    { readOnlyHint: true, openWorldHint: true },
    async ({ query, tags }) => {
      const catalog = await loadCatalog();

      if (query) {
        const results = matchComponents(catalog.components, query, tags, 10);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No components found for "${query}". Try broader terms or browse all with \`find_components\` (no query).`
              }
            ]
          };
        }

        let md = `# Search Results for "${query}"\n\n`;
        md += `> ${results.length} matching components.\n\n`;

        for (const comp of results) {
          const variants = comp.variants
            .filter(
              (v) => !['true', 'false'].every((b) => v.values.includes(b) && v.values.length <= 2)
            )
            .map((v) => `${v.name}: ${v.values.join('/')}`)
            .join(' · ');

          md += `- **${comp.name}** — ${comp.description}`;
          if (variants) md += ` | ${variants}`;
          if (comp.relatedComponents.length > 0) {
            md += ` | Related: ${comp.relatedComponents.join(', ')}`;
          }
          md += '\n';
        }

        md += '\n> Use `get_component` with the component slug for full API docs.\n';
        md += '> Use `get_css_reference` for CSS token documentation.\n';
        md += '> Use `find_icons()` to browse all available icons.\n';

        return {
          content: [{ type: 'text' as const, text: md }]
        };
      }

      let md = formatCompactCatalog(catalog.components, {
        recipes: catalog.recipes,
        tags
      });
      md += '\n> Use `get_css_reference` for CSS token documentation.\n';
      md += '> Use `find_icons()` to browse all available icons.\n';

      return {
        content: [{ type: 'text' as const, text: md }]
      };
    }
  );
}
