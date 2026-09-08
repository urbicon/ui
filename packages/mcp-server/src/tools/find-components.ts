import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CLOSEST_NOTE, searchComponents } from '@urbicon-ui/design-engine/search';
import { z } from 'zod';
import { loadCatalog } from '../data/catalog-loader.js';
import { formatCompactCatalog, formatComponentLine } from '../utils/format-catalog.js';

/**
 * Register the `find_components` tool: the catalog entry point. With no query it
 * renders the full catalog grouped by category (via `formatCompactCatalog`);
 * with a query it fuzzy-matches names, descriptions, summaries, prop docs, variant
 * values and tags through the engine's `searchComponents` (top 10) — the same ranker
 * the `urbicon find` CLI uses, so local and remote discovery agree. Every line keeps
 * the origin-package tag so a non-blocks match (e.g. `Table`) is never mistaken for a
 * blocks export.
 *
 * A result needs a query word that *landed*; the engine's near misses come back as
 * `closest` and are reported as such, never as matches. Without that floor the tool
 * answered every query with a best-of (#444).
 */
export function registerFindComponentsTool(server: McpServer): void {
  server.tool(
    'find_components',
    'Browse and search the Urbicon UI component catalog. Without a query, lists all components grouped by category. With a query, performs fuzzy search across names, descriptions, summaries, prop docs, variant values and tags.',
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
        const { matches: results, closest } = searchComponents(catalog.components, query, tags, 10);

        // The near misses render the same way in both branches, and as one line —
        // the full bullet a match gets would read as a result, which is what these
        // are not. Same shape as the CLI's `Closest (weak):` line.
        const closestBlock =
          closest.length > 0
            ? `\n> Closest, but weak: ${closest.map((c) => `${c.name} (${c.slug})`).join(' · ')}\n> ${CLOSEST_NOTE}\n`
            : '';

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No components found for "${query}". Try broader terms or browse all with \`find_components\` (no query).\n${closestBlock}`
              }
            ]
          };
        }

        let md = `# Search Results for "${query}"\n\n`;
        md += `> ${results.length} matching components.\n\n`;

        // Same line format as the browse view — including the origin-package tag for
        // non-blocks components, so a match like `Table` (from @urbicon-ui/table) is
        // never mistaken for a blocks export.
        for (const comp of results) {
          md += formatComponentLine(comp);
        }

        md += closestBlock;
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
