<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Artifact Studio</title>
</svelte:head>

<div class="bg-surface-base text-text-primary min-h-dvh">
  {@render children()}
</div>
