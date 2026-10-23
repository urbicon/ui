<script lang="ts">
  import { Button, Dialog, Select } from '@urbicon-ui/blocks';

  const options = [
    { label: 'contains', value: 'contains' },
    { label: 'equals', value: 'equals' },
    { label: 'starts with', value: 'starts' },
    { label: 'ends with', value: 'ends' }
  ];

  let dialogOpen = $state(false);
</script>

<svelte:head>
  <title>Floating Clip Fixture</title>
  <style>
    *,
    *::before,
    *::after {
      /* biome-ignore-start lint/complexity/noImportantStyles: a fixture freezes motion, so it has to beat every transition and animation a utility class sets */
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
      /* biome-ignore-end lint/complexity/noImportantStyles: closes the range above */
    }
  </style>
</svelte:head>

<div class="bg-surface-base flex min-h-screen gap-8 p-8" data-testid="floating-clip-fixture">
  <!-- In-place listboxes inside a scroll box that ends well above the viewport
       bottom: the viewport has room below every trigger, the box has none below
       the last one. -->
  <div class="border-border-default relative h-64 w-80 overflow-y-auto rounded border p-4">
    <div class="flex h-full flex-col justify-between">
      <Select label="First" value="contains" {options} usePortal={false} />
      <Select label="Last" value="contains" {options} usePortal={false} />
    </div>
  </div>

  <!-- The same box, transformed, with a top-layer listbox. The transform would
       hold a fixed listbox in the box; the top layer escapes it all the same. -->
  <div
    class="border-border-default relative h-64 w-80 overflow-y-auto rounded border p-4"
    style:transform="translateX(0)"
  >
    <div class="flex h-full flex-col justify-end">
      <Select label="Portalled" value="contains" {options} />
    </div>
  </div>

  <!-- The Sidebar's shape: a transformed box that clips, with a Dialog declared
       inside it. The dialog is laid out against the viewport, and so are the
       fixed listboxes inside it — the box around the dialog clips neither. -->
  <div class="h-40 w-48 overflow-hidden" style:transform="translateX(0)">
    <Button onclick={() => (dialogOpen = true)}>Open dialog</Button>
    <Dialog bind:open={dialogOpen} title="Clip fixture dialog">
      <Select label="In dialog" value="contains" {options} />
      <!-- A size container inside a clipping box: it does not contain a fixed
           child, so the listbox opens below the box edge. -->
      <div class="mt-4 h-24 overflow-hidden">
        <div class="@container flex h-full flex-col justify-end">
          <Select label="In container" value="contains" {options} />
        </div>
      </div>
    </Dialog>
  </div>
</div>
