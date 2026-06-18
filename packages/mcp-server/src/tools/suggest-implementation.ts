import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ComponentCatalogEntry } from '../data/catalog-loader.js';
import { loadCatalog } from '../data/catalog-loader.js';
import { loadRecipes } from '../data/recipe-loader.js';
import { matchComponents } from '../utils/search.js';

/** Default props and skeleton hints per component type */
const SKELETON_HINTS: Record<string, { attrs: string; children?: string; selfClosing?: boolean }> =
  {
    Button: { attrs: 'onclick={handleClick}', children: 'Click me' },
    Input: { attrs: 'label="Label" bind:value={value} placeholder="..."', selfClosing: true },
    Textarea: { attrs: 'label="Label" bind:value={text} placeholder="..."', selfClosing: true },
    Card: { attrs: 'variant="outlined"', children: '  <!-- card content -->' },
    Checkbox: { attrs: 'label="Label" bind:checked={checked}', selfClosing: true },
    Toggle: { attrs: 'label="Enable" bind:checked={enabled}', selfClosing: true },
    Select: { attrs: 'label="Choose" bind:value={selected}', children: '...' },
    Combobox: { attrs: 'label="Search" bind:value={selected}', selfClosing: true },
    RadioGroup: { attrs: 'bind:value={selected}', children: '...' },
    Slider: { attrs: 'bind:value={sliderValue}', selfClosing: true },
    Alert: { attrs: 'intent="info"', children: 'Message text' },
    Toast: { attrs: '', children: '' },
    Badge: { attrs: '', children: 'Label' },
    Dialog: { attrs: 'bind:open={showDialog} title="Title"', children: '  <!-- dialog body -->' },
    Drawer: {
      attrs: 'bind:open={showDrawer} placement="right"',
      children: '  <!-- drawer content -->'
    },
    Avatar: { attrs: 'src="/avatar.jpg" alt="User"', selfClosing: true },
    Spinner: { attrs: '', selfClosing: true },
    Progress: { attrs: 'value={progress}', selfClosing: true },
    Skeleton: { attrs: 'class="h-4 w-full"', selfClosing: true },
    Separator: { attrs: '', selfClosing: true },
    Tab: { attrs: '', children: '...' },
    Breadcrumb: { attrs: '', children: '...' },
    Pagination: { attrs: 'total={100} bind:page={page}', selfClosing: true },
    Stepper: { attrs: 'bind:activeStep={step}', children: '...' },
    Accordion: { attrs: '', children: '...' },
    Collapsible: { attrs: '', children: '...' },
    Sidebar: { attrs: 'bind:open={sidebarOpen}', children: '  <!-- nav links -->' },
    Menu: { attrs: '', children: '...' },
    Toolbar: { attrs: 'aria-label="Actions"', children: '...' },
    Tooltip: { attrs: 'label="Tooltip text"', children: '...' },
    Popover: { attrs: '', children: '...' },
    Calendar: { attrs: 'bind:value={date}', selfClosing: true },
    Planner: {
      attrs: 'view="week" items={items} getDate={(item) => item.date}',
      children:
        '  {#snippet cell({ items, isoDate })}\n    <!-- your own per-day content; items are bucketed + typed -->\n  {/snippet}'
    },
    CommandPalette: { attrs: 'bind:open={showPalette} items={commands}', selfClosing: true },
    Table: { attrs: 'data={rows} columns={columns}', selfClosing: true },
    ButtonGroup: { attrs: 'selection="single" bind:value={selected}', children: '...' },
    DatePicker: { attrs: 'label="Date" bind:value={date}', selfClosing: true },
    DateRangePicker: {
      attrs: 'label="Date range" bind:startDate={start} bind:endDate={end}',
      selfClosing: true
    },
    SegmentGroup: { attrs: 'bind:value={selected}', children: '...' },
    LocaleSwitcher: { attrs: '', selfClosing: true },
    ThemeSwitcher: { attrs: '', selfClosing: true },
    FileUpload: {
      attrs: 'bind:files multiple title="Drop files here"',
      selfClosing: true
    }
  };

/** Compact implementation rules — embedded to avoid an extra get_implementation_checklist call */
const IMPLEMENTATION_RULES = `## Implementation Rules

- **CSS imports** — Add to root layout, Tailwind first: \`@import 'tailwindcss';\` then \`@import '@urbicon-ui/blocks/style/index.css';\` (ships tokens + the \`@source\` directives). Import \`index.css\`, NOT the \`foundation\`/\`semantic\`/\`interaction\` subfiles, and add no manual \`@source\`
- **Semantic tokens only** — Use \`bg-surface-elevated\`, \`text-text-primary\`, \`border-border-default\` — never raw Tailwind colors
- **Dark mode** — Automatic via \`prefers-color-scheme\`. Do NOT add \`dark:\` overrides
- **Focus** — Always \`focus-visible:\` (not \`focus:\`) for keyboard-only focus rings
- **State binding** — \`bind:value\`, \`bind:checked\`, \`bind:open\` for two-way state; callback props (\`onValueChange\`) for side effects
- **Custom content** — Use Svelte 5 snippets (\`{#snippet name()}...{/snippet}\`), not legacy slots
- **Styling overrides** — \`class\` for simple additions, \`slotClasses\` for per-slot targeting, \`unstyled\` to strip all defaults
- **Mint** — Add \`mint="scale"\` or \`mint="ripple"\` sparingly on primary CTAs only

## Design Quality

- **Vary visual weight** — Don't use the same Card variant/padding everywhere. Reading-flow content → \`variant="quiet"\` (default) + \`padding="md"\`. Architectural delineation → \`variant="outlined"\` + \`padding="md"\`. Lifted content (cards-on-page) → \`variant="elevated"\` + \`padding="lg"\`. Popover-family floating surfaces → \`variant="floating"\`.
- **Color = meaning** — Neutral surfaces dominate (80–90%). Use \`intent\` colors ONLY for semantic meaning (status, severity, actions) — never as decoration.
- **Spacing = hierarchy** — Tight (\`gap-2\`/\`gap-3\`) within related items. Generous (\`gap-8\`/\`gap-10\`) between sections. Don't use uniform spacing everywhere.
- **Commit to a radius** — Pick a radius philosophy (\`rounded-lg\`, \`rounded-xl\`, or \`rounded-2xl\`) and apply it consistently via \`class\` or \`slotClasses\`. Don't rely solely on component defaults.
- **Data-driven styling** — Different states/severities should look visually distinct (vary padding, font-weight, Badge variant, text color) — not just carry a different label.
- **Don't copy recipe styling** — Recipes show ONE interpretation. Create YOUR visual identity with your own spacing rhythm, color distribution, and layout density.
`;

export function registerSuggestImplementationTool(server: McpServer): void {
  server.tool(
    'suggest_implementation',
    'Generate a Svelte 5 skeleton using Urbicon UI components. Either specify component names directly (preferred — pick them from the catalog first) or describe what you want to build.',
    {
      description: z.string().describe('What you want to build, e.g. "login form with validation"'),
      components: z
        .array(z.string())
        .optional()
        .describe(
          'Specific component names to use (e.g. ["Input", "Button", "Card"]). If omitted, components are auto-matched from the description.'
        ),
      style: z.enum(['minimal', 'polished']).default('polished')
    },
    { readOnlyHint: true, openWorldHint: true },
    async ({ description, components: requestedComponents, style }) => {
      const catalog = await loadCatalog();
      const recipes = await loadRecipes();

      let matched: ComponentCatalogEntry[];

      if (requestedComponents && requestedComponents.length > 0) {
        // Use explicitly requested components — look them up in catalog
        const catalogMap = new Map(catalog.components.map((c) => [c.name.toLowerCase(), c]));
        matched = requestedComponents
          .map((name) => catalogMap.get(name.toLowerCase()))
          .filter((c): c is ComponentCatalogEntry => c !== undefined);
      } else {
        // Fall back to search-based matching
        matched = matchComponents(catalog.components, description, undefined, 8);
      }

      if (matched.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No matching components found for "${description}". Try specifying component names directly via the \`components\` parameter, or browse the catalog with \`find_components\`.`
            }
          ]
        };
      }

      // Find matching recipes — ID substring match OR ≥40% component overlap
      const descLower = description.toLowerCase();
      const matchedNames = new Set(matched.map((c) => c.name));
      const matchingRecipes = recipes.filter((r) => {
        // Direct ID match: description contains the recipe ID (e.g. "login" in "login form")
        if (descLower.includes(r.id)) return true;
        // Component overlap: at least 40% of recipe's components are in matched set
        if (r.components.length > 0) {
          const overlap = r.components.filter((c) => matchedNames.has(c)).length;
          if (overlap / r.components.length >= 0.4) return true;
        }
        return false;
      });

      const imports = matched.map((c) => c.name);

      let md = '# Implementation Suggestion\n\n';
      md += `> ${description}\n\n`;

      // Imports
      md += '## Imports\n\n';
      md += '```svelte\n<script lang="ts">\n';
      md += `  import { ${imports.join(', ')} } from '@urbicon-ui/blocks';\n`;
      md += '</script>\n```\n\n';

      // Component details with prop types
      md += '## Components\n\n';
      for (const comp of matched) {
        const meaningfulVariants = comp.variants
          .filter((v) => {
            const sorted = [...v.values].sort();
            return !(
              (sorted.length === 1 && (sorted[0] === 'true' || sorted[0] === 'false')) ||
              (sorted.length === 2 && sorted[0] === 'false' && sorted[1] === 'true')
            );
          })
          .map((v) => {
            const def = v.default ? ` (default: ${v.default})` : '';
            return `${v.name}: ${v.values.join('/')}${def}`;
          })
          .join(' · ');

        md += `- **${comp.name}** — ${comp.description}`;
        if (meaningfulVariants) md += ` | ${meaningfulVariants}`;
        md += '\n';

        // Show non-primitive prop types so LLMs understand the API shape
        const propTypes = comp.keyPropTypes || {};
        const typeEntries = Object.entries(propTypes);
        if (typeEntries.length > 0) {
          const formatted = typeEntries.map(([name, type]) => `\`${name}: ${type}\``).join(', ');
          md += `  Key props: ${formatted}\n`;
        }

        if (comp.slots.length > 0) {
          md += `  Slots: \`${comp.slots.join('`, `')}\`\n`;
        }
      }
      md += '\n';

      // Skeleton
      md += '## Skeleton\n\n';
      md += '```svelte\n<script lang="ts">\n';
      md += `  import { ${imports.join(', ')} } from '@urbicon-ui/blocks';\n`;
      md += '</script>\n\n';
      md += generateSkeleton(matched, style);
      md += '```\n\n';

      // Embedded implementation rules (replaces separate checklist call)
      md += IMPLEMENTATION_RULES;
      md += '\n';

      // Related recipes
      if (matchingRecipes.length > 0) {
        md += '## Related Recipes\n\n';
        md += 'Use `get_recipe` tool to get full production-ready code:\n\n';
        for (const recipe of matchingRecipes) {
          md += `- **${recipe.title}** (\`${recipe.id}\`) — ${recipe.description}\n`;
        }
        md += '\n';
      }

      // Drill-down hint
      md += '## Next Steps\n\n';
      md += `For full API docs on any component, use \`get_component\`:\n`;
      for (const comp of matched.slice(0, 5)) {
        md += `- \`get_component("${comp.slug}")\`\n`;
      }
      md += '\nOther useful tools:\n';
      md += '- `get_design_principles()` — design heuristics and theming guide\n';
      md += '- `get_pattern("<name>")` — composition pattern for this page type\n';
      md += '- `get_css_reference()` — CSS token names and override patterns\n';
      md += '- `find_icons()` — browse all available icons\n';

      return {
        content: [{ type: 'text' as const, text: md }]
      };
    }
  );
}

function generateSkeleton(components: ComponentCatalogEntry[], _style: string): string {
  const lines: string[] = [];

  for (const comp of components.slice(0, 6)) {
    const hints = SKELETON_HINTS[comp.name];
    const attrs = hints?.attrs || '';
    const attrsStr = attrs ? ` ${attrs}` : '';

    if (hints?.selfClosing) {
      lines.push(`<${comp.name}${attrsStr} />`);
    } else {
      const children = hints?.children || '...';
      lines.push(`<${comp.name}${attrsStr}>${children}</${comp.name}>`);
    }
  }

  return `${lines.join('\n')}\n`;
}
