import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadCatalog } from '../data/catalog-loader.js';

/**
 * Register the `get_recipe` tool: return a full, production-ready recipe (title,
 * pattern link, components, features, code) by id. Recipes travel inside the
 * catalog — no separate source read — so an unknown id lists every available id
 * from the same catalog load.
 */
export function registerGetRecipeTool(server: McpServer): void {
  server.tool(
    'get_recipe',
    'Get a complete, production-ready Svelte 5 code recipe.',
    {
      scenario: z
        .string()
        .describe(
          'Recipe id — e.g. login, settings, dashboard, pricing, profile-card, onboarding-flow, wizard, notification-center, or an auth flow (auth-invitation-register, auth-passkey-login, auth-password-reset). Pass any unrecognised id to get the full, current list.'
        )
    },
    { readOnlyHint: true },
    async ({ scenario }) => {
      // Recipes (with code + pattern) travel in the catalog — single source of truth,
      // no separate read of the recipe source tree.
      const catalog = await loadCatalog();
      const recipe = catalog.recipes.find((r) => r.id === scenario);

      if (!recipe) {
        const available = catalog.recipes.map((r) => r.id).join(', ');
        return {
          content: [
            {
              type: 'text' as const,
              text: `Recipe "${scenario}" not found. Available recipes: ${available}`
            }
          ]
        };
      }

      let md = `# Recipe: ${recipe.title}\n\n`;
      if (recipe.description) md += `${recipe.description}\n\n`;
      if (recipe.pattern) {
        md += `**Composition pattern:** \`${recipe.pattern}\` — this recipe is one instance of that page archetype. Call \`get_pattern("${recipe.pattern}")\` for the layout/spacing/component-selection rules behind it.\n\n`;
      }
      if (recipe.components.length > 0) {
        md += `**Components used:** ${recipe.components.join(', ')}\n\n`;
      }
      if (recipe.features.length > 0) {
        md += '**Features:**\n';
        for (const f of recipe.features) {
          md += `- ${f}\n`;
        }
        md += '\n';
      }
      if (recipe.code) {
        md += `\`\`\`svelte\n${recipe.code}\n\`\`\`\n`;
      }

      // Cross-references
      md += '\n---\n\n**Next steps:**\n';
      if (recipe.components.length > 0) {
        for (const comp of recipe.components.slice(0, 5)) {
          const slug = comp.replace(
            /([A-Z])/g,
            (_, c: string, i: number) => (i > 0 ? '-' : '') + c.toLowerCase()
          );
          md += `- \`get_component("${slug}")\` — ${comp} API docs\n`;
        }
      }
      if (recipe.pattern) {
        md += `- \`get_pattern("${recipe.pattern}")\` — the composition pattern this recipe follows\n`;
      }
      md += '- `get_implementation_checklist()` — design quality rules\n';
      md += '- `get_css_reference()` — CSS token names and override patterns\n';
      md += '- `validate_design(code)` — lint your adaptation before shipping\n';

      return {
        content: [
          {
            type: 'text' as const,
            text: md
          }
        ]
      };
    }
  );
}
