import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CSS_REFERENCE_SECTION_NAMES,
  renderCssReference
} from '@urbicon-ui/design-engine/reference';
import { z } from 'zod';

// The reference text lives in `@urbicon-ui/design-engine/reference`, shared with the
// `urbicon css-reference` CLI command so local and remote answers agree; this tool is
// only the MCP facade. Drift against the real blocks CSS is guarded by the engine's
// `css-reference.test.ts`.
/**
 * Register the `get_css_reference` tool: a pure facade over the engine's
 * `renderCssReference`. Returns the token overview (naming + dark-mode
 * mechanism) or a single category section. All text lives in the engine, shared
 * with `urbicon css-reference`, so this file holds no reference content itself.
 */
export function registerGetCssReferenceTool(server: McpServer): void {
  server.tool(
    'get_css_reference',
    'Get CSS variable names, Tailwind utility mappings, and override patterns for the Urbicon UI design token system. Essential for theming and custom styling.',
    {
      section: z
        .enum(CSS_REFERENCE_SECTION_NAMES)
        .optional()
        .describe(
          'Token category. Omit for overview with naming conventions and dark mode mechanism.'
        )
    },
    { readOnlyHint: true },
    async ({ section }) => {
      return {
        content: [{ type: 'text' as const, text: renderCssReference(section) }]
      };
    }
  );
}
