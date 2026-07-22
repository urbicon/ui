<script lang="ts">
  // Test-only composition harness for ButtonGroup. Child Buttons register
  // through ButtonGroupContext, so a createRawSnippet of plain HTML can't
  // drive the selection contract — the interaction test mounts this real
  // composition instead (same pattern as Tab/__fixtures__/TabHarness.svelte).
  // Lives under __fixtures__/ so it is excluded from the published package
  // (package.json `files`) and never collected as a test file.
  import Button from '../../Button/Button.svelte';
  import type { ButtonProps } from '../../Button/index';
  import type { ButtonGroupProps } from '../index';
  import ButtonGroup from '../ButtonGroup.svelte';

  // `value` is optional so a test can mix a value-less action button (no
  // selection role) into a selection group. Labels are unique per composition,
  // so they key the loop (item.value may be undefined). `attrs` spreads extra
  // props onto the Button — they land in its restProps, which the
  // restProps-first contract tests use to probe that consumer-passed
  // role/aria-checked/data-value cannot override the selection wiring.
  type Item = {
    value?: string;
    label: string;
    onclick?: (event: MouseEvent) => void;
    disabled?: boolean;
    attrs?: Partial<ButtonProps>;
  };

  let {
    items = [
      { value: 'list', label: 'List' },
      { value: 'grid', label: 'Grid' },
      { value: 'map', label: 'Map' }
    ] as Item[],
    value = $bindable(),
    ...groupProps
  }: Partial<ButtonGroupProps> & { items?: Item[] } = $props();

  // Mutable copy so the runtime add/remove probes below can mount/unmount
  // Buttons after the group's initial render (the roving-registry edge cases).
  // The initial-value-only capture is the point — deliberately not $derived.
  // svelte-ignore state_referenced_locally
  let liveItems = $state<Item[]>([...items]);
</script>

<ButtonGroup bind:value {...groupProps}>
  {#each liveItems as item (item.label)}
    <Button value={item.value} disabled={item.disabled} onclick={item.onclick} {...item.attrs}>
      {item.label}
    </Button>
  {/each}
</ButtonGroup>

<!-- Probe + external setter: assert bind:value round-trips without reaching into component internals. -->
<span data-testid="value-probe">{JSON.stringify(value ?? null)}</span>
<button type="button" data-testid="harness-set-grid" onclick={() => (value = 'grid')}>
  set grid
</button>
<!-- Runtime mutation probes for the roving add/remove edge cases. -->
<button
  type="button"
  data-testid="harness-append-photo"
  onclick={() => liveItems.push({ value: 'photo', label: 'Photo' })}
>
  append photo
</button>
<button type="button" data-testid="harness-remove-first" onclick={() => liveItems.splice(0, 1)}>
  remove first
</button>
