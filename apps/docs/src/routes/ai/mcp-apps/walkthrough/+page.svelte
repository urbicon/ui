<script lang="ts">
  import GuideProse from '#lib/GuideProse.svelte';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import ViewDemo from './ViewDemo.svelte';

  let { data } = $props();
</script>

<SeoMeta
  title={data.title}
  description="Build an MCP server whose tool a host such as Claude shows as a card: the view catalog and dispatcher, a Svelte view with Urbicon components, the single-file build and a test in a host, with @urbicon-ui/mcp-app."
/>

<div class="mx-auto w-full max-w-3xl px-6 py-16">
  <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">
    // AI & DX · MCP Apps
  </p>
  <h1 class="text-text-primary mt-5 text-4xl font-bold tracking-tight">
    {data.title}<span class="text-primary">|</span>
  </h1>
  <div data-docs-content>
    <p class="text-text-secondary mt-4 text-sm leading-relaxed">
      Build an MCP server whose tool Claude shows as a card, with a Svelte view made of Urbicon
      components. The walkthrough ships inside
      <code class="text-text-primary">@urbicon-ui/mcp-app</code> as
      <code class="text-text-primary">docs/WALKTHROUGH.md</code>, the same file
      <code class="text-text-primary">urbicon guide mcp-app-walkthrough</code> prints for coding
      agents. Every subpath of the package with its options:
      <a href={resolve('/ai/mcp-apps/reference')}>the reference</a>.
    </p>
  </div>

  <section class="mt-10" aria-labelledby="demo-title">
    <h2 id="demo-title" class="text-text-primary text-lg font-semibold">The view you will build</h2>
    <p class="text-text-secondary mt-2 mb-4 text-sm leading-relaxed">
      This is the <code class="text-text-primary">NoteView.svelte</code> from the walkthrough, compiled
      from its code below. The page stands in for the host and the server: switch the step of the call,
      pin the note, and see what the view sends.
    </p>
    <ViewDemo />
  </section>

  <GuideProse html={data.html} headings={data.headings} />
</div>
