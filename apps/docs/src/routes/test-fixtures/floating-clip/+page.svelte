<script lang="ts">
  import { Select } from '@urbicon-ui/blocks';

  const options = [
    { label: 'contains', value: 'contains' },
    { label: 'equals', value: 'equals' },
    { label: 'starts with', value: 'starts' },
    { label: 'ends with', value: 'ends' }
  ];
</script>

<svelte:head>
  <title>Floating Clip Fixture</title>
  <style>
    *,
    *::before,
    *::after {
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
    }
  </style>
</svelte:head>

<!-- An in-place listbox inside a scroll box that ends well above the viewport
     bottom: the viewport has room below every trigger, the box has none below
     the last one. -->
<div class="bg-surface-base min-h-screen p-8" data-testid="floating-clip-fixture">
  <div
    class="border-border-default relative h-64 w-80 overflow-y-auto rounded border p-4"
    data-testid="scroll-box"
  >
    <div class="flex h-full flex-col justify-between">
      <Select label="First" value="contains" {options} usePortal={false} />
      <Select label="Last" value="contains" {options} usePortal={false} />
    </div>
  </div>
</div>
