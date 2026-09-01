<script lang="ts">
  import type { Component } from 'svelte';
  import { setTierContext, type InteractiveTier } from '$lib/utils/tier-context';
  import type { ComponentDefaults, PresetMap } from '../blocks-context';
  import BlocksProvider from '../BlocksProvider.svelte';

  // A wrapper and a plain instance of the component it wraps, under one
  // provider carrying both `overrides` sources, optionally inside a tier
  // context. `tier` is the one axis under test here that no caller can write as
  // a prop — the inner component reads it off a context — so the host has to be
  // able to set it. The neighbour is what separates "the rule fired" from "the
  // rule fired everywhere"; the two `display: contents` spans keep the probe
  // count readable per side without adding anything either component can see.
  let {
    component,
    props = {},
    preset,
    neighbour,
    neighbourProps = {},
    neighbourPreset,
    defaults = {},
    presets = {},
    tier
  }: {
    component: Component<Record<string, unknown>>;
    props?: Record<string, unknown>;
    preset?: string;
    neighbour?: Component<Record<string, unknown>>;
    neighbourProps?: Record<string, unknown>;
    neighbourPreset?: string;
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    tier?: InteractiveTier;
  } = $props();

  // svelte-ignore state_referenced_locally
  if (tier) setTierContext({ tier });

  const Rendered = $derived(component);
  const Neighbour = $derived(neighbour);
</script>

<BlocksProvider {defaults} {presets}>
  <span data-scope="wrapper" style="display: contents"><Rendered {preset} {...props} /></span>
  {#if Neighbour}
    <span data-scope="neighbour" style="display: contents">
      <Neighbour preset={neighbourPreset} {...neighbourProps} />
    </span>
  {/if}
</BlocksProvider>
