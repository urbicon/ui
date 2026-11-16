<script lang="ts">
  import { buttonVariants, Card } from '@urbicon-ui/blocks';
  import { CodeExample } from '@urbicon-ui/docs';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { REPO_URL } from '#lib/seo.js';
  import { asset, resolve } from '$app/paths';

  // The site renders neither guide; GitHub does, and both ship in their package's tarball.
  const A2UI_GUIDE = `${REPO_URL}/blob/main/packages/blocks/docs/A2UI.md`;
  const MCP_APP_README = `${REPO_URL}/tree/main/packages/mcp-app#readme`;

  const cliSetupExample = `# One dev-dependency wires your agent into the design system
# (already there if you set the project up with \`sv add @urbicon-ui\`):
bun add -d @urbicon-ui/design

# Insert the agent context block (AGENTS.md), scaffold design.manifest.md
# and wire the edit-time gate (add --ci for the CI workflow too):
bunx urbicon init --hook

# Done — the next agent session reads AGENTS.md and takes over.`;

  const cliToolsExample = `# Knowledge — version-matched to the library you installed:

urbicon find "date input"          # fuzzy catalog search
urbicon get-component date-picker  # real API: props, variants, examples
urbicon recipe login               # production-ready Svelte 5 recipes
urbicon icons calendar             # icon discovery
urbicon pattern dashboard          # composition patterns per page archetype
urbicon principles --topic theming # design heuristics + paradigm profiles
urbicon css-reference intents      # the token truth: naming, dark mode, overrides

# The design loop — generate → validate (the gate) → judge (advisory):

urbicon validate src/              # lint tokens, dark:/focus:, z-index; 0–100 scores
urbicon principles --rubric        # 8-criterion rubric to judge a generated UI
urbicon context                    # read the project's design memory
urbicon record-decision --title …  # write a decision the next session will see`;

  const surfaces = [
    {
      when: "Your coding agent writes or changes your app's code.",
      name: 'The urbicon CLI',
      anchor: 'the-urbicon-cli-title'
    },
    {
      when: "Your app's own assistant needs an answer, a choice or a confirmation from the user.",
      name: 'A2UIView',
      anchor: 'a2ui-title'
    },
    {
      when: 'An assistant such as Claude calls a tool on your MCP server, and the tool should answer with a view instead of text.',
      name: '@urbicon-ui/mcp-app',
      anchor: 'mcp-apps-title'
    }
  ];

  const mcpAppInstall = `bun add @urbicon-ui/mcp-app`;

  const llmsTxtExample = `# llms.txt (quick reference)
# llms-full.txt (complete API for every component)

# Per-component docs with 5 sections:
#   overview | examples | variants | api | slots
# e.g. /primitives/button/llm.txt`;
</script>

<SeoMeta
  title="AI & Developer Experience"
  description="The urbicon CLI puts version-matched design knowledge, a design linter and project memory next to your coding agent; A2UIView draws the forms your app's assistant sends; @urbicon-ui/mcp-app serves the views of an MCP App. Built for Claude, Cursor, and AI-assisted workflows."
/>

<!-- Color Rooms hero field — full-width band flush to the app sidebar, the
     inner wrapper re-aligns with the body. The topics of the page sit in
     the band as its eyebrow, as on Getting started, not as chips above it. -->
<div data-room-hero>
  <div class="mx-auto max-w-4xl px-6">
    <p class="meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase">
      AI &amp; DX — urbicon CLI · A2UI · MCP Apps
    </p>
    <h1 class="text-text-primary mt-4 text-4xl font-bold">AI & Developer Experience</h1>
    <p class="text-text-secondary mt-4 text-xl">
      Three kinds of agent work with Urbicon UI: the coding agent that writes your app, the
      assistant inside your app, and assistants such as Claude that call the tools of your MCP
      server.
    </p>
  </div>
</div>

<div class="mx-auto max-w-4xl px-6 pt-10 pb-12" data-docs-content>
  <div class="border-border-subtle mb-12 overflow-x-auto rounded-xl border">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-surface-subtle border-border-subtle border-b">
          <th class="text-text-primary px-4 py-2 text-left font-medium">Situation</th>
          <th class="text-text-primary px-4 py-2 text-left font-medium">Reach for</th>
        </tr>
      </thead>
      <tbody>
        {#each surfaces as surface (surface.anchor)}
          <tr class="border-border-subtle border-b last:border-0">
            <td class="text-text-secondary px-4 py-3">{surface.when}</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <a href="#{surface.anchor}">{surface.name}</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

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
      package runs the loop: generated markup is gated by
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >urbicon validate</code
      >
      (an edit-time hook and a CI gate), judged against a scoring rubric, and design intent survives sessions
      in a
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >design.manifest.md</code
      >
      in your repo. One measurement, so you can size the claim: Haiku 4.5, one task, CLI and gate against
      neither. Reading the installed package on its own it shipped 373 findings, mostly raw Tailwind colours
      and hand-written
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">dark:</code>
      patches; wired,
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">validate</code>
      came out clean. The design itself scored alike either way — this buys token discipline, not taste.
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
        <h3 class="text-text-primary mb-1 font-semibold">10 design verbs · gated correctness</h3>
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
        href={asset('llms-full.txt')}
        class={buttonVariants({ variant: 'outlined', intent: 'primary' }).base()}
      >
        View llms-full.txt
      </a>
      <a
        href={asset('llms.txt')}
        class={buttonVariants({ variant: 'ghost', intent: 'neutral' }).base()}
      >
        View llms.txt
      </a>
    </div>
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

  <!-- A2UI -->
  <section class="mb-12" aria-labelledby="a2ui-title">
    <h2 id="a2ui-title" class="text-text-primary mb-2 text-2xl font-bold">
      A2UI: forms your assistant sends
    </h2>
    <p class="text-text-secondary mb-4">
      When your assistant needs a date, a choice or a yes from the user, it can describe a form in
      <a href="https://a2ui.org">A2UI</a>, an open protocol for agent-generated UI, instead of
      asking in prose.
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">A2UIView</code>
      from
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >@urbicon-ui/blocks</code
      >
      draws that form with Urbicon components. Your assistant sends a description, never code, and only
      components the catalog lists reach the page.
    </p>
    <p class="text-text-secondary mb-6">
      On the server,
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >a2uiSystemPrompt()</code
      >
      and
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >a2uiFencedTransportSection()</code
      >
      write the part of your assistant's system prompt that names the components it may use and tells
      it to send a form inside an
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">```a2ui</code>
      fence in its reply. In the chat,
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >A2uiStreamSplitter</code
      >
      turns the streamed reply into text and form parts,
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">A2UIView</code>
      draws each form part, and its
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">onAction</code>
      fires when the user presses one of the form's buttons;
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >a2uiActionMessage(event)</code
      > turns that into your assistant's next user turn.
    </p>
    <ul class="text-text-secondary list-disc space-y-1 pl-5">
      <li>
        <a href={resolve('/recipes/a2ui-agent-ui')}>The A2UI recipe</a> builds the whole chat with all
        of these, including a later turn that updates a form your assistant sent earlier.
      </li>
      <li>
        <a href={resolve('/blocks/components/a2-ui-view')}>The A2UIView page</a> renders live forms and
        shows the prompt and the view's wiring in code.
      </li>
      <li>
        <a href={A2UI_GUIDE}>The A2UI guide</a> covers how a form behaves over a conversation: why
        typing in a field sends your assistant nothing, how to gate a button on the form's data, and
        which parts of A2UI 1.0 the view refuses. Your coding agent reads it with
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >urbicon guide a2ui</code
        >.
      </li>
    </ul>
  </section>

  <!-- MCP Apps -->
  <section class="mb-12" aria-labelledby="mcp-apps-title">
    <h2 id="mcp-apps-title" class="text-text-primary mb-2 text-2xl font-bold">
      MCP Apps: a view for your tool
    </h2>
    <p class="text-text-secondary mb-4">
      In a host that supports MCP Apps, such as Claude, a tool can answer with an HTML view instead
      of text. The host is the assistant your users already chat with; your part is the MCP server
      and the view, and
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >@urbicon-ui/mcp-app</code
      >
      covers both. It does not turn your own chat into a host: for a form in your own chat, use
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">A2UIView</code>.
    </p>

    <CodeExample title="Install" code={mcpAppInstall} language="bash" preview={false} />

    <ul class="text-text-secondary mt-6 mb-6 list-disc space-y-1 pl-5">
      <li>
        On the server (<code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >@urbicon-ui/mcp-app/server</code
        >, Node or Bun),
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >createViewCatalog</code
        >
        lists your views and serves their HTML, and
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >createDispatcher</code
        > answers the host's JSON-RPC requests. Your tools, credentials and HTTP route stay yours, and
        the server needs no MCP SDK.
      </li>
      <li>
        In the view (<code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >@urbicon-ui/mcp-app/view</code
        >),
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">startView</code>
        connects to the host, hands your code the tool's arguments and result, and passes on the host's
        light or dark theme. The view renders with any framework.
      </li>
      <li>
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">buildViews</code>
        (<code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >@urbicon-ui/mcp-app/vite</code
        >) builds each view into one HTML file. Urbicon components in a view built this way follow
        the host's theme; another build can compile their
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">light-dark()</code
        > colours into a form the host's theme no longer switches.
      </li>
      <li>
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
          >@urbicon-ui/mcp-app/testing</code
        >
        checks your messages against the MCP SDK's schemas, and its
        <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs">/host</code> subpath
        drives your server from a test host.
      </li>
    </ul>

    <p class="text-text-secondary">
      The build and test entries need peer packages of their own, which
      <a href={MCP_APP_README}>the mcp-app README</a> lists with the code for a server and a view.
      Your coding agent reads it with
      <code class="bg-surface-elevated rounded px-1.5 py-0.5 font-mono text-xs"
        >urbicon guide mcp-app</code
      >.
    </p>
  </section>
</div>
