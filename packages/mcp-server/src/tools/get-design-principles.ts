import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { renderRubric } from '@urbicon-ui/design-engine/rubric';
import { z } from 'zod';
import {
  extractPrincipleSection,
  loadPrinciples,
  PRINCIPLE_TOPICS
} from '../data/design-system-loader.js';

export function registerGetDesignPrinciplesTool(server: McpServer): void {
  server.tool(
    'get_design_principles',
    'Get design heuristics and rules for building UIs with Urbicon UI. Covers visual hierarchy, interaction patterns, component selection heuristics, layout rules, accessibility, theming (token hierarchy, paradigms, change decision tree). Call this FIRST when generating new UI — before selecting components. Pass `as="rubric"` to instead get the 1–5 scoring rubric for judging a generated UI.',
    {
      topic: z
        .enum(PRINCIPLE_TOPICS)
        .optional()
        .describe(
          'Filter to a specific topic. "theming" includes the design change decision tree, paradigm profiles, and token override guide. Omit for all principles.'
        ),
      as: z
        .enum(['guide', 'rubric'])
        .optional()
        .describe(
          'Output mode. "guide" (default) returns the heuristics for building UI. "rubric" returns the 8-criterion 1–5 scoring rubric for judging a generated UI (ignores `topic`).'
        )
    },
    { readOnlyHint: true },
    async ({ topic, as }) => {
      if (as === 'rubric') {
        let text = renderRubric();
        text += '\n---\n\n**Next steps:**\n';
        text +=
          '- `validate_design(code)` — deterministic correctness check that anchors criterion 8\n';
        text +=
          '- `get_design_principles(topic="theming")` — paradigm profiles to judge fidelity against\n';
        return { content: [{ type: 'text' as const, text }] };
      }

      const principles = await loadPrinciples();

      if (!principles) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Design principles not found. Ensure design-system/principles.md exists at the monorepo root.'
            }
          ]
        };
      }

      let text: string;

      if (topic) {
        const section = extractPrincipleSection(principles, topic);
        text = section ?? principles;
      } else {
        text = principles;
      }

      text += '\n\n---\n\n**Next steps:**\n';
      text += '- `get_pattern("<name>")` — composition patterns for specific page types\n';
      text += '- `get_css_reference()` — CSS token names and override patterns\n';
      text += '- `find_components()` — browse the component catalog\n';

      return {
        content: [{ type: 'text' as const, text }]
      };
    }
  );
}
