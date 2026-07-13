import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPatternByName, loadPatterns } from '../data/design-system-loader.js';

/**
 * Register the `get_pattern` tool: one composition pattern's full content by
 * `name`, or — when `name` is omitted — the list of available patterns. An
 * unknown name echoes the valid names back. Patterns are loaded/cached by
 * `design-system-loader`.
 */
export function registerGetPatternTool(server: McpServer): void {
  server.tool(
    'get_pattern',
    'Get a composition pattern for a specific page type. Patterns describe layout structure, component selection, spacing, and behavioral rules for common page archetypes (settings-page, dashboard, form-page). Use after consulting design principles.',
    {
      name: z
        .string()
        .optional()
        .describe(
          'Pattern name (e.g. "settings-page", "dashboard", "form-page"). Omit to list all available patterns.'
        )
    },
    { readOnlyHint: true },
    async ({ name }) => {
      if (!name) {
        const patterns = await loadPatterns();

        if (patterns.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No composition patterns found. Ensure design-system/patterns/*.md exists at the monorepo root.'
              }
            ]
          };
        }

        let md = '# Available Composition Patterns\n\n';
        for (const p of patterns) {
          md += `- **${p.title}** (\`${p.name}\`) — ${p.description}\n`;
        }
        md += '\n> Use `get_pattern("<name>")` to get the full pattern.\n';
        md += '\n---\n\n**Next steps:**\n';
        md += '- `get_design_principles()` — design heuristics and rules\n';
        md += '- `get_css_reference()` — CSS token names and override patterns\n';
        return { content: [{ type: 'text' as const, text: md }] };
      }

      const pattern = await getPatternByName(name);

      if (!pattern) {
        const all = await loadPatterns();
        const available = all.map((p) => `\`${p.name}\``).join(', ');
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pattern "${name}" not found. Available patterns: ${available}`
            }
          ]
        };
      }

      let md = pattern.content;
      md += '\n\n---\n\n**Next steps:**\n';
      md += '- `get_design_principles()` — design heuristics and rules\n';
      md += '- `get_css_reference()` — CSS token names and override patterns\n';
      md += '- `suggest_implementation("<description>")` — generate a component skeleton\n';
      md += '- `get_recipe("<id>")` — get a complete code recipe\n';

      return { content: [{ type: 'text' as const, text: md }] };
    }
  );
}
