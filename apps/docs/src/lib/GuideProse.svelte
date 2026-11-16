<!--
  A shipped guide rendered at prerender time (`#lib/server/guide-markdown.ts`):
  the section nav from its h2s, then the document. The page around it brings
  the header, because the document's own h1 is dropped.
-->
<script lang="ts">
  import type { GuideHeading } from '#lib/server/guide-markdown.js';

  let { html, headings }: { html: string; headings: GuideHeading[] } = $props();
</script>

{#if headings.length > 0}
  <nav aria-label="Sections" class="border-border-subtle mt-8 rounded-lg border p-4">
    <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">// Sections</p>
    <ul class="mt-3 grid gap-1.5 sm:grid-cols-2">
      {#each headings as heading (heading.id)}
        <li>
          <a href="#{heading.id}" class="text-text-secondary hover:text-primary text-sm">
            {heading.text}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<article class="guide-prose mt-10" data-docs-content>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <!-- biome-ignore lint/nursery/noSvelteAtHtmlTags: prerendered marked output of a guide this repo ships, never user input -->{@html html}
</article>

<style>
  .guide-prose {
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
    line-height: 1.7;
    /* A long inline code span breaks instead of widening the page on a phone. */
    overflow-wrap: break-word;
  }

  /* A jump to a heading clears the layout's pinned header, and nothing more. */
  .guide-prose :global(:is(h2, h3, h4)) {
    scroll-margin-top: var(--sidebar-layout-header-h, 0rem);
  }

  /* The ring CodePanel's code region shows, for the same keyboard stop. */
  .guide-prose :global(:is(pre, table):focus-visible) {
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-surface-base),
      0 0 0 4px color-mix(in oklab, var(--color-primary) 40%, transparent);
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
