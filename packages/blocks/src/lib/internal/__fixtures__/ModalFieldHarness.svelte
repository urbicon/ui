<script lang="ts">
  // Test-only composition: a real Select, Combobox, Popover, Menu or
  // DatePicker inside a real Dialog or Drawer — or inside a plain `<dialog>`
  // opened with `showModal()`, the consumer-built surface Popover's manual
  // mode also covers — with the surface's `open` and the Popover's `open`
  // bound to this harness so both write-backs are observable. A
  // `createRawSnippet` of plain HTML cannot render a component, and the point
  // here is the field's own Escape handling, not a stand-in for it.
  import Combobox from '../../primitives/Combobox/Combobox.svelte';
  import DatePicker from '../../components/DatePicker/DatePicker.svelte';
  import Dialog from '../../primitives/Dialog/Dialog.svelte';
  import Drawer from '../../primitives/Drawer/Drawer.svelte';
  import Menu from '../../primitives/Menu/Menu.svelte';
  import Popover from '../../primitives/Popover/Popover.svelte';
  import Select from '../../primitives/Select/Select.svelte';

  let {
    surface,
    field,
    onClose,
    onClosed,
    transitionDuration,
    onFieldOpenChange,
    onFieldEscape,
    fieldCloseOnEscape = true
  }: {
    surface: 'Dialog' | 'Drawer' | 'native';
    field: 'Select' | 'Combobox' | 'Popover' | 'Menu' | 'DatePicker';
    onClose?: () => void;
    onClosed?: () => void;
    transitionDuration?: number;
    /** Popover, Menu and DatePicker only. */
    onFieldOpenChange?: (open: boolean) => void;
    /** Popover only. */
    onFieldEscape?: () => void;
    /** Popover only. */
    fieldCloseOnEscape?: boolean;
  } = $props();

  let open = $state(true);
  let fieldOpen = $state(false);
  let fieldShown = $state(true);

  /** Closes the surface the way a consumer does: by writing `open`. */
  export function closeSurface() {
    open = false;
  }

  /** Unmounts the field while the surface stays open. */
  export function hideField() {
    fieldShown = false;
  }

  const options = [
    { label: 'equals', value: 'eq' },
    { label: 'contains', value: 'contains' }
  ];
</script>

{#snippet body()}
  <!-- Another control of the surface: where focus stays after a pointer opens
       a Popover in WebKit, which does not focus a clicked button. -->
  <button type="button">Elsewhere</button>
  {#if !fieldShown}
    <!-- unmounted -->
  {:else if field === 'Select'}
    <Select {options} aria-label="Operator" />
  {:else if field === 'Combobox'}
    <Combobox {options} aria-label="Operator" />
  {:else if field === 'Menu'}
    <Menu
      bind:open={fieldOpen}
      onOpenChange={onFieldOpenChange}
      placeholder="Operator"
      items={[{ label: 'equals' }, { label: 'contains' }]}
    />
  {:else if field === 'DatePicker'}
    <DatePicker locale="de-DE" label="Due date" onOpenChange={onFieldOpenChange} />
  {:else}
    <Popover
      bind:open={fieldOpen}
      onOpenChange={onFieldOpenChange}
      onEscape={onFieldEscape}
      closeOnEscape={fieldCloseOnEscape}
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
  <Dialog bind:open {onClose} {onClosed} {transitionDuration} title="Filters" children={body} />
{:else if surface === 'Drawer'}
  <Drawer bind:open {onClose} {onClosed} {transitionDuration} title="Filters" children={body} />
{:else}
  <dialog aria-label="Filters" {@attach (el) => el.showModal()}>
    {@render body()}
  </dialog>
{/if}
