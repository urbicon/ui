<script lang="ts">
  import Button from '#lib/primitives/Button/Button.svelte';
  import ButtonGroup from '#lib/primitives/ButtonGroup/ButtonGroup.svelte';
  import Toolbar from '#lib/primitives/Toolbar/Toolbar.svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults } from '../blocks-context';

  // A Button under each context that already outranks its own default — the
  // Toolbar's TierContext and a ButtonGroup's variant — so a test can ask
  // whether a theme default ranks below them as well.
  let {
    parent,
    defaults = {}
  }: {
    parent: 'toolbar' | 'group';
    defaults?: Record<string, ComponentDefaults>;
  } = $props();
</script>

<BlocksProvider {defaults}>
  {#if parent === 'toolbar'}
    <Toolbar aria-label="Tools"><Button>Probe</Button></Toolbar>
  {:else}
    <ButtonGroup variant="ghost"><Button>Probe</Button></ButtonGroup>
  {/if}
</BlocksProvider>
