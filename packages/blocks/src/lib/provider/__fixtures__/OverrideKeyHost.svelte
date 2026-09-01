<script lang="ts">
  import type { Component } from 'svelte';
  import type { ComponentDefaults, PresetMap } from '../blocks-context';
  import BlocksProvider from '../BlocksProvider.svelte';

  // `CascadeHost` carries no `presets`, and the condition-key check has to be
  // measured on both `overrides` sources — a provider default and a named
  // preset — through the real components, whose condition objects are the whole
  // question. So: any component, under a provider that can hold either source.
  //
  // The third near-identical provider host, and deliberately not two props
  // bolted onto `CascadeHost`: that one is the mount point of a sweep over
  // every exported component, so a change there is cheap to make and expensive
  // to be wrong about. Fold the three together only with that sweep green.
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
