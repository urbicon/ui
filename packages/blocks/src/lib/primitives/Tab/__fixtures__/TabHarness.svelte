<script lang="ts">
  // Test-only composition harness for Tab. Tab's strip/panels are Snippet props
  // whose children (TabItem/TabPanel) register through TabContext, so a
  // createRawSnippet of plain HTML can't drive it — the interaction test mounts
  // this real composition instead. Lives under __fixtures__/ so it is excluded
  // from the published package (package.json `files`) and never picked up as a
  // test file (no .test/.spec in the name). Not exported from the barrel.
  //
  // `withPanels: false` drops the panels snippet entirely — the snippet-only
  // mode from #109 where the consumer renders panel content outside <Tab>.
  // `lazy` forwards to every TabPanel to exercise deferred panel rendering.
  import type { TabProps } from '../index';
  import Tab from '../Tab.svelte';
  import TabItem from '../TabItem.svelte';
  import TabPanel from '../TabPanel.svelte';

  type Item = { value: string; label: string; disabled?: boolean };

  let {
    items = [
      { value: 'overview', label: 'Overview' },
      { value: 'settings', label: 'Settings' },
      { value: 'billing', label: 'Billing' }
    ] as Item[],
    withPanels = true,
    lazy = false,
    ...tabProps
  }: Partial<TabProps> & { items?: Item[]; withPanels?: boolean; lazy?: boolean } = $props();
</script>

{#snippet panelsSnippet()}
  {#each items as item (item.value)}
    <TabPanel value={item.value} transition={false} {lazy}>{item.label} content</TabPanel>
  {/each}
{/snippet}

<Tab {...tabProps} panels={withPanels ? panelsSnippet : undefined}>
  {#snippet tabs()}
    {#each items as item (item.value)}
      <TabItem value={item.value} disabled={item.disabled}>{item.label}</TabItem>
    {/each}
  {/snippet}
</Tab>
