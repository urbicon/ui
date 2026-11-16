<script lang="ts">
  import GuideProse from '#lib/GuideProse.svelte';
  import SeoMeta from '#lib/SeoMeta.svelte';

  let { data } = $props();
</script>

<SeoMeta
  title="Auth Reference (AUTH.md)"
  description="The @urbicon-ui/auth reference: architecture, staged setup, federation (SSO), adapter contract, known limitations & production checklist."
/>

<div class="mx-auto w-full max-w-3xl px-6 py-16">
  <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">// Auth</p>
  <h1 class="text-text-primary mt-5 text-4xl font-bold tracking-tight">
    Auth Reference<span class="text-primary">|</span>
  </h1>
  <p class="text-text-secondary mt-4 text-sm leading-relaxed">
    The <code class="text-text-primary">@urbicon-ui/auth</code> reference. This page renders the
    <code class="text-text-primary">docs/AUTH.md</code> that ships inside the package, the same file
    your editor opens from
    <code class="text-text-primary">node_modules/@urbicon-ui/auth/docs/AUTH.md</code>.
  </p>

  <GuideProse html={data.html} headings={data.headings} />
</div>
