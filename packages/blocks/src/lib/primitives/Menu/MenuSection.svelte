<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getMenuContext } from './menu.context';

  let { label, children }: { label?: string; children?: Snippet } = $props();
  const ctx = getMenuContext();
  if (!ctx) {
    throw new Error('MenuSection must be used inside Menu');
  }
</script>

<div class={ctx.styles.section()} role="separator">
  {#if children}
    {@render children()}
  {:else}
    {label}
  {/if}
</div>
