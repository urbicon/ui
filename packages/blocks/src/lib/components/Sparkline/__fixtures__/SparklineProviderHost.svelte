<script lang="ts">
  // A `<Sparkline>` under a `<BlocksProvider>`, so the DEV rename warning can be
  // measured against the provider surfaces as well as the instance prop. Those
  // three (`defaults.slotClasses`, `presets[…].slotClasses`,
  // `defaults.overrides[].class`) are `Record<string, string>`, so a stale slot
  // key reaches no type check at all and only the warning reports it.
  import BlocksProvider from '$lib/provider/BlocksProvider.svelte';
  import type { ComponentDefaults, PresetMap } from '$lib/provider/blocks-context';
  import type { SparklineProps } from '../index';
  import Sparkline from '../Sparkline.svelte';

  let {
    defaults = {},
    presets = {},
    props = { data: [1, 4, 2, 8, 5] }
  }: {
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    props?: SparklineProps;
  } = $props();
</script>

<BlocksProvider {defaults} {presets}>
  <Sparkline {...props} />
</BlocksProvider>
