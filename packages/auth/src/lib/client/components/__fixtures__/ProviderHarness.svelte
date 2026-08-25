<!--
  Test fixture: any one auth component inside a `<BlocksProvider>`, so the parts
  of its contract that only exist under a provider — the `preset` cascade and the
  provider-wide `unstyled` — can be driven from a test. Context only flows
  downward, so a `mount()` of the component alone cannot supply either. Not part
  of the published package (package.json `files` excludes `__fixtures__`).
-->
<script lang="ts">
  import { BlocksProvider, type ComponentDefaults, type PresetMap } from '@urbicon-ui/blocks';
  import type { Component } from 'svelte';

  let {
    component: Subject,
    componentProps = {},
    defaults = {},
    presets = {},
    unstyled = false
  }: {
    component: Component<Record<string, unknown>>;
    componentProps?: Record<string, unknown>;
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    unstyled?: boolean;
  } = $props();
</script>

<BlocksProvider {defaults} {presets} {unstyled}>
  <Subject {...componentProps} />
</BlocksProvider>
