<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';

  let { data } = $props();
</script>

<SeoMeta
  title="Auth Reference (AUTH.md)"
  description="The complete @urbicon-ui/auth reference: architecture, staged setup, federation (SSO), adapter contract, known limitations & production checklist."
/>

<div class="mx-auto w-full max-w-3xl px-6 py-16">
  <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">// Auth</p>
  <h1 class="text-text-primary mt-5 text-4xl font-bold tracking-tight">
    Auth Reference<span class="text-primary">|</span>
  </h1>
  <p class="text-text-secondary mt-4 text-sm leading-relaxed">
    The canonical <code class="text-text-primary">@urbicon-ui/auth</code> reference, rendered from
    the <code class="text-text-primary">docs/AUTH.md</code> that ships inside the npm package — the
    same document your editor opens from
    <code class="text-text-primary">node_modules/@urbicon-ui/auth/docs/AUTH.md</code>.
  </p>

  {#if data.headings.length > 0}
    <nav aria-label="Sections" class="border-border-subtle mt-8 rounded-lg border p-4">
      <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">// Sections</p>
      <ul class="mt-3 grid gap-1.5 sm:grid-cols-2">
        {#each data.headings as heading (heading.id)}
          <li>
            <a href="#{heading.id}" class="text-text-secondary hover:text-primary text-sm">
              {heading.text}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}

  <article class="guide-prose mt-10">
    <!-- eslint-disable-next-line svelte/no-at-html-tags — our own shipped doc, rendered at build time -->
    {@html data.html}
  </article>
</div>

<style>
  .guide-prose {
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.7;
  }

  .guide-prose :global(h2) {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    margin-top: 3rem;
    margin-bottom: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border-subtle);
  }

  .guide-prose :global(h3) {
    color: var(--color-text-primary);
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }

  .guide-prose :global(h4) {
    color: var(--color-text-primary);
    font-size: 1rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .guide-prose :global(p) {
    margin-block: 0.75rem;
  }

  .guide-prose :global(a) {
    color: var(--color-primary);
    text-decoration: none;
  }

  .guide-prose :global(a:hover) {
    text-decoration: underline;
  }

  .guide-prose :global(ul),
  .guide-prose :global(ol) {
    margin-block: 0.75rem;
    padding-inline-start: 1.5rem;
  }

  .guide-prose :global(ul) {
    list-style: disc;
  }

  .guide-prose :global(ol) {
    list-style: decimal;
  }

  .guide-prose :global(li) {
    margin-block: 0.375rem;
  }

  .guide-prose :global(li > input[type='checkbox']) {
    margin-inline-end: 0.5rem;
  }

  .guide-prose :global(code) {
    color: var(--color-text-primary);
    background: var(--color-surface-quiet);
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    font-size: 0.85em;
  }

  .guide-prose :global(pre) {
    background: var(--color-surface-quiet);
    border: 1px solid var(--color-border-subtle);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-block: 1rem;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.6;
  }

  .guide-prose :global(pre code) {
    background: transparent;
    border-radius: 0;
    padding: 0;
    font-size: inherit;
  }

  .guide-prose :global(blockquote) {
    border-inline-start: 3px solid var(--color-primary);
    background: var(--color-surface-quiet);
    border-start-end-radius: 0.5rem;
    border-end-end-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-block: 1rem;
  }

  .guide-prose :global(blockquote p) {
    margin-block: 0.25rem;
  }

  .guide-prose :global(table) {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    margin-block: 1rem;
    font-size: 0.8125rem;
  }

  .guide-prose :global(th),
  .guide-prose :global(td) {
    border: 1px solid var(--color-border-subtle);
    padding: 0.5rem 0.75rem;
    text-align: left;
    vertical-align: top;
  }

  .guide-prose :global(th) {
    color: var(--color-text-primary);
    background: var(--color-surface-quiet);
    font-weight: 600;
    white-space: nowrap;
  }

  .guide-prose :global(h2 code),
  .guide-prose :global(h3 code),
  .guide-prose :global(h4 code) {
    font-size: 0.9em;
  }
</style>
