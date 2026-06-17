import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadCatalog } from '../data/catalog-loader.js';

export function registerGetChecklistTool(server: McpServer): void {
  server.tool(
    'get_implementation_checklist',
    'Get a best-practice checklist for implementing UI with Urbicon UI components. Optionally provide component names for context-specific advice.',
    {
      components: z
        .array(z.string())
        .optional()
        .describe('Component names being used, e.g. ["Button", "Input", "Card"]')
    },
    { readOnlyHint: true },
    async ({ components }) => {
      let md = '# Urbicon UI Implementation Checklist\n\n';

      // Project setup
      md += '## Project Setup\n\n';
      md += '- [ ] Install: `bun add @urbicon-ui/blocks @urbicon-ui/i18n`\n';
      md +=
        "- [ ] Add CSS imports to your root layout or entry CSS — your app owns the Tailwind import and it MUST come first:\n  ```css\n  @import 'tailwindcss';\n  @import '@urbicon-ui/blocks/style/index.css'; /* tokens + @source directives */\n  @import '@urbicon-ui/table/style/index.css';  /* only if using Table */\n  ```\n";
      md +=
        "- [ ] Import components from package root: `import { Button } from '@urbicon-ui/blocks'` (never from internal paths)\n";
      md +=
        '- [ ] **Import `style/index.css`, not the subfiles, and add NO manual `@source`** — `index.css` ships the Tailwind `@source` directives that make Tailwind scan component classes from `node_modules`, so responsive utilities (`lg:hidden`, `md:grid-cols-2`, etc.) inside library components compile correctly. The `foundation`/`semantic`/`interaction` subfiles omit those directives (and global classes like `.sr-only`); importing them instead of `index.css` is the usual cause of broken responsive layouts in production.\n';
      md += '\n';

      // Core checklist
      md += '## Design Tokens\n\n';
      md +=
        '- [ ] Use semantic color tokens (`bg-surface-elevated`, `text-text-primary`, `border-border-default`) — not raw Tailwind colors (`bg-gray-100`)\n';
      md +=
        '- [ ] Use OKLCH interaction tokens for hover/active states (`bg-surface-hover`, `bg-surface-active`)\n';
      md +=
        '- [ ] Dark mode is automatic via `prefers-color-scheme` — semantic tokens switch automatically. For manual control, use `ThemeSwitcher` or set `data-theme="dark"` on `<html>`. Do NOT add `dark:` overrides\n';
      md +=
        '- [ ] Use z-index tokens via CSS custom properties: `z-[var(--z-modal)]`, `z-[var(--z-dropdown)]`, etc.\n';
      md += '\n';

      md += '## Styling\n\n';
      md += '- [ ] Use `unstyled` prop to strip default styles when building custom designs\n';
      md += '- [ ] Use `slotClasses` for targeted style overrides on specific sub-elements\n';
      md +=
        '- [ ] For reusable variant sets, register named `preset`s via `BlocksProvider` (and select with the `preset` prop) — not external variant libraries; Urbicon UI ships its own zero-dependency variant engine\n';
      md +=
        "- [ ] For conditional classes, pass an array to `class` (`class={['base', condition && 'extra']}`) — not concatenated conditional class strings\n";
      md += '- [ ] Use `class` prop for simple additions — merges with defaults automatically\n';
      md += '\n';

      md += '## Accessibility\n\n';
      md +=
        '- [ ] Use `focus-visible:` for focus rings (not `focus:`) — keyboard-only visibility\n';
      md +=
        '- [ ] Provide `aria-label` on icon-only buttons and interactive elements without visible text\n';
      md += '- [ ] Use semantic HTML elements — components render correct elements by default\n';
      md += '- [ ] Test keyboard navigation — Tab, Enter, Space, Escape, Arrow keys\n';
      md += '\n';

      md += '## Micro-Interactions (Mint)\n\n';
      md +=
        '- [ ] Add `mint` prop for subtle feedback: `"scale"`, `"ripple"`, `"shake"`, or combine with arrays\n';
      md += '- [ ] Use `mint` sparingly — primary CTAs and key interactive elements only\n';
      md += '\n';

      md += '## Component Integration\n\n';
      md += '- [ ] Use `bind:value` / `bind:checked` / `bind:open` for two-way state binding\n';
      md += '- [ ] Use callback props (`onValueChange`, `onOpenChange`) for side effects\n';
      md += '- [ ] Use Svelte 5 snippets (`{#snippet ...}`) for custom content slots\n';
      md += '\n';

      md += '## i18n\n\n';
      md += "- [ ] Wrap user-facing text in `$t('key')` from `@urbicon-ui/i18n`\n";
      md +=
        '- [ ] Components handle internal translations automatically — no manual i18n for built-in labels\n';
      md += '\n';

      md += '## Design Quality\n\n';
      md +=
        '- [ ] Visual weight varies across the page — not all Cards use the same `variant` and `padding`. Prominent content is `elevated`/`lg`, secondary is `outlined`/`md`\n';
      md +=
        '- [ ] Intent colors appear ONLY for semantic meaning (status, severity, actions) — never as decoration. Neutral surfaces dominate (80–90%)\n';
      md +=
        '- [ ] Spacing varies: tight (`gap-2`/`gap-3`) within related items, generous (`gap-8`/`gap-10`) between sections — not uniform everywhere\n';
      md +=
        "- [ ] Border-radius follows a deliberate strategy — overridden via `class` or `slotClasses` where component defaults don't match the design identity\n";
      md +=
        '- [ ] Data-driven styling: different states/severities are visually distinct through padding, font-weight, Badge `variant`, and text color — not just labels\n';
      md +=
        '- [ ] Each major section has one clearly dominant element. If everything is emphasized, nothing is\n';
      md +=
        '- [ ] Implementation has its own visual identity — not a copy of recipe or example styling\n';
      md += '\n';

      // Context-specific advice
      if (components && components.length > 0) {
        const catalog = await loadCatalog();
        const catalogMap = new Map(catalog.components.map((c) => [c.name.toLowerCase(), c]));

        const found = components
          .map((name) => catalogMap.get(name.toLowerCase()))
          .filter((c) => c !== undefined);

        if (found.length > 0) {
          md += '## Component-Specific Notes\n\n';

          for (const comp of found) {
            md += `### ${comp.name}\n`;
            if (comp.variants.length > 0) {
              const key = comp.variants
                .filter((v) => !['true', 'false'].every((b) => v.values.includes(b)))
                .map((v) => `\`${v.name}\`: ${v.values.join(' / ')}`)
                .join(', ');
              if (key) md += `- Variants: ${key}\n`;
            }
            if (comp.slots.length > 0) {
              md += `- Customizable slots: \`${comp.slots.join('`, `')}\`\n`;
            }
            if (comp.relatedComponents.length > 0) {
              md += `- Consider also: ${comp.relatedComponents.join(', ')}\n`;
            }
            md += '\n';
          }
        }
      }

      // Cross-references
      md += '---\n\n**Related tools:**\n';
      md += '- `get_css_reference()` — CSS variable names and override patterns\n';
      md += '- `get_component("<slug>")` — specific component API details\n';
      md += '- `find_icons()` — browse all available icons\n';

      return {
        content: [{ type: 'text' as const, text: md }]
      };
    }
  );
}
