<script lang="ts">
  // E2E fixture for the NumberInput stepper guard (e2e/number-input.spec.ts). The stepper
  // buttons live inside Input's pointer-events-none decoration container and re-enable
  // pointer events locally — jsdom cannot see pointer-events, so real-browser clicks are
  // the only guard that the buttons are actually clickable. The <output> elements mirror
  // the bound values so the spec can assert the numeric model, not just the input text.
  import { NumberInput } from '@urbicon-ui/blocks';

  let qty = $state<number | null>(5);
  let rate = $state<number | null>(0.5);
</script>

<svelte:head>
  <title>NumberInput Test Fixtures</title>
</svelte:head>

<div class="bg-surface-base min-h-screen p-8" data-testid="number-input-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">NumberInput fixtures</h1>

  <div class="max-w-xs space-y-8">
    <div data-testid="ni-basic">
      <NumberInput label="Quantity" bind:value={qty} min={0} max={10} step={1} />
      <output class="text-text-secondary text-sm" data-testid="ni-basic-value">{qty}</output>
    </div>

    <div data-testid="ni-decimal">
      <NumberInput label="Rate" bind:value={rate} min={0} max={1} step={0.1} precision={1} />
      <output class="text-text-secondary text-sm" data-testid="ni-decimal-value">{rate}</output>
    </div>
  </div>
</div>
