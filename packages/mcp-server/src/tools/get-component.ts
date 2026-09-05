import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isBooleanAxis } from '@urbicon-ui/design-engine/search';
import { z } from 'zod';
import type { ComponentCatalogEntry } from '../data/catalog-loader.js';
import { loadCatalog } from '../data/catalog-loader.js';
import type { LlmTxtSection } from '../data/component-loader.js';
import { extractSection, loadComponentLlmTxt } from '../data/component-loader.js';

const VALID_SECTIONS: LlmTxtSection[] = ['overview', 'examples', 'variants', 'api', 'slots'];

/** Count prop rows in the llm.txt API section markdown table */
function countPropsInApiSection(content: string): number {
  const apiSection = extractSection(content, 'api');
  if (!apiSection) return 0;

  const lines = apiSection.split('\n');
  // Count table rows (start with `|` but skip header and separator rows)
  let count = 0;
  let pastHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('| ---') || trimmed.startsWith('|---')) {
      pastHeader = true;
      continue;
    }
    if (trimmed.startsWith('| Prop')) continue; // header row
    if (pastHeader) count++;
  }
  return count;
}

/** Extract the first ```svelte code block from the examples section */
function extractFirstExample(content: string): string | null {
  const examples = extractSection(content, 'examples');
  if (!examples) return null;

  const match = examples.match(/```svelte\n([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

/**
 * PascalCase component name to kebab-case slug — must stay in lockstep with
 * docs-gen's `toSlug` (`packages/docs-gen/src/utils/slug.ts`), which is what
 * actually keys the catalog entries this hint points at.
 *
 * The acronym-run pass comes first: the last capital of a run of capitals
 * starts the next word (`QRCode` → `qr-code`, `A2UIView` → `a2-ui-view`).
 * Hyphenating every capital individually — the previous rule — produced
 * `q-r-code`, a `get_component()` hint that resolves to nothing.
 */
function toSlug(name: string): string {
  return name
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1-$2')
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/** Generate compact summary from catalog data + llm.txt */
function generateCompactView(entry: ComponentCatalogEntry, llmContent: string): string {
  let md = `# ${entry.name}\n\n`;
  md += `${entry.description}\n\n`;
  md += `**Import:** \`${entry.import}\`\n\n`;

  // Key props table from keyPropTypes
  const propEntries = Object.entries(entry.keyPropTypes);
  const totalProps = countPropsInApiSection(llmContent);
  const shownCount = propEntries.length;

  if (shownCount > 0) {
    md += `## Key Props`;
    if (totalProps > 0) md += ` (${shownCount} of ${totalProps})`;
    md += '\n\n';
    md += '| Prop | Type | Default |\n';
    md += '|---|---|---|\n';

    // Build a default lookup from variants
    const defaults = new Map(
      entry.variants.filter((v) => v.default).map((v) => [v.name, v.default])
    );

    for (const [prop, type] of propEntries) {
      const def = defaults.get(prop) ?? '—';
      md += `| ${prop} | \`${type}\` | ${def} |\n`;
    }

    if (totalProps > shownCount) {
      md += `\n> ${totalProps - shownCount} more props available via \`get_component("${entry.slug}", section="api")\`\n`;
    }
    md += '\n';
  }

  // Variants (if any meaningful ones exist beyond what's in keyPropTypes)
  const meaningfulVariants = entry.variants.filter((v) => !isBooleanAxis(v.values));

  if (meaningfulVariants.length > 0) {
    md += '## Variants\n\n';
    for (const v of meaningfulVariants) {
      const def = v.default ? ` (default: ${v.default})` : '';
      md += `- **${v.name}**: ${v.values.join(' / ')}${def}\n`;
    }
    md += '\n';
  }

  // First example
  const example = extractFirstExample(llmContent);
  if (example) {
    md += '## Example\n\n';
    md += `\`\`\`svelte\n${example}\n\`\`\`\n\n`;
  }

  // Slots
  if (entry.slots.length > 0) {
    md += `## Slots\n\n\`${entry.slots.join('`, `')}\`\n\n`;
  }

  // Related components
  if (entry.relatedComponents.length > 0) {
    md += `## See Also\n\n`;
    for (const rel of entry.relatedComponents) {
      md += `- \`get_component("${toSlug(rel)}")\` — ${rel}\n`;
    }
    md += '\n';
  }

  // Drill-down hints
  md += '---\n\n';
  md += '**More details:**\n';
  md += `- \`get_component("${entry.slug}", section="api")\` — full props table\n`;
  md += `- \`get_component("${entry.slug}", section="examples")\` — all code examples\n`;
  md += `- \`get_component("${entry.slug}", section="full")\` — complete documentation\n`;
  md += '- `get_css_reference()` — CSS token names and override patterns\n';

  return md;
}

/**
 * Register the `get_component` tool: per-component API docs at three depths —
 * a compact catalog+llm.txt summary (default), one named `section`, or the full
 * llm.txt (`section="full"`). Unknown slugs return a find_components hint; a
 * slug present in llm.txt but absent from the catalog falls back to full content
 * rather than failing.
 */
export function registerGetComponentTool(server: McpServer): void {
  server.tool(
    'get_component',
    'Get API documentation for a specific Urbicon UI component. Default: compact summary with key props, one example, and slots. Use section="full" for complete docs, or section="api"/"examples"/"variants"/"slots" for specific parts.',
    {
      name: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
        .describe('Component slug, e.g. "button", "input", "date-picker", "command-palette"'),
      section: z
        .enum(['overview', 'examples', 'variants', 'api', 'slots', 'full'])
        .optional()
        .describe(
          'Section to return. overview, examples, variants, api (full props table), slots, or full (complete docs). Omit for compact summary.'
        )
    },
    { readOnlyHint: true },
    async ({ name, section }) => {
      const content = await loadComponentLlmTxt(name);

      if (!content) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Component "${name}" not found. Use \`find_components\` to browse available components.`
            }
          ]
        };
      }

      // section="full" → return complete llm.txt (old default behavior)
      if (section === 'full') {
        return {
          content: [{ type: 'text' as const, text: content }]
        };
      }

      // Specific section → extract and return
      if (section) {
        const extracted = extractSection(content, section);

        if (!extracted) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Section "${section}" not found for component "${name}". Available sections: ${VALID_SECTIONS.join(', ')}, full.`
              }
            ]
          };
        }

        return {
          content: [{ type: 'text' as const, text: extracted }]
        };
      }

      // No section → compact summary from catalog + llm.txt
      const catalog = await loadCatalog();
      const entry = catalog.components.find((c) => c.slug === name);

      if (entry) {
        return {
          content: [{ type: 'text' as const, text: generateCompactView(entry, content) }]
        };
      }

      // Fallback: if not in catalog, return full content
      return {
        content: [{ type: 'text' as const, text: content }]
      };
    }
  );
}
