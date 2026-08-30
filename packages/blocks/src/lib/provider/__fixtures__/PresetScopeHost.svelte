<script lang="ts">
  import type { Component } from 'svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { PresetMap } from '../blocks-context';

  // The wrapper and a plain instance of the component it wraps, side by side
  // under one provider: the scope question ("does a preset written for the
  // wrapper also fire on the component it wraps") has no answer with only one
  // of them mounted. Each side sits in its own `display: contents` span so the
  // probe count can be read per side — context is component-tree scoped, so the
  // extra element changes nothing either component can observe.
  let {
    component,
    props = {},
    neighbour,
    neighbourProps = {},
    presets = {}
  }: {
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    neighbour: Component<Record<string, unknown>>;
    neighbourProps?: Record<string, unknown>;
    presets?: PresetMap;
  } = $props();

  const Rendered = $derived(component);
  const Neighbour = $derived(neighbour);
</script>

<BlocksProvider {presets}>
  <span data-scope="wrapper" style="display: contents"><Rendered {...props} /></span>
  <span data-scope="neighbour" style="display: contents">
    <Neighbour preset="compact" {...neighbourProps} />
  </span>
</BlocksProvider>
