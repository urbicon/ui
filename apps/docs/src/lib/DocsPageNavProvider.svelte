<script lang="ts">
  import { setDocsPageNav } from '@urbicon-ui/docs';
  import type { Snippet } from 'svelte';

  // Lifts a markup snippet into DocsLayout's page-nav context once for the whole
  // subtree, so every DocsLayout page renders the same prev/next nav without
  // repeating it per page. The snippet (defined in the root layout, where the
  // nav data and `$app/state` live) can't be handed to `setContext` directly
  // from `<script>`; passing it as a prop here is what makes it script-scoped.
  let { pageNav, children }: { pageNav: Snippet; children: Snippet } = $props();

  // Capturing the initial value is intended: the layout defines `pageNav` once
  // and never swaps it, so the context is set a single time. Its reactivity
  // (the current pathname) lives inside the snippet, not in this reference.
  // svelte-ignore state_referenced_locally
  setDocsPageNav(pageNav);
</script>

{@render children()}
