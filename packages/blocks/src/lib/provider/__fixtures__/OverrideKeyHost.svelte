<script lang="ts">
  import type { Component } from 'svelte';
  import type { ComponentDefaults, PresetMap } from '../blocks-context';
  import BlocksProvider from '../BlocksProvider.svelte';

  // `CascadeHost` carries no `presets`, and the condition-key check has to be
  // measured on both `overrides` sources — a provider default and a named
  // preset — through the real components, whose condition objects are the whole
  // question. So: any component, under a provider that can hold either source.
  let {
    component,
    props = {},
    preset,
    defaults = {},
    presets = {}
  }: {
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    preset?: string;
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
  } = $props();

  const Rendered = $derived(component);
</script>

<BlocksProvider {defaults} {presets}>
  <Rendered {preset} {...props} />
</BlocksProvider>
