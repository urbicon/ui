<script lang="ts">
  import type { Component } from 'svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults } from '../blocks-context';

  // The sweep needs one mount point that can wrap *any* component in a
  // provider, so the component itself is a prop rather than an import.
  let {
    component,
    props = {},
    unstyled = false,
    defaults = {}
  }: {
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    unstyled?: boolean;
    defaults?: Record<string, ComponentDefaults>;
  } = $props();

  const Rendered = $derived(component);
</script>

<BlocksProvider {unstyled} {defaults}>
  <Rendered {...props} />
</BlocksProvider>
