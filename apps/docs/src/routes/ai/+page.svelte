<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import { Badge, Card, buttonVariants } from '@urbicon-ui/blocks';
  import { CodeExample } from '@urbicon-ui/docs';

  const mcpSetupExample = `// .cursor/mcp.json or claude_desktop_config.json
{
  "mcpServers": {
    "urbicon-ui": {
      "command": "npx",
      "args": ["-y", "@urbicon-ui/mcp-server"]
    }
  }
}`;

  const mcpToolsExample = `// 10 tools via MCP. Discovery & generation:

find_components({ query: "date input", tags: ["form"] })
// → Fuzzy search with scoring across all components

get_component({ slug: "date-picker", section: "examples" })
// → Per-section docs: overview, examples, variants, api, slots

get_recipe({ scenario: "login" })
// → Production-ready Svelte 5 skeleton (+ its Layer-4 pattern)

suggest_implementation({ description: "user settings page" })
// → AI-assisted scaffold with imports, variants, and tips

// The closed design loop — generate → validate → judge:

validate_design({ code })
// → Lint tokens, dark:/focus:, z-index, hallucinated classes; 0–100 score

get_design_principles({ as: "rubric" })
// → 8-criterion scoring rubric to judge a generated UI

// Project memory (design.manifest.md) is maintained locally by the urbicon CLI,
// not via remote tools — a stateless server can't reach your repo.`;

  const llmsTxtExample = `# llms.txt (quick reference)
# llms-full.txt (complete API for all 40+ components)

# Per-component docs with 5 sections:
#   overview | examples | variants | api | slots
# e.g. /primitives/button/llm.txt`;

  const cursorrulesExample = `# .cursorrules — AI-specific guidance

# Imports: ALWAYS barrel imports
import { Button, Input } from '@urbicon-ui/blocks';

# Styling: ALWAYS semantic tokens
class="bg-surface-base text-text-primary"

# Focus: ALWAYS focus-visible (not focus)
class="focus-visible:ring-2 focus-visible:ring-primary"

# Svelte 5: ALWAYS runes
let { variant, intent } = $props();`;
</script>

<SeoMeta
  title="AI & Developer Experience"
  description="AI-native developer experience: MCP server with 10 tools and 10 design prompts, per-component llms.txt, .cursorrules. Built for Claude, Cursor, and AI-assisted workflows."
/>

<div class="mx-auto max-w-4xl px-6 pt-12">
  <div class="flex flex-wrap gap-2">
    <Badge variant="soft" intent="primary">MCP Server</Badge>
    <Badge variant="soft" intent="secondary">llms.txt</Badge>
    <Badge variant="soft" intent="neutral">.cursorrules</Badge>
  </div>
</div>

<!-- Color Rooms hero field (ai room = orange) — full-width band flush to the app
     sidebar; badges sit on paper above, inner wrapper re-aligns with the body. -->
<div data-room-hero class="mt-5">
  <div class="mx-auto max-w-4xl px-6">
    <h1 class="text-text-primary text-4xl font-bold">AI & Developer Experience</h1>
    <p class="text-text-secondary mt-4 text-xl">
      Urbicon UI is built for AI-assisted development. Every component is discoverable, documented,
      and scaffold-ready for Claude, Cursor, Copilot, and any MCP-compatible tool.
    </p>
  </div>
</div>

<div class="mx-auto max-w-4xl px-6 pb-12 pt-10">
  <!-- MCP Server -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-2 text-2xl font-bold">MCP Server</h2>
    <p class="text-text-secondary mb-6">
      The Model Context Protocol server exposes 10 read-only tools, 10 design prompts and 7 guide
      resources. Connect it to your IDE or AI assistant for real-time component discovery, code
      generation, and a closed design loop: generate UI, lint it with <code
        class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">validate_design</code
      >, judge it against a scoring rubric, and keep design intent across sessions in a
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >design.manifest.md</code
      >, maintained locally by the
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">urbicon</code> CLI.
    </p>

    <CodeExample title="Setup" code={mcpSetupExample} language="json" preview={false} />

    <div class="mt-6">
      <CodeExample
        title="Available Tools"
        code={mcpToolsExample}
        language="typescript"
        preview={false}
      />
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card variant="elevated" padding="md">
        <h3 class="text-text-primary mb-1 font-semibold">10 Tools</h3>
        <p class="text-text-secondary text-sm">
          <span class="text-text-tertiary">Discover:</span> find_components, get_component,
          find_icons · <span class="text-text-tertiary">Generate:</span> get_recipe,
          suggest_implementation, get_implementation_checklist, get_css_reference ·
          <span class="text-text-tertiary">Design loop:</span> get_design_principles, get_pattern, validate_design
        </p>
      </Card>
      <Card variant="outlined" padding="md">
        <h3 class="text-text-primary mb-1 font-semibold">10 Prompts · 7 Guide Resources</h3>
        <p class="text-text-secondary text-sm">
          <span class="text-text-tertiary">Prompts:</span> the design-verb table — onboard, adopt,
          compose, redesign, polish, critique, fix, retheme, audit, migrate (each a recipe over the
          design loop) · <span class="text-text-tertiary">Guides:</span> API grammar, component families,
          design tokens, design quality, customization, style presets, auth setup
        </p>
      </Card>
    </div>
  </section>

  <!-- llms.txt -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-2 text-2xl font-bold">llms.txt</h2>
    <p class="text-text-secondary mb-6">
      Every component has its own <code
        class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">llm.txt</code
      > file with structured documentation. The MCP server can query individual sections to minimize token
      usage.
    </p>

    <CodeExample title="LLM Documentation" code={llmsTxtExample} language="bash" preview={false} />

    <div class="mt-6 flex flex-col gap-3 sm:flex-row">
      <a
        href={asset('/llms-full.txt')}
        class={buttonVariants({ variant: 'outlined', intent: 'primary' }).base()}
      >
        View llms-full.txt
      </a>
      <a
        href={asset('/llms.txt')}
        class={buttonVariants({ variant: 'ghost', intent: 'neutral' }).base()}
      >
        View llms.txt
      </a>
    </div>
  </section>

  <!-- .cursorrules -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-2 text-2xl font-bold">.cursorrules</h2>
    <p class="text-text-secondary mb-6">
      IDE-specific guidance for AI code generation. Ensures generated code follows project
      conventions: barrel imports, semantic tokens, Svelte 5 runes, focus-visible, and more.
    </p>

    <CodeExample
      title="AI Coding Conventions"
      code={cursorrulesExample}
      language="typescript"
      preview={false}
    />
  </section>

  <!-- Architecture -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-2 text-2xl font-bold">How It Works</h2>
    <p class="text-text-secondary mb-6">
      JSDoc annotations in component source files are the single source of truth. One edit
      automatically updates the documentation site, llms.txt files, and MCP catalog.
    </p>

    <div class="border-border-subtle bg-surface-elevated overflow-hidden rounded-xl border">
      <div class="p-6">
        <div class="text-text-tertiary space-y-3 font-mono text-sm leading-relaxed">
          <div>
            <span class="text-text-primary font-semibold">Source</span>
            <span class="text-text-quaternary mx-2">&rarr;</span>
            <span>@description, @tag, @related in index.ts</span>
          </div>
          <div class="border-border-subtle border-l-2 pl-4">
            <div>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span>docs-gen pipeline</span>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span class="text-primary">api.json</span> (docs site)
            </div>
            <div>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span>LLM generator</span>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span class="text-primary">llm.txt</span> (per component)
            </div>
            <div>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span>MCP catalog assembler</span>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span class="text-primary">component-catalog.json</span> (MCP server)
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
