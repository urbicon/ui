<script lang="ts">
  // Test-only composition: a real Select, Combobox or Popover inside a real
  // Dialog or Drawer, with the surface's `open` and the Popover's `open` bound
  // to this harness so both write-backs are observable. A `createRawSnippet` of
  // plain HTML cannot render a component, and the point here is the field's own
  // Escape handling, not a stand-in for it.
  import Combobox from '../../primitives/Combobox/Combobox.svelte';
  import Dialog from '../../primitives/Dialog/Dialog.svelte';
  import Drawer from '../../primitives/Drawer/Drawer.svelte';
  import Popover from '../../primitives/Popover/Popover.svelte';
  import Select from '../../primitives/Select/Select.svelte';

  let {
    surface,
    field,
    open = $bindable(true),
    onClose,
    onFieldOpenChange,
    onFieldEscape
  }: {
    surface: 'Dialog' | 'Drawer';
    field: 'Select' | 'Combobox' | 'Popover';
    open?: boolean;
    onClose?: () => void;
    /** Popover only. */
    onFieldOpenChange?: (open: boolean) => void;
    /** Popover only. */
    onFieldEscape?: () => void;
  } = $props();

  let fieldOpen = $state(false);

  const options = [
    { label: 'equals', value: 'eq' },
    { label: 'contains', value: 'contains' }
  ];
</script>

{#snippet body()}
  {#if field === 'Select'}
    <Select {options} aria-label="Operator" />
  {:else if field === 'Combobox'}
    <Combobox {options} aria-label="Operator" />
  {:else}
    <Popover
      bind:open={fieldOpen}
      onOpenChange={onFieldOpenChange}
      onEscape={onFieldEscape}
      aria-label="Operator options"
    >
      {#snippet trigger()}
        <button type="button">Operator</button>
      {/snippet}
      <button type="button">Inside</button>
    </Popover>
  {/if}
{/snippet}

<output data-testid="bound-open">{open}</output>
<output data-testid="field-open">{fieldOpen}</output>

{#if surface === 'Dialog'}
  <Dialog bind:open {onClose} title="Filters" children={body} />
{:else}
  <Drawer bind:open {onClose} title="Filters" children={body} />
{/if}
