<!--
  Sidebar-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Button, CloseIcon, Sidebar } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let open = $state(false);

  // Bewusst ohne `mode`: Im Default `responsive` steht die Sidebar auf großen
  // Viewports permanent — im Playground würde sie damit über der Doku-Seite
  // kleben, statt sich schließen zu lassen. Der Modus-Vergleich steht als
  // eigenes Beispiel auf der Seite.
  const controls = deriveControls(componentData, {
    pick: ['side', 'width', 'closeOnBackdropClick'],
    overrides: {
      closeOnBackdropClick: { label: 'Close on Backdrop' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Sidebar"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Sidebar, Button } from '@urbicon-ui/blocks';"],
    state: { open: false },
    twoWay: ['open']
  }}
>
  {#snippet children(values)}
    <Button onclick={() => (open = true)}>Open Sidebar</Button>
    {#if open}
      <Sidebar
        open={true}
        side={values.side}
        width={values.width}
        closeOnBackdropClick={values.closeOnBackdropClick}
        onOpenChange={(o) => {
          if (!o) open = false;
        }}
      >
        {#snippet header()}
          <div class="flex items-center justify-between py-3">
            <span class="text-text-primary font-semibold">Navigation</span>
            <Button
              variant="ghost"
              intent="neutral"
              size="xs"
              onclick={() => (open = false)}
              aria-label="Close sidebar"
            >
              <CloseIcon class="h-4 w-4" />
            </Button>
          </div>
        {/snippet}
        <nav class="space-y-1 p-4">
          {#each ['Dashboard', 'Projects', 'Team', 'Settings'] as item (item)}
            <button
              class="text-text-secondary hover:bg-surface-hover hover:text-text-primary w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
              onclick={() => (open = false)}
            >
              {item}
            </button>
          {/each}
        </nav>
      </Sidebar>
    {/if}
  {/snippet}
</PlaygroundConfigurator>
