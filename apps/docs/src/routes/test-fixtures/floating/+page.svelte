<script lang="ts">
  import { Button, Tooltip, Popover, Menu, Combobox } from '@urbicon-ui/blocks';
  import type { Placement } from '@urbicon-ui/blocks';

  const cardinalPlacements: Placement[] = ['top', 'bottom', 'left', 'right'];

  const menuItems = [
    { label: 'Action A', onSelect: () => {} },
    { label: 'Action B', onSelect: () => {} },
    { label: 'Action C', onSelect: () => {} }
  ];

  const comboboxOptions = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' }
  ];

  let popoverStates = $state<Record<string, boolean>>(
    Object.fromEntries(cardinalPlacements.map((p) => [p, true]))
  );

  let menuOpen = $state(true);
  let comboboxOpen = $state(true);
</script>

<svelte:head>
  <title>Floating Test Fixtures</title>
  <style>
    *,
    *::before,
    *::after {
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
    }
  </style>
</svelte:head>

<div class="bg-surface-base min-h-screen p-8" data-testid="floating-fixtures">
  <!-- Section: Popovers forced open in all cardinal placements -->
  <section data-testid="popover-section" class="mb-24">
    <h2 class="text-text-primary mb-12 text-2xl font-bold">Popover – Cardinal Placements (open)</h2>
    <div class="grid grid-cols-2 gap-32 px-48 py-24">
      {#each cardinalPlacements as placement (placement)}
        <div class="flex items-center justify-center" data-testid="popover-{placement}">
          <Popover {placement} open={popoverStates[placement]} autoTrigger={false}>
            {#snippet trigger()}
              <Button variant="outlined" size="sm" data-testid="popover-trigger-{placement}">
                {placement}
              </Button>
            {/snippet}
            <div class="p-3" data-testid="popover-content-{placement}">
              <p class="text-text-primary text-sm">Popover at <strong>{placement}</strong></p>
            </div>
          </Popover>
        </div>
      {/each}
    </div>
  </section>

  <!-- Section: Menu forced open -->
  <section data-testid="menu-section" class="mb-24">
    <h2 class="text-text-primary mb-12 text-2xl font-bold">Menu (open)</h2>
    <div class="flex justify-center px-48 py-16">
      <div data-testid="menu-wrapper">
        <Menu items={menuItems} placeholder="Actions" open={menuOpen} />
      </div>
    </div>
  </section>

  <!-- Section: Combobox forced open -->
  <section data-testid="combobox-section" class="mb-24">
    <h2 class="text-text-primary mb-12 text-2xl font-bold">Combobox (open)</h2>
    <div class="flex justify-center px-48 py-16">
      <div data-testid="combobox-wrapper">
        <Combobox options={comboboxOptions} placeholder="Search fruits" open={comboboxOpen} />
      </div>
    </div>
  </section>

  <!-- Section: Tooltip test (interactive – hover required) -->
  <section data-testid="tooltip-section" class="mb-24">
    <h2 class="text-text-primary mb-12 text-2xl font-bold">Tooltip (hover to test)</h2>
    <div class="grid grid-cols-4 gap-16 px-32 py-16">
      {#each cardinalPlacements as placement (placement)}
        <div class="flex items-center justify-center" data-testid="tooltip-{placement}">
          <Tooltip label="Tooltip {placement}" {placement} showDelay={0} hideDelay={5000}>
            <Button variant="outlined" size="sm" data-testid="tooltip-trigger-{placement}">
              {placement}
            </Button>
          </Tooltip>
        </div>
      {/each}
    </div>
  </section>
</div>
