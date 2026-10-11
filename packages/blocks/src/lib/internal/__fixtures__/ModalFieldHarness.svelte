<script lang="ts">
  // Test-only composition: a real Select or Combobox inside a real Dialog or
  // Drawer, with the surface's `open` bound to this harness so the write-back
  // is observable. A `createRawSnippet` of plain HTML cannot render a component,
  // and the point here is the field's own Escape handling, not a stand-in for it.
  import Combobox from '../../primitives/Combobox/Combobox.svelte';
  import Dialog from '../../primitives/Dialog/Dialog.svelte';
  import Drawer from '../../primitives/Drawer/Drawer.svelte';
  import Select from '../../primitives/Select/Select.svelte';

  let {
    surface,
    field,
    open = $bindable(true),
    onClose
  }: {
    surface: 'Dialog' | 'Drawer';
    field: 'Select' | 'Combobox';
    open?: boolean;
    onClose?: () => void;
  } = $props();

  const options = [
    { label: 'equals', value: 'eq' },
    { label: 'contains', value: 'contains' }
  ];
</script>

{#snippet body()}
  {#if field === 'Select'}
    <Select {options} aria-label="Operator" />
  {:else}
    <Combobox {options} aria-label="Operator" />
  {/if}
{/snippet}

<output data-testid="bound-open">{open}</output>

{#if surface === 'Dialog'}
  <Dialog bind:open {onClose} title="Filters" children={body} />
{:else}
  <Drawer bind:open {onClose} title="Filters" children={body} />
{/if}
