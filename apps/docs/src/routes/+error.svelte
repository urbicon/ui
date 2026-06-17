<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { Button } from '@urbicon-ui/blocks';
  import { SITE_NAME } from '$lib/seo';

  const is404 = $derived(page.status === 404);
  const heading = $derived(is404 ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head>
  <title>{page.status} – {heading} – {SITE_NAME}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[70vh] items-center px-6 py-24">
  <div class="mx-auto w-full max-w-xl">
    <p class="text-text-tertiary font-mono text-xs tracking-[0.2em] uppercase">
      // Error {page.status}
    </p>
    <h1 class="text-text-primary mt-5 text-5xl font-bold tracking-tight">
      {heading}
      <span class="text-primary">|</span>
    </h1>
    <p class="text-text-secondary mt-6 leading-relaxed">
      {#if is404}
        This page doesn't exist — it may have moved, or the link is outdated. The component overview
        is the fastest way back.
      {:else}
        {page.error?.message ?? 'An unexpected error occurred.'} If this keeps happening, the overview
        is a safe place to restart from.
      {/if}
    </p>

    <div class="mt-10 flex flex-wrap items-center gap-4">
      <a href={resolve('/')}>
        <Button intent="primary">Back to overview</Button>
      </a>
      <a href={resolve('/blocks')}>
        <Button variant="ghost">Browse components</Button>
      </a>
    </div>

    <p class="text-text-tertiary mt-12 font-mono text-xs">
      // Tip: press
      <kbd class="border-border-subtle bg-surface-quiet rounded border px-1.5 py-0.5">⌘K</kbd>
      to search the docs
    </p>
  </div>
</div>
