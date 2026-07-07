<script lang="ts">
  // Test-only composition harness for Accordion — its AccordionItem children
  // register through AccordionContext, so the interaction test mounts a real
  // composition. Under __fixtures__/ so it is excluded from the published
  // package and never collected as a test file. Not exported from the barrel.
  import type { AccordionProps } from '../index';
  import Accordion from '../Accordion.svelte';
  import AccordionItem from '../AccordionItem.svelte';

  type Item = { value: string; title: string; disabled?: boolean };

  let {
    items = [
      { value: 'shipping', title: 'Shipping' },
      { value: 'returns', title: 'Returns' },
      { value: 'warranty', title: 'Warranty' }
    ] as Item[],
    ...accordionProps
  }: Partial<AccordionProps> & { items?: Item[] } = $props();
</script>

<Accordion {...accordionProps}>
  {#each items as item (item.value)}
    <AccordionItem value={item.value} title={item.title} disabled={item.disabled}>
      {item.title} content
    </AccordionItem>
  {/each}
</Accordion>
