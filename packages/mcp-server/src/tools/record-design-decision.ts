import { readFile, writeFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { appendDecision, createManifestTemplate, parseManifest } from '../design-manifest/index.js';
import { getProjectManifestPath, isWithinProjectDir } from '../utils/paths.js';

export function registerRecordDesignDecisionTool(server: McpServer): void {
  server.tool(
    'record_design_decision',
    'Append a design decision (ADR) to the project design manifest — record a deliberate deviation from a pattern or principle so future sessions and other developers honour it. Creates design.manifest.md if it does not exist yet.',
    {
      title: z
        .string()
        .min(1)
        .describe('Short decision title, e.g. "Tabs for settings instead of sidebar".'),
      decision: z.string().min(1).describe('What was decided — concrete and imperative.'),
      rationale: z
        .string()
        .optional()
        .describe('Why — the trade-off that justifies the deviation.'),
      status: z
        .enum(['accepted', 'proposed', 'superseded'])
        .optional()
        .describe('Decision status. Defaults to "accepted".'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('ISO date (YYYY-MM-DD). Defaults to today.'),
      manifestPath: z
        .string()
        .optional()
        .describe('Path to design.manifest.md. Defaults to the project root.')
    },
    { readOnlyHint: false },
    async ({ title, decision, rationale, status, date, manifestPath }) => {
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

      let content: string;
      let created = false;
      try {
        content = await readFile(path, 'utf-8');
      } catch {
        content = createManifestTemplate({});
        created = true;
      }

      const today = date ?? new Date().toISOString().slice(0, 10);
      const updated = appendDecision(content, {
        date: today,
        title,
        status: status ?? 'accepted',
        decision,
        rationale
      });

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

      const total = parseManifest(updated).decisions.length;
      const note = created ? ' (created the manifest)' : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Recorded ADR "${title}" dated ${today} in \`${path}\`${note}. ${total} decision(s) on record.`
          }
        ]
      };
    }
  );
}
