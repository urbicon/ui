<!--
  Test fixture: the table harness inside a `<BlocksProvider>`, so the parts of
  the table's contract that only exist under a provider — `defaults.Table`, its
  `overrides`, `presets.Table` and the provider-wide `unstyled` — can be driven
  from a test. Context only flows downward, so `mount(TableHarness)` alone
  cannot supply any of them. Kept out of the published package by package.json
  `files` (`!dist/**/__fixtures__/**`).
-->
<script lang="ts">
  import { BlocksProvider, type ComponentDefaults, type PresetMap } from '@urbicon-ui/blocks';
  import TableHarness from './TableHarness.svelte';

  let {
    defaults = {},
    presets = {},
    unstyled = false,
    ...tableProps
  }: {
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    unstyled?: boolean;
    [tableProp: string]: unknown;
  } = $props();
</script>

<BlocksProvider {defaults} {presets} {unstyled}>
  <TableHarness {...tableProps} />
</BlocksProvider>
