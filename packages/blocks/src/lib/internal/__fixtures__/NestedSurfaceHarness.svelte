<script lang="ts">
  // Test-only composition: one surface rendered inside the other's content, so
  // the inner `<dialog>` is a DOM descendant of the outer one and an Escape
  // inside the inner surface bubbles on through the outer surface's handler.
  // Two surfaces mounted side by side cannot show that: their keydowns never
  // meet.
  import Dialog from '../../primitives/Dialog/Dialog.svelte';
  import Drawer from '../../primitives/Drawer/Drawer.svelte';

  let {
    outer,
    inner,
    innerCloseOnEscape = true,
    onOuterClose,
    onInnerClose
  }: {
    outer: 'Dialog' | 'Drawer';
    inner: 'Dialog' | 'Drawer';
    innerCloseOnEscape?: boolean;
    onOuterClose?: () => void;
    onInnerClose?: () => void;
  } = $props();
</script>

{#snippet innerBody()}
  <p>Inner body</p>
{/snippet}

{#snippet innerSurface()}
  {#if inner === 'Dialog'}
    <Dialog
      open
      title="Inner"
      closeOnEscape={innerCloseOnEscape}
      onClose={onInnerClose}
      children={innerBody}
    />
  {:else}
    <Drawer
      open
      title="Inner"
      closeOnEscape={innerCloseOnEscape}
      onClose={onInnerClose}
      children={innerBody}
    />
  {/if}
{/snippet}

{#if outer === 'Dialog'}
  <Dialog open title="Outer" onClose={onOuterClose} children={innerSurface} />
{:else}
  <Drawer open title="Outer" onClose={onOuterClose} children={innerSurface} />
{/if}
