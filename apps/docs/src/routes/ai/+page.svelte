<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import { Badge, Card, buttonVariants } from '@urbicon-ui/blocks';
  import { CodeExample } from '@urbicon-ui/docs';

  const cliSetupExample = `# One dev-dependency wires your agent into the design system
# (already there if you set the project up with \`sv add @urbicon-ui\`):
bun add -d @urbicon-ui/design

# Insert the agent context block (AGENTS.md), scaffold design.manifest.md,
# and optionally wire the edit-time hook + CI gate:
bunx urbicon init --hook --ci

# Done — the next agent session reads AGENTS.md and takes over.`;

  const cliToolsExample = `# Knowledge — version-matched to the library you installed:

urbicon find "date input"          # fuzzy catalog search
urbicon get-component date-picker  # real API: props, variants, examples
urbicon recipe login               # production-ready Svelte 5 recipes
urbicon icons calendar             # icon discovery
urbicon pattern dashboard          # composition patterns per page archetype
urbicon principles --topic theming # design heuristics + paradigm profiles
urbicon css-reference intents      # the token truth: naming, dark mode, overrides

# The closed design loop — generate → validate → judge:

urbicon validate src/              # lint tokens, dark:/focus:, z-index; 0–100 scores
urbicon principles --rubric        # 8-criterion rubric to judge a generated UI
urbicon context                    # read the project's design memory
urbicon record-decision --title …  # write a decision the next session will see`;

  const llmsTxtExample = `# llms.txt (quick reference)
# llms-full.txt (complete API for every component)

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
  description="AI-native developer experience: the urbicon CLI puts version-matched design knowledge, a design linter and project memory next to your agent — plus per-component llms.txt and .cursorrules. Built for Claude, Cursor, and AI-assisted workflows."
/>

<div class="mx-auto max-w-4xl px-6 pt-12">
  <div class="flex flex-wrap gap-2">
    <Badge variant="soft" intent="primary">urbicon CLI</Badge>
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
      Urbicon UI is built for AI-assisted development. The design system's knowledge, linter, and
      memory install with the library — version-matched, offline, and enforceable — so Claude,
      Cursor, Copilot and friends compose from the system instead of guessing.
    </p>
  </div>
</div>

<div class="mx-auto max-w-4xl px-6 pt-10 pb-12">
  <!-- urbicon CLI -->
  <section class="mb-12" aria-labelledby="the-urbicon-cli-title">
    <h2 id="the-urbicon-cli-title" class="text-text-primary mb-2 text-2xl font-bold">
      The urbicon CLI
    </h2>
    <p class="text-text-secondary mb-6">
      One dev-dependency, <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >@urbicon-ui/design</code
      >, gives your agent the full design surface: component discovery, recipes, patterns,
      principles and the token reference — all pinned to the library version you installed. The same
      package closes the loop: generated markup is linted by
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >urbicon validate</code
      >
      (as an edit-time hook and a CI gate), judged against a scoring rubric, and design intent survives
      sessions in a
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >design.manifest.md</code
      > in your repo.
    </p>

    <CodeExample title="Setup" code={cliSetupExample} language="bash" preview={false} />

    <p class="text-text-secondary mt-6 mb-6">
      <strong class="text-text-primary">Two commands, then hands-off.</strong> The context block
      tells your agent which commands exist and when to run them — so the commands below are what
      <em>the agent</em> executes, not a workflow you learn. Your touchpoints afterwards are
      reviews, not operations: the decisions the agent records in
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >design.manifest.md</code
      > show up in your git diff, and a red design gate shows up in CI.
    </p>

    <div class="mt-6">
      <CodeExample
        title="What your agent runs"
        code={cliToolsExample}
        language="bash"
        preview={false}
      />
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card variant="elevated" padding="md">
        <h3 class="text-text-primary mb-1 font-semibold">Version-matched knowledge</h3>
        <p class="text-text-secondary text-sm">
          <span class="text-text-tertiary">Discover:</span> find, get-component, icons, recipe ·
          <span class="text-text-tertiary">Design knowledge:</span> pattern, principles,
          css-reference · What the CLI answers is true of the code in your
          <code class="bg-surface-subtle rounded px-1 py-0.5 font-mono text-xs">node_modules</code>
          — not of whatever shipped last week.
        </p>
      </Card>
      <Card variant="outlined" padding="md">
        <h3 class="text-text-primary mb-1 font-semibold">10 design verbs · enforced loop</h3>
        <p class="text-text-secondary text-sm">
          <span class="text-text-tertiary">Verbs:</span> onboard, adopt, compose, redesign, polish,
          critique, fix, retheme, audit, migrate — each a recipe over the design loop (<code
            class="bg-surface-subtle rounded px-1 py-0.5 font-mono text-xs"
            >urbicon verb &lt;name&gt;</code
          >) · <span class="text-text-tertiary">Enforcement:</span> PostToolUse hook + CI gate via
          <code class="bg-surface-subtle rounded px-1 py-0.5 font-mono text-xs">urbicon init</code>.
        </p>
      </Card>
    </div>
  </section>

  <!-- llms.txt -->
  <section class="mb-12" aria-labelledby="llms-txt-title">
    <h2 id="llms-txt-title" class="text-text-primary mb-2 text-2xl font-bold">llms.txt</h2>
    <p class="text-text-secondary mb-6">
      Every component has its own <code
        class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">llm.txt</code
      >
      file with structured documentation. Agents can fetch it from the docs site, and
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >urbicon get-component --section</code
      > serves the same sections locally to minimize token usage.
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
  <section class="mb-12" aria-labelledby="cursorrules-title">
    <h2 id="cursorrules-title" class="text-text-primary mb-2 text-2xl font-bold">.cursorrules</h2>
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
  <section class="mb-12" aria-labelledby="how-it-works-title">
    <h2 id="how-it-works-title" class="text-text-primary mb-2 text-2xl font-bold">How It Works</h2>
    <p class="text-text-secondary mb-6">
      JSDoc annotations in component source files are the single source of truth. One edit
      automatically updates the documentation site, llms.txt files, and the version-pinned knowledge
      bundle the CLI reads.
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
              <span>content bundler</span>
              <span class="text-text-quaternary mx-2">&rarr;</span>
              <span class="text-primary">@urbicon-ui/design-content</span> (the CLI's knowledge)
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
