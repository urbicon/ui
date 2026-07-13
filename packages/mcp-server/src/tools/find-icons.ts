import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ICON_CATEGORY_ORDER } from '@urbicon-ui/design-engine/search';
import { loadIcons } from '../data/icon-loader.js';

/**
 * Register the `find_icons` tool (no arguments): render the full icon reference
 * — usage snippets plus every icon grouped by `ICON_CATEGORY_ORDER`, each listed
 * as component name + dynamic `name`. Degrades to a hint when the icon bundle is
 * unavailable (see {@link loadIcons}).
 */
export function registerFindIconsTool(server: McpServer): void {
  server.tool(
    'find_icons',
    'Get the complete Urbicon UI icon reference — all icons grouped by category with usage instructions.',
    {},
    { readOnlyHint: true, openWorldHint: false },
    async () => {
      const icons = await loadIcons();

      if (icons.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Icon metadata not available. Ensure the blocks package is accessible.'
            }
          ]
        };
      }

      // Group by category
      const byCategory = new Map<string, typeof icons>();
      for (const icon of icons) {
        for (const cat of icon.categories) {
          const bucket = byCategory.get(cat);
          if (bucket) bucket.push(icon);
          else byCategory.set(cat, [icon]);
        }
      }

      let md = `# Urbicon UI Icon Reference (${icons.length} icons)\n\n`;
      md += '## Usage\n\n';
      md += '**Direct import:**\n';
      md += '```svelte\n';
      md += '<script>\n';
      md += "  import { SearchIcon } from '@urbicon-ui/blocks';\n";
      md += '</script>\n\n';
      md += '<SearchIcon size={24} />\n';
      md += '```\n\n';
      md += '**Dynamic (via IconProvider):**\n';
      md += '```svelte\n';
      md += '<Icon name="search" />\n';
      md += '```\n\n';
      md +=
        '**Props:** `size` (default 24), `strokeWidth` (default 2), `class`, `rotate`, `flip`, `animation`\n\n';
      md += '---\n\n';

      for (const cat of ICON_CATEGORY_ORDER) {
        const catIcons = byCategory.get(cat);
        if (!catIcons || catIcons.length === 0) continue;

        const sorted = [...catIcons].sort((a, b) => a.componentName.localeCompare(b.componentName));

        md += `### ${cat} (${sorted.length})\n\n`;
        for (const icon of sorted) {
          md += `- ${icon.componentName} · \`${icon.name}\`\n`;
        }
        md += '\n';
      }

      return { content: [{ type: 'text' as const, text: md }] };
    }
  );
}
