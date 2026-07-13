<script lang="ts">
  // Test-only composition harness for RadioGroup — its RadioItem children read
  // RadioGroupContext, so the interaction test mounts a real composition. Under
  // __fixtures__/ so it is excluded from the published package and never
  // collected as a test file. Not exported from the barrel.
  import type { RadioGroupProps, RadioItemProps } from '../index';
  import RadioGroup from '../RadioGroup.svelte';
  import RadioItem from '../RadioItem.svelte';

  type Item = { value: string; label: string; disabled?: boolean };

  let {
    items = [
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' }
    ] as Item[],
    // Spread onto every RadioItem so a test can pass restProps (e.g. a rogue
    // `tabindex`) through to the item's <input> and assert the component's own
    // internal attributes win.
    itemProps = {},
    ...groupProps
  }: Partial<RadioGroupProps> & { items?: Item[]; itemProps?: Partial<RadioItemProps> } = $props();
</script>

<RadioGroup {...groupProps}>
  {#each items as item (item.value)}
    <RadioItem value={item.value} label={item.label} disabled={item.disabled} {...itemProps} />
  {/each}
</RadioGroup>
