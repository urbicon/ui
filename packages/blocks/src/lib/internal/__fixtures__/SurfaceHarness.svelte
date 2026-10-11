<script lang="ts">
  // Test-only consumer of a Dialog or Drawer through a real `bind:open`, which
  // is what a write-back inside `onClose` needs to reach: a `$state` props
  // object handed to `mount()` has no setter for a bindable prop, so the
  // component keeps its own copy and the consumer's write never arrives.
  import type { Snippet } from 'svelte';
  import Dialog from '../../primitives/Dialog/Dialog.svelte';
  import Drawer from '../../primitives/Drawer/Drawer.svelte';

  let {
    surface,
    vetoClose = false,
    onClose,
    onClosed,
    title = 'Settings',
    transitionDuration,
    draggable = false,
    children
  }: {
    surface: 'Dialog' | 'Drawer';
    /** Write `open = true` back inside `onClose`. */
    vetoClose?: boolean;
    /** Receives `open` as `onClose` reads it. */
    onClose?: (openInside: boolean) => void;
    onClosed?: () => void;
    title?: string;
    transitionDuration?: number;
    /** Dialog only. */
    draggable?: boolean;
    children?: Snippet;
  } = $props();

  let open = $state(true);

  export function setOpen(value: boolean) {
    open = value;
  }

  export function getOpen() {
    return open;
  }

  function handleClose() {
    onClose?.(open);
    if (vetoClose) open = true;
  }
</script>

{#snippet fallbackBody()}
  <button type="button">Inside</button>
{/snippet}

<output data-testid="bound-open">{open}</output>

{#if surface === 'Dialog'}
  <Dialog
    bind:open
    {title}
    {transitionDuration}
    {draggable}
    onClose={handleClose}
    {onClosed}
    children={children ?? fallbackBody}
  />
{:else}
  <Drawer
    bind:open
    {title}
    {transitionDuration}
    onClose={handleClose}
    {onClosed}
    children={children ?? fallbackBody}
  />
{/if}
