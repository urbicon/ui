<!--
  Test fixture: a `<BlocksProvider>` around one auth component, so the
  provider-defaults → preset → instance cascade can be driven from a test.
  The provider hands its config down through context, which a `mount()` of the
  component alone cannot supply. Not part of the published package
  (package.json `files` excludes `__fixtures__`).
-->
<script lang="ts">
  import { BlocksProvider, type ComponentDefaults, type PresetMap } from '@urbicon-ui/blocks';
  import PasskeyManager from '../PasskeyManager.svelte';
  import type { PasskeyManagerProps } from '../index.js';

  let {
    defaults = {},
    presets = {},
    ...componentProps
  }: {
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
  } & PasskeyManagerProps = $props();
</script>

<BlocksProvider {defaults} {presets}>
  <PasskeyManager {...componentProps} />
</BlocksProvider>
