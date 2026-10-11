<script lang="ts">
  import type { Component } from 'svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults, PresetMap } from '../blocks-context';

  // One mount point for any component under a provider carrying both theme
  // rungs. `config` is read through, so a test that hands in `$state` can
  // switch the theme of a mounted component.
  let {
    component,
    props = {},
    config
  }: {
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    config: { defaults?: Record<string, ComponentDefaults>; presets?: PresetMap };
  } = $props();

  const Rendered = $derived(component);
</script>

<BlocksProvider defaults={config.defaults ?? {}} presets={config.presets ?? {}}>
  <Rendered {...props} />
</BlocksProvider>
