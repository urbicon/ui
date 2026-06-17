import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { emptyManifest, formatContext, parseManifest } from '../design-manifest/index.js';
import { getProjectManifestPath } from '../utils/paths.js';

export function registerGetDesignContextTool(server: McpServer): void {
  server.tool(
    'get_design_context',
    "Read this project's design manifest (design.manifest.md): the chosen paradigm / theme / density, which pages use which composition patterns, and the recorded design decisions (ADRs). Call this at the START of any UI task so generated code stays consistent with what the project has already committed to.",
    {
      manifestPath: z
        .string()
        .optional()
        .describe(
          'Path to design.manifest.md. Defaults to ./design.manifest.md in the project root.'
        )
    },
    { readOnlyHint: true },
    async ({ manifestPath }) => {
      const path = manifestPath ?? getProjectManifestPath();

      let manifest: ReturnType<typeof emptyManifest>;
      try {
        manifest = parseManifest(await readFile(path, 'utf-8'));
      } catch {
        manifest = emptyManifest();
      }

      let text = formatContext(manifest);
      if (!manifest.exists) {
        text +=
          `\n\n> No manifest found at \`${path}\`. Scaffold one with \`sync_design_manifest\`, ` +
          'or record the first decision with `record_design_decision`.\n';
      }
      text += '\n---\n\n**Next steps:**\n';
      text += '- `get_pattern("<name>")` — the rules behind a pattern listed above\n';
      text += '- `get_design_principles(topic="theming")` — the paradigm token profile\n';

      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
