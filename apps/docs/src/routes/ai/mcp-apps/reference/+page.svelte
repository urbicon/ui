<script lang="ts">
  import GuideProse from '#lib/GuideProse.svelte';
  import SeoMeta from '#lib/SeoMeta.svelte';

  let { data } = $props();
</script>

<SeoMeta
  title="MCP App reference"
  description="The @urbicon-ui/mcp-app reference: the view catalog, the JSON-RPC dispatcher, startView and the bridge, buildViews, wireProblem and the test host."
/>

<div class="mx-auto w-full max-w-3xl px-6 py-16">
  <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">
    // AI & DX · MCP Apps
  </p>
  <h1 class="text-text-primary mt-5 text-4xl font-bold tracking-tight">
    MCP App reference<span class="text-primary">|</span>
  </h1>
  <p class="text-text-secondary mt-4 text-sm leading-relaxed">
    Every subpath of <code class="text-text-primary">@urbicon-ui/mcp-app</code> with its options.
    This page renders the package's <code class="text-text-primary">README.md</code>, the same file
    npm shows and <code class="text-text-primary">urbicon guide mcp-app</code> prints for coding agents.
  </p>

  <GuideProse html={data.html} headings={data.headings} />
</div>
