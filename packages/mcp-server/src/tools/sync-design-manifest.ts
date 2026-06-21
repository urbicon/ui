import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createManifestTemplate,
  scanMarkers,
  upsertUsagesSection
} from '@urbicon-ui/design-engine/manifest';
import { z } from 'zod';
import { getProjectManifestPath, getProjectSourceDir, isWithinProjectDir } from '../utils/paths.js';

export function registerSyncDesignManifestTool(server: McpServer): void {
  server.tool(
    'sync_design_manifest',
    'Scan the project source for `data-design-pattern="…"` markers and regenerate the Pattern Usages section of design.manifest.md. Run after adding, moving, or removing pattern-following pages so the usage index stays accurate — this is what makes a pattern change tractable (grep the markers → migrate every listed file). Creates the manifest if missing.',
    {
      sourceDir: z
        .string()
        .optional()
        .describe('Directory to scan recursively. Defaults to ./src in the project root.'),
      manifestPath: z
        .string()
        .optional()
        .describe('Path to design.manifest.md. Defaults to the project root.')
    },
    { readOnlyHint: false },
    async ({ sourceDir, manifestPath }) => {
      const path = manifestPath ?? getProjectManifestPath();
      if (!path.endsWith('.md')) {
        return {
          content: [
            { type: 'text' as const, text: `Refusing to write: "${path}" is not a .md file.` }
          ],
          isError: true
        };
      }
      if (manifestPath && !isWithinProjectDir(manifestPath)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Refusing to write outside the project root: "${path}".`
            }
          ],
          isError: true
        };
      }
      const src = sourceDir ?? getProjectSourceDir();

      // Files in the manifest are relative to the project root (the manifest's directory).
      const usages = await scanMarkers(src, dirname(path));

      let content: string;
      let created = false;
      try {
        content = await readFile(path, 'utf-8');
      } catch {
        content = createManifestTemplate({});
        created = true;
      }

      const updated = upsertUsagesSection(content, usages);
      try {
        await writeFile(path, updated, 'utf-8');
      } catch (err) {
        return {
          content: [
            { type: 'text' as const, text: `Failed to write ${path}: ${(err as Error).message}` }
          ],
          isError: true
        };
      }

      const byPattern = new Map<string, number>();
      for (const u of usages) byPattern.set(u.pattern, (byPattern.get(u.pattern) ?? 0) + 1);

      let text = `Synced \`${path}\`${created ? ' (created it)' : ''} — scanned \`${src}\`, found ${usages.length} marker(s)`;
      if (byPattern.size > 0) {
        const summary = [...byPattern]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([p, n]) => `${p} (${n})`)
          .join(', ');
        text += ` across ${byPattern.size} pattern(s): ${summary}.`;
      } else {
        text +=
          '. No markers yet — add `data-design-pattern="<name>"` to the root element of pages that follow a composition pattern.';
      }

      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
