<script lang="ts">
  // Test-only composition harness for SegmentGroup — its SegmentItem children
  // register through SegmentGroupContext, so the interaction test mounts a real
  // composition. Under __fixtures__/ so it is excluded from the published
  // package and never collected as a test file. Not exported from the barrel.
  import type { SegmentGroupProps } from '../index';
  import SegmentGroup from '../SegmentGroup.svelte';
  import SegmentItem from '../SegmentItem.svelte';

  type Item = { value: string; label: string; disabled?: boolean };

  let {
    items = [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' }
    ] as Item[],
    ...groupProps
  }: Partial<SegmentGroupProps> & { items?: Item[] } = $props();
</script>

<SegmentGroup {...groupProps}>
  {#each items as item (item.value)}
    <SegmentItem value={item.value} disabled={item.disabled}>{item.label}</SegmentItem>
  {/each}
</SegmentGroup>
